import os
import json
import uuid
import logging
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.goal import LearningGoal
from ..models.book_import import BookImport, BookSection
from ..schemas.api import BookImportResponse, BookSectionResponse, TocEntrySchema, TranslationUpdate
from ..services.ai_service import chat_json
from ..services.prompt_templates import extract_toc_from_book, translate_section
from ..services.document_processor import (
    ALLOWED_EXTENSIONS, MAX_FILE_SIZE,
    extract_text_from_pdf, extract_text_from_docx,
    build_toc_from_regex, map_toc_to_pages,
    extract_heading_lines, sample_text_for_ai,
    extract_toc_from_pdf_outlines,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix='/api/goals/{goal_id}', tags=['documents'])

# 独立路由器，用于无需预设 goal_id 的导入操作
import_router = APIRouter(prefix='/api/documents', tags=['documents'])

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'data', 'uploads', 'documents')
os.makedirs(UPLOAD_DIR, exist_ok=True)


def _build_book_import_response(bi: BookImport) -> dict:
    toc = None
    if bi.toc:
        try:
            toc = json.loads(bi.toc)
        except (json.JSONDecodeError, TypeError):
            toc = None
    return {
        'id': bi.id, 'goal_id': bi.goal_id,
        'filename': bi.filename, 'original_filename': bi.original_filename,
        'file_size': bi.file_size, 'status': bi.status,
        'error_message': bi.error_message, 'toc': toc,
        'total_pages': bi.total_pages, 'source_language': bi.source_language,
        'created_at': bi.created_at.isoformat(),
    }


def _translate_single_section_content(section, source_lang: str) -> bool:
    """翻译单个章节的正文内容。成功返回 True，失败返回 False。"""
    lang_label = '日文' if source_lang == 'ja' else '英文'
    try:
        prompt = translate_section(section.title, section.content, lang_label)
        result = chat_json([{'role': 'user', 'content': prompt}], timeout=120.0)
        section.translated_title = result.get('title', section.translated_title or section.title)
        section.translated_content = result.get('content', '')
        return True
    except Exception:
        logger.warning('Section %s 正文翻译失败', section.section_index)
        return False


