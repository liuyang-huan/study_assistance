import os
import json
from datetime import date, datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.goal import LearningGoal
from ..models.roadmap import Roadmap
from ..models.question import DailyQuestion
from ..models.journal import JournalEntry
from ..models.content_cache import ContentCache
from ..models.book_import import BookImport, BookSection
from ..schemas.api import RoadmapResponse
from ..services.ai_service import chat_json
from ..services.prompt_templates import generate_roadmap as roadmap_prompt, adjust_roadmap, generate_topic_materials, generate_roadmap_from_toc, translate_section
from ..services.language_utils import needs_translation
from ..services.document_processor import extract_text_from_pdf

router = APIRouter(prefix='/api/goals/{goal_id}', tags=['roadmap'])


def _get_roadmap_response(rm: Roadmap) -> dict:
    return {'id': rm.id, 'goal_id': rm.goal_id,
            'content': json.loads(rm.content) if isinstance(rm.content, str) else rm.content,
            'version': rm.version, 'is_active': rm.is_active, 'created_at': rm.created_at.isoformat()}


def _get_roadmap_prompt(g: LearningGoal, db: Session, goal_id: int, teaching_style: str = '') -> str:
    """Choose between TOC-based and standard roadmap prompt based on book import existence."""
    book_import = db.query(BookImport).filter(
        BookImport.goal_id == goal_id,
        BookImport.status == 'done',
    ).order_by(BookImport.id.desc()).first()

    if book_import and book_import.toc:
        try:
            toc_entries = json.loads(book_import.toc)
            if toc_entries:
                # 如果教材是外语，用翻译后的章节标题替换原标题（按位置索引匹配）
                from ..services.language_utils import needs_translation
                if needs_translation(book_import.source_language):
                    sections = db.query(BookSection).filter(
                        BookSection.book_import_id == book_import.id,
                    ).order_by(BookSection.section_index).all()
                    # TOC entries 和 sections 按顺序一一对应
                    for i, (entry, section) in enumerate(zip(toc_entries, sections)):
                        if section.translated_title:
                            entry['title'] = section.translated_title
                            entry['section_index'] = i

                return generate_roadmap_from_toc(
                    goal_title=g.title,
                    goal_description=g.description or '',
                    toc_json=json.dumps(toc_entries, ensure_ascii=False),
                    book_title=book_import.original_filename,
                    teaching_style=teaching_style,
                )
        except (json.JSONDecodeError, TypeError):
            pass

    return roadmap_prompt(g.title, g.description, teaching_style=teaching_style)


def _map_sections_to_topics(db: Session, goal_id: int, phases: list[dict], book_import_id: int):
    """After roadmap generation, map BookSections to topic days by title matching.

    Uses exact match first, then whitespace-ignored match, then position-based fallback
    (sections and topics are both in order, so section_index maps to global day order).
    """
    sections = db.query(BookSection).filter(
        BookSection.book_import_id == book_import_id,
    ).order_by(BookSection.section_index).all()

    # Collect all topics in global day order
    all_topics = []
    for phase in phases:
        for topic in phase.get('topics', []):
            day = topic.get('day')
            title = topic.get('title', '').strip()
            if day and title:
                all_topics.append({'day': day, 'title': title})

    # First pass: exact title match
    topic_by_title = {t['title']: t['day'] for t in all_topics}
    matched = set()
    for i, section in enumerate(sections):
        st = section.title.strip()
        if st in topic_by_title:
            section.topic_day = topic_by_title[st]
            matched.add(i)

    # Second pass: whitespace-removed match for unmatched sections
    topic_by_title_ns = {''.join(t['title'].split()): t['day'] for t in all_topics}
    for i, section in enumerate(sections):
        if i in matched:
            continue
        st_ns = ''.join(section.title.strip().split())
        if st_ns in topic_by_title_ns:
            section.topic_day = topic_by_title_ns[st_ns]
            matched.add(i)

    # Third pass: position-based fallback (both lists are in order)
    unmatched_sections = [i for i in range(len(sections)) if i not in matched]
    if unmatched_sections:
        used_days = {section.topic_day for section in sections if section.topic_day}
        available_topics = [t for t in all_topics if t['day'] not in used_days]
        for idx, sec_idx in enumerate(unmatched_sections):
            if idx < len(available_topics):
                sections[sec_idx].topic_day = available_topics[idx]['day']

    db.commit()


def _build_roadmap_from_toc(toc_entries: list[dict]) -> list[dict]:
    """直接将目录条目转换为学习路线阶段和主题，不调用 AI。

    level=1 的条目作为阶段(phase)，level>=2 的条目作为主题(topic)。
    如果一个阶段下没有子条目，则该条目本身作为一个主题。
    """
    if not toc_entries:
        return []

    phases = []
    current_phase = None
    global_day = 1

    for entry in toc_entries:
        level = entry.get('level', 1)
        title = entry.get('title', '').strip()
        if not title:
            continue

        if level == 1:
            if current_phase and current_phase['topics']:
                current_phase['duration_days'] = len(current_phase['topics'])
            current_phase = {'phase': len(phases) + 1, 'title': title, 'duration_days': 1, 'topics': []}
            phases.append(current_phase)
        else:
            if current_phase is None:
                current_phase = {'phase': 1, 'title': title, 'duration_days': 1, 'topics': []}
                phases.append(current_phase)
            current_phase['topics'].append({
                'day': global_day,
                'title': title,
                'resources': [],
                'exercises': [],
            })
            global_day += 1

    # 如果某个 level=1 章下面没有子节，把章本身作为一个 topic
    for phase in phases:
        if not phase['topics']:
            phase['topics'].append({
                'day': global_day,
                'title': phase['title'],
                'resources': [],
                'exercises': [],
            })
            global_day += 1
        phase['duration_days'] = len(phase['topics'])

    return phases


@router.get('/roadmap', response_model=RoadmapResponse)
def get_roadmap(goal_id: int, db: Session = Depends(get_db)):
    rm = db.query(Roadmap).filter(
        Roadmap.goal_id == goal_id, Roadmap.is_active == True
    ).order_by(Roadmap.version.desc()).first()
    if not rm:
        raise HTTPException(status_code=404, detail='暂无学习路线')
    return _get_roadmap_response(rm)


@router.post('/roadmap/generate', response_model=RoadmapResponse)
def generate_roadmap(goal_id: int, teaching_style: str = Query(''), db: Session = Depends(get_db)):
    g = db.query(LearningGoal).filter(LearningGoal.id == goal_id).first()
    if not g:
        raise HTTPException(status_code=404, detail='目标不存在')

    # 检查是否关联了书籍导入（教材学习模式，不需要 AI 生成路线）
    book_import = db.query(BookImport).filter(
        BookImport.goal_id == goal_id, BookImport.status == 'done'
    ).order_by(BookImport.id.desc()).first()

    if book_import and book_import.toc:
        try:
            toc_entries = json.loads(book_import.toc)
        except (json.JSONDecodeError, TypeError):
            toc_entries = []

        if toc_entries:
            # 直接用目录构建路线，不调 AI
            phases = _build_roadmap_from_toc(toc_entries)
            result = {'phases': phases}

            # 取消旧版本
            db.query(Roadmap).filter(Roadmap.goal_id == goal_id).update({'is_active': False})
            db.commit()

            max_version = db.query(Roadmap).filter(Roadmap.goal_id == goal_id).order_by(Roadmap.version.desc()).first()
            new_version = (max_version.version + 1) if max_version else 1
            rm = Roadmap(goal_id=goal_id, content=json.dumps(result, ensure_ascii=False), version=new_version)
            db.add(rm)
            db.commit()
            db.refresh(rm)

            _map_sections_to_topics(db, goal_id, phases, book_import.id)
            return _get_roadmap_response(rm)

    # 原有 AI 路线生成流程（无教材时）
    recent_journals = db.query(JournalEntry).filter(
        JournalEntry.goal_id == goal_id
    ).order_by(JournalEntry.date.desc()).limit(5).all()

    recent_answers = db.query(DailyQuestion).filter(
        DailyQuestion.goal_id == goal_id, DailyQuestion.status == 'answered'
    ).order_by(DailyQuestion.date.desc()).limit(5).all()

    # 判断是全新生成还是调整
    if recent_journals or recent_answers:
        old_rm = db.query(Roadmap).filter(Roadmap.goal_id == goal_id).order_by(Roadmap.version.desc()).first()
        if old_rm:
            journal_text = '\n'.join([f'{j.date}: {j.reflection or j.content[:200]}' for j in recent_journals])
            eval_text = '\n'.join([f'问题{q.id}: {"已答" if q.status=="answered" else "未答"}' for q in recent_answers])
            prompt = adjust_roadmap(
                current_roadmap=old_rm.content[:5000],
                goal_title=g.title,
                progress_summary=journal_text,
                weak_points='', strengths='',
                teaching_style=teaching_style,
            )
        else:
            prompt = _get_roadmap_prompt(g, db, goal_id, teaching_style)
    else:
        prompt = _get_roadmap_prompt(g, db, goal_id, teaching_style)

    # 取消旧版本
    db.query(Roadmap).filter(Roadmap.goal_id == goal_id).update({'is_active': False})
    db.commit()

    # AI 调用
    result = chat_json([{'role': 'user', 'content': prompt}], timeout=120.0)

    # 插入新版本
    max_version = db.query(Roadmap).filter(Roadmap.goal_id == goal_id).order_by(Roadmap.version.desc()).first()
    new_version = (max_version.version + 1) if max_version else 1
    rm = Roadmap(goal_id=goal_id, content=json.dumps(result, ensure_ascii=False), version=new_version)
    db.add(rm)
    db.commit()
    db.refresh(rm)

    # Map BookSections to topic days if this was TOC-based
    book_import_after = db.query(BookImport).filter(
        BookImport.goal_id == goal_id, BookImport.status == 'done'
    ).order_by(BookImport.id.desc()).first()
    if book_import_after:
        _map_sections_to_topics(db, goal_id, result.get('phases', []), book_import_after.id)

    return _get_roadmap_response(rm)