@router.post('/documents/upload')
async def upload_document(goal_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    # Validate goal exists
    g = db.query(LearningGoal).filter(LearningGoal.id == goal_id).first()
    if not g:
        raise HTTPException(status_code=404, detail='目标不存在')

    # Validate file extension
    ext = os.path.splitext(file.filename or '')[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f'不支持的文件类型，请上传 PDF 或 DOCX 文件')

    # Read file content and check size
    content_bytes = await file.read()
    if len(content_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail='文件大小超过 50MB 限制')

    # Save file
    stored_name = f'{uuid.uuid4().hex}{ext}'
    file_path = os.path.join(UPLOAD_DIR, stored_name)
    with open(file_path, 'wb') as f:
        f.write(content_bytes)

    # Create BookImport record
    book_import = BookImport(
        goal_id=goal_id,
        filename=stored_name,
        original_filename=file.filename or 'unknown',
        file_size=len(content_bytes),
        status='processing',
    )
    db.add(book_import)
    db.commit()
    db.refresh(book_import)

    try:
        entries = None
        if ext == '.pdf':
            # 优先使用 PDF 内嵌书签目录（秒级，不需要全文提取）
            entries = extract_toc_from_pdf_outlines(file_path)
            if entries:
                logger.info('PDF outline TOC extracted: %d entries', len(entries))
                from pypdf import PdfReader
                _reader = PdfReader(file_path)
                book_import.total_pages = len(_reader.pages)
                book_import.toc = json.dumps(entries, ensure_ascii=False)
                book_import.status = 'done'
                total = book_import.total_pages
                for idx, entry in enumerate(entries):
                    ps = entry.get('page_start')
                    pe = None
                    if ps:
                        for j in range(idx + 1, len(entries)):
                            nps = entries[j].get('page_start')
                            if nps:
                                pe = nps - 1
                                break
                        if pe is None:
                            pe = total
                    section = BookSection(
                        book_import_id=book_import.id,
                        goal_id=goal_id,
                        section_index=idx,
                        title=entry.get('title', ''),
                        level=entry.get('level', 1),
                        page_start=ps,
                        page_end=pe,
                    )
                    db.add(section)
                db.commit()
                return _build_book_import_response(book_import)

            # 无内嵌目录，回退到全文提取
            extracted = extract_text_from_pdf(file_path)
        else:
            extracted = extract_text_from_docx(file_path)

        full_text = extracted['full_text'].strip()

        # Check for scanned PDF (no text layer)
        if len(full_text.replace('\n', '').replace(' ', '')) < 20:
            book_import.status = 'error'
            book_import.error_message = '该文件似乎是扫描版，没有可提取的文本内容。请使用带文本层的文件，或先用OCR工具处理。'
            db.commit()
            return _build_book_import_response(book_import)

        # 目录提取：程序化正则提取（支持中英文章节格式）
        if not entries:
            entries = build_toc_from_regex(full_text)

        if entries:
            logger.info('Programmatic TOC extracted: %d entries', len(entries))
        else:
            # 回退到 AI 提取
            text_sample = sample_text_for_ai(full_text)
            heading_lines = extract_heading_lines(full_text)
            toc_sample = f'{text_sample}\n\n===== 全书章节标题行汇总 =====\n{heading_lines}'

            toc_result = chat_json(
                [{'role': 'user', 'content': extract_toc_from_book(g.title, toc_sample)}],
                timeout=90.0,
            )
            entries = toc_result.get('entries', [])

        if not entries:
            # 无目录 — 整本书作为一个章节（仍然不存全文，存页范围）
            book_import.toc = json.dumps([], ensure_ascii=False)
            book_import.total_pages = extracted.get('total_pages')
            book_import.status = 'done'
            section = BookSection(
                book_import_id=book_import.id,
                goal_id=goal_id,
                section_index=0,
                title=g.title,
                level=1,
                page_start=1,
                page_end=extracted.get('total_pages', 1),
            )
            db.add(section)
            db.commit()
            return _build_book_import_response(book_import)

        # 将 TOC 条目映射到 PDF 页码
        if ext == '.pdf':
            entries_with_pages = map_toc_to_pages(extracted['pages'], entries)
        else:
            # DOCX 没有页号，按比例估算
            for i, entry in enumerate(entries):
                entry['page_start'] = None
                entry['page_end'] = None
            entries_with_pages = entries

        # 只存标题和页号，不存正文（正文在学到时按需读取）
        for idx, entry in enumerate(entries_with_pages):
            section = BookSection(
                book_import_id=book_import.id,
                goal_id=goal_id,
                section_index=idx,
                title=entry.get('title', ''),
                level=entry.get('level', 1),
                page_start=entry.get('page_start'),
                page_end=entry.get('page_end'),
            )
            db.add(section)

        book_import.toc = json.dumps(entries_with_pages, ensure_ascii=False)
        book_import.total_pages = extracted.get('total_pages')
        book_import.status = 'done'
        db.commit()

    except ValueError as e:
        book_import.status = 'error'
        book_import.error_message = str(e)[:500]
        db.commit()
    except Exception as e:
        logger.exception('Document processing failed')
        book_import.status = 'error'
        book_import.error_message = f'文档处理失败: {str(e)[:200]}'
        db.commit()

    return _build_book_import_response(book_import)


@router.get('/documents/status')
def get_document_status(goal_id: int, db: Session = Depends(get_db)):
    bi = db.query(BookImport).filter(
        BookImport.goal_id == goal_id
    ).order_by(BookImport.id.desc()).first()
    if not bi:
        raise HTTPException(status_code=404, detail='未导入过文档')
    return _build_book_import_response(bi)


@router.get('/documents/toc')
def get_document_toc(goal_id: int, db: Session = Depends(get_db)):
    bi = db.query(BookImport).filter(
        BookImport.goal_id == goal_id
    ).order_by(BookImport.id.desc()).first()
    if not bi:
        raise HTTPException(status_code=404, detail='未导入过文档')
    if not bi.toc:
        return []
    try:
        return json.loads(bi.toc)
    except (json.JSONDecodeError, TypeError):
        return []


@router.get('/documents/sections')
def get_document_sections(goal_id: int, db: Session = Depends(get_db)):
    bi = db.query(BookImport).filter(
        BookImport.goal_id == goal_id
    ).order_by(BookImport.id.desc()).first()
    if not bi:
        raise HTTPException(status_code=404, detail='未导入过文档')
    sections = db.query(BookSection).filter(
        BookSection.book_import_id == bi.id
    ).order_by(BookSection.section_index).all()
    return [
        {'id': s.id, 'section_index': s.section_index, 'title': s.title,
         'level': s.level, 'topic_day': s.topic_day}
        for s in sections
    ]


@router.get('/documents/sections/{section_id}')
def get_document_section(goal_id: int, section_id: int, db: Session = Depends(get_db)):
    section = db.query(BookSection).filter(
        BookSection.id == section_id,
        BookSection.goal_id == goal_id,
    ).first()
    if not section:
        raise HTTPException(status_code=404, detail='Section 未找到')
    return {
        'id': section.id, 'section_index': section.section_index,
        'title': section.title, 'level': section.level,
        'content': section.content, 'topic_day': section.topic_day,
        'translated_title': section.translated_title,
        'translated_content': section.translated_content,
    }


@import_router.post('/import')
async def import_document(file: UploadFile = File(...), db: Session = Depends(get_db)):
    # Validate file extension
    ext = os.path.splitext(file.filename or '')[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f'不支持的文件类型，请上传 PDF 或 DOCX 文件')

    # Read file content and check size
    content_bytes = await file.read()
    if len(content_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail='文件大小超过 50MB 限制')

    # Extract title from filename (remove extension, clean up)
    raw_name = os.path.splitext(file.filename or '教材')[0]
    title = raw_name.strip().replace('_', ' ').replace('-', ' ')
    if not title:
        title = '未命名教材'

    # Create learning goal
    g = LearningGoal(title=title, description=f'从教材《{title}》导入')
    db.add(g)
    db.commit()
    db.refresh(g)

    # Save file
    stored_name = f'{uuid.uuid4().hex}{ext}'
    file_path = os.path.join(UPLOAD_DIR, stored_name)
    with open(file_path, 'wb') as f:
        f.write(content_bytes)

    # Create BookImport record
    book_import = BookImport(
        goal_id=g.id,
        filename=stored_name,
        original_filename=file.filename or 'unknown',
        file_size=len(content_bytes),
        status='processing',
    )
    db.add(book_import)
    db.commit()
    db.refresh(book_import)

    try:
        entries = None
        if ext == '.pdf':
            entries = extract_toc_from_pdf_outlines(file_path)
            if entries:
                logger.info('PDF outline TOC extracted: %d entries', len(entries))
                from pypdf import PdfReader
                _reader = PdfReader(file_path)
                book_import.total_pages = len(_reader.pages)
                book_import.toc = json.dumps(entries, ensure_ascii=False)
                book_import.status = 'done'
                total = book_import.total_pages
                for idx, entry in enumerate(entries):
                    ps = entry.get('page_start')
                    pe = None
                    if ps:
                        # 计算 page_end：下一条的 page_start - 1，最后一条 = total_pages
                        for j in range(idx + 1, len(entries)):
                            nps = entries[j].get('page_start')
                            if nps:
                                pe = nps - 1
                                break
                        if pe is None:
                            pe = total
                    section = BookSection(
                        book_import_id=book_import.id,
                        goal_id=g.id,
                        section_index=idx,
                        title=entry.get('title', ''),
                        level=entry.get('level', 1),
                        page_start=ps,
                        page_end=pe,
                    )
                    db.add(section)
                db.commit()
                return {
                    'goal': {'id': g.id, 'title': g.title, 'description': g.description,
                             'status': g.status, 'skill_level': g.skill_level,
                             'created_at': g.created_at.isoformat(), 'updated_at': g.updated_at.isoformat()},
                    'book_import': _build_book_import_response(book_import),
                }

            extracted = extract_text_from_pdf(file_path)
        else:
            extracted = extract_text_from_docx(file_path)

        full_text = extracted['full_text'].strip()

        # Check for scanned PDF
        if len(full_text.replace('\n', '').replace(' ', '')) < 20:
            book_import.status = 'error'
            book_import.error_message = '该文件似乎是扫描版，没有可提取的文本内容。请使用带文本层的文件，或先用OCR工具处理。'
            db.commit()
            return {
                'goal': {'id': g.id, 'title': g.title, 'description': g.description,
                         'status': g.status, 'skill_level': g.skill_level,
                         'created_at': g.created_at.isoformat(), 'updated_at': g.updated_at.isoformat()},
                'book_import': _build_book_import_response(book_import),
            }

        # Try programmatic TOC extraction first (deterministic, covers all chapters)
        if not entries:
            entries = build_toc_from_regex(full_text)

        if entries:
            logger.info('Programmatic TOC extracted: %d entries', len(entries))
        else:
            # Fallback to AI extraction
            text_sample = sample_text_for_ai(full_text)
            heading_lines = extract_heading_lines(full_text)
            toc_sample = f'{text_sample}\n\n===== 全书章节标题行汇总 =====\n{heading_lines}'

            toc_result = chat_json(
                [{'role': 'user', 'content': extract_toc_from_book(g.title, toc_sample)}],
                timeout=90.0,
            )
            entries = toc_result.get('entries', [])

        if not entries:
            book_import.toc = json.dumps([], ensure_ascii=False)
            book_import.total_pages = extracted.get('total_pages')
            book_import.status = 'done'

            section = BookSection(
                book_import_id=book_import.id,
                goal_id=g.id,
                section_index=0,
                title=g.title,
                level=1,
                page_start=1,
                page_end=extracted.get('total_pages', 1),
            )
            db.add(section)
            db.commit()
            return {
                'goal': {'id': g.id, 'title': g.title, 'description': g.description,
                         'status': g.status, 'skill_level': g.skill_level,
                         'created_at': g.created_at.isoformat(), 'updated_at': g.updated_at.isoformat()},
                'book_import': _build_book_import_response(book_import),
            }

        # 将 TOC 条目映射到 PDF 页码
        if ext == '.pdf':
            entries_with_pages = map_toc_to_pages(extracted['pages'], entries)
        else:
            for entry in entries:
                entry['page_start'] = None
                entry['page_end'] = None
            entries_with_pages = entries

        # 只存标题和页号，不存正文
        for idx, entry in enumerate(entries_with_pages):
            section = BookSection(
                book_import_id=book_import.id,
                goal_id=g.id,
                section_index=idx,
                title=entry.get('title', ''),
                level=entry.get('level', 1),
                page_start=entry.get('page_start'),
                page_end=entry.get('page_end'),
            )
            db.add(section)

        book_import.toc = json.dumps(entries_with_pages, ensure_ascii=False)
        book_import.total_pages = extracted.get('total_pages')
        book_import.status = 'done'
        db.commit()

    except ValueError as e:
        book_import.status = 'error'
        book_import.error_message = str(e)[:500]
        db.commit()
    except Exception as e:
        logger.exception('Document processing failed')
        book_import.status = 'error'
        book_import.error_message = f'文档处理失败: {str(e)[:200]}'
        db.commit()

    return {
        'goal': {'id': g.id, 'title': g.title, 'description': g.description,
                 'status': g.status, 'skill_level': g.skill_level,
                 'created_at': g.created_at.isoformat(), 'updated_at': g.updated_at.isoformat()},
        'book_import': _build_book_import_response(book_import),
    }


@router.put('/documents/sections/{section_id}/translation')
def update_section_translation(
    goal_id: int,
    section_id: int,
    data: TranslationUpdate,
    db: Session = Depends(get_db),
):
    section = db.query(BookSection).filter(
        BookSection.id == section_id,
        BookSection.goal_id == goal_id,
    ).first()
    if not section:
        raise HTTPException(status_code=404, detail='Section 未找到')

    section.translated_content = data.content_translated
    if data.title_translated is not None:
        section.translated_title = data.title_translated
    db.commit()

    return {
        'id': section.id,
        'translated_title': section.translated_title,
        'translated_content': section.translated_content,
        'updated': True,
    }


@router.post('/documents/sections/{section_id}/translate')
def translate_section_content(
    goal_id: int,
    section_id: int,
    db: Session = Depends(get_db),
):
    """按需翻译单个章节正文（用于懒加载翻译）。"""
    section = db.query(BookSection).filter(
        BookSection.id == section_id,
        BookSection.goal_id == goal_id,
    ).first()
    if not section:
        raise HTTPException(status_code=404, detail='Section 未找到')

    if section.translated_content:
        return {
            'id': section.id,
            'translated_title': section.translated_title,
            'translated_content': section.translated_content,
            'cached': True,
        }

    book_import = db.query(BookImport).filter(
        BookImport.id == section.book_import_id,
    ).first()
    source_lang = (book_import.source_language or 'en') if book_import else 'en'

    success = _translate_single_section_content(section, source_lang)
    db.commit()

    return {
        'id': section.id,
        'translated_title': section.translated_title,
        'translated_content': section.translated_content,
        'translated': success,
    }