def _collect_all_topics(phases: list[dict]) -> list[dict]:
    """Collect all topics from all phases in global day order."""
    topics = []
    for phase in phases:
        for topic in phase.get('topics', []):
            topics.append({
                'day': topic.get('day'),
                'title': topic.get('title', ''),
                'phase': f'Phase {phase.get("phase")}: {phase.get("title")}',
            })
    return topics


def _find_book_section(db: Session, goal_id: int, topic_day: int, all_topics: list[dict]) -> BookSection | None:
    """Find the BookSection for a given topic day.

    Uses: topic_day lookup → exact title match → whitespace-removed title match
    → position-based fallback accounting for level-1 offset.
    """
    section = db.query(BookSection).filter(
        BookSection.goal_id == goal_id,
        BookSection.topic_day == topic_day,
    ).first()
    if section:
        return section

    target_topic = next((t for t in all_topics if t['day'] == topic_day), None)
    if not target_topic:
        return None

    target_title = target_topic['title'].strip()
    target_title_ns = ''.join(target_title.split())

    sections = db.query(BookSection).filter(
        BookSection.goal_id == goal_id,
    ).order_by(BookSection.section_index).all()

    # Exact title match
    for s in sections:
        if s.title.strip() == target_title:
            s.topic_day = topic_day
            db.commit()
            return s

    # Whitespace-removed title match
    for s in sections:
        if ''.join(s.title.strip().split()) == target_title_ns:
            s.topic_day = topic_day
            db.commit()
            return s

    # Position fallback: account for level-1 sections (which become phases, not topics)
    # Count level-1 sections before this topic's position
    topic_pos = next((i for i, t in enumerate(all_topics) if t['day'] == topic_day), 0)
    level1_count = sum(1 for s in sections if s.level == 1)
    # section_index for this topic ≈ topic_pos + level1_count
    # But some level-1 entries might have been converted to topics in the roadmap,
    # so try section_index = topic_pos and go forward until we find a matching title
    for offset in range(len(sections)):
        idx = topic_pos + offset
        if idx >= len(sections):
            break
        s = sections[idx]
        if s.title.strip() == target_title or ''.join(s.title.strip().split()) == target_title_ns:
            s.topic_day = topic_day
            db.commit()
            return s

    return None


def _extract_and_cache_section(db: Session, section: BookSection) -> BookSection | None:
    """Extract PDF content for a book section and store it. Returns the section if successful."""
    if section.content:
        return section
    if section.page_start is None:
        return None

    book_import = db.query(BookImport).filter(
        BookImport.id == section.book_import_id
    ).first()
    if not book_import:
        return None

    # If page_end is None, estimate from next section's page_start or default to 30 pages
    page_end = section.page_end
    if page_end is None:
        next_section = db.query(BookSection).filter(
            BookSection.book_import_id == section.book_import_id,
            BookSection.section_index == section.section_index + 1,
        ).first()
        if next_section and next_section.page_start:
            page_end = next_section.page_start - 1
        else:
            page_end = section.page_start + 30

    upload_dir = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'data', 'uploads', 'documents')
    file_path = os.path.join(upload_dir, book_import.filename)
    try:
        extracted = extract_text_from_pdf(file_path, section.page_start, page_end)
        section.content = extracted['full_text']
        section.page_end = page_end
        section.read_at = datetime.now(timezone.utc)
        db.commit()
        return section
    except Exception:
        return None


def _build_section_response(section: BookSection, topic_title: str) -> dict:
    """Build the response dict for a book section."""
    display_text = section.translated_content or section.content
    display_title = section.translated_title or section.title
    return {
        'title': topic_title,
        'duration_min': 30,
        'detail': display_title,
        'materials': {
            'summary': display_title,
            'content': display_text,
            'original_text': section.content,
            'is_translated': section.translated_content is not None,
            'section_id': section.id,
            'page_start': section.page_start,
            'page_end': section.page_end,
        },
    }


def _precache_next_sections(db: Session, goal_id: int, all_topics: list[dict],
                             current_day: int, current_book_import_id: int):
    """Pre-cache the next 2 topics' PDF content after current topic is loaded."""
    next_topics = [t for t in all_topics if t['day'] and t['day'] > current_day]
    next_topics.sort(key=lambda t: t['day'])
    for nt in next_topics[:2]:
        section = db.query(BookSection).filter(
            BookSection.goal_id == goal_id,
            BookSection.topic_day == nt['day'],
        ).first()
        if not section:
            section = db.query(BookSection).filter(
                BookSection.goal_id == goal_id,
                BookSection.content.is_(None),
                BookSection.book_import_id == current_book_import_id,
                BookSection.section_index == all_topics.index(nt),
            ).first()
        if section and not section.content and section.page_start is not None:
            _extract_and_cache_section(db, section)


@router.post('/roadmap/learn/{topic_day}')
def learn_topic(goal_id: int, topic_day: int, teaching_style: str = Query(''), db: Session = Depends(get_db)):
    """为路线中的某个主题生成学习材料，突破每日规划限制"""
    g = db.query(LearningGoal).filter(LearningGoal.id == goal_id).first()
    if not g:
        raise HTTPException(status_code=404, detail='目标不存在')

    rm = db.query(Roadmap).filter(
        Roadmap.goal_id == goal_id, Roadmap.is_active == True
    ).order_by(Roadmap.version.desc()).first()
    if not rm:
        raise HTTPException(status_code=404, detail='暂无学习路线')

    content = json.loads(rm.content) if isinstance(rm.content, str) else rm.content
    phases = content.get('phases', [])
    all_topics = _collect_all_topics(phases)

    # 查找对应 day 的主题
    target_topic = None
    phase_context = ''
    for t in all_topics:
        if t['day'] == topic_day:
            target_topic = t
            phase_context = t['phase']
            break
    if not target_topic:
        raise HTTPException(status_code=404, detail=f'未找到 Day {topic_day} 的主题')

    # 教材学习模式：直接从教材章节读取原文，不走 AI
    has_book = db.query(BookImport).filter(
        BookImport.goal_id == goal_id, BookImport.status == 'done'
    ).order_by(BookImport.id.desc()).first()

    if has_book:
        section = _find_book_section(db, goal_id, topic_day, all_topics)
        if not section:
            raise HTTPException(status_code=404,
                detail=f'未找到 Day {topic_day} 对应的教材章节，请返回路线页重新生成学习路线')

        if not section.content:
            section = _extract_and_cache_section(db, section)

        if not section or not section.content:
            raise HTTPException(status_code=500,
                detail=f'教材章节「{section.title if section else target_topic["title"]}」内容读取失败，请检查 PDF 文件是否完整')

        # 按需翻译
        if not section.translated_content:
            book_import = db.query(BookImport).filter(
                BookImport.id == section.book_import_id
            ).first()
            source_lang = (book_import.source_language or 'en') if book_import else 'en'
            if needs_translation(source_lang):
                lang_label = '日文' if source_lang == 'ja' else '英文'
                try:
                    prompt = translate_section(section.title, section.content, lang_label)
                    result = chat_json([{'role': 'user', 'content': prompt}], timeout=120.0)
                    section.translated_title = result.get('title', section.title)
                    section.translated_content = result.get('content', '')
                    db.commit()
                except Exception:
                    pass

        # 预缓存下两个知识点
        _precache_next_sections(db, goal_id, all_topics, topic_day, section.book_import_id)

        return _build_section_response(section, target_topic['title'])

    # 纯 AI 模式（无教材关联）
    prompt = generate_topic_materials(
        goal_title=g.title,
        topic_title=target_topic.get('title', ''),
        phase_context=phase_context,
        teaching_style=teaching_style,
    )

    # 1. 先查缓存
    if not teaching_style or teaching_style == 'default':
        cache_key = f'topic_{topic_day}'
        cached = db.query(ContentCache).filter(
            ContentCache.goal_id == goal_id,
            ContentCache.cache_type == 'material',
            ContentCache.cache_key == cache_key,
        ).first()
        if cached:
            result = json.loads(cached.content)
            return result

    # 2. 调 AI
    try:
        result = chat_json([{'role': 'user', 'content': prompt}], timeout=90.0)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f'AI 服务暂时不可用：{str(e)[:100]}')

    return result
