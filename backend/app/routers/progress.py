import json
import threading
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db, SessionLocal
from ..models.goal import LearningGoal
from ..models.roadmap import Roadmap
from ..models.learned import LearnedTopic
from ..models.content_cache import ContentCache
from ..services.ai_service import chat_json
from ..services.prompt_templates import generate_topic_materials
from ..schemas.api import LearnedTopicResponse, GoalProgressResponse

router = APIRouter(prefix='/api/goals/{goal_id}', tags=['progress'])


def _get_total_topics(db: Session, goal_id: int) -> int:
    rm = db.query(Roadmap).filter(
        Roadmap.goal_id == goal_id, Roadmap.is_active == True
    ).order_by(Roadmap.version.desc()).first()
    if not rm:
        return 0
    content = json.loads(rm.content) if isinstance(rm.content, str) else rm.content
    return sum(len(p.get('topics', [])) for p in content.get('phases', []))


def _find_current_position(db: Session, goal_id: int) -> tuple[int | None, int | None]:
    rm = db.query(Roadmap).filter(
        Roadmap.goal_id == goal_id, Roadmap.is_active == True
    ).order_by(Roadmap.version.desc()).first()
    if not rm:
        return None, None

    content = json.loads(rm.content) if isinstance(rm.content, str) else rm.content
    learned = set(
        row[0] for row in
        db.query(LearnedTopic.topic_day).filter(LearnedTopic.goal_id == goal_id).all()
    )

    for phase in content.get('phases', []):
        for topic in phase.get('topics', []):
            if topic.get('day') not in learned:
                return phase.get('phase'), topic.get('day')
    return None, None


def _find_next_unlearned(db: Session, goal_id: int) -> tuple[int | None, str | None, str | None, str | None]:
    """找到下一个未学主题，返回 (day, title, phase_title, goal_title)"""
    rm = db.query(Roadmap).filter(
        Roadmap.goal_id == goal_id, Roadmap.is_active == True
    ).order_by(Roadmap.version.desc()).first()
    if not rm:
        return None, None, None, None

    content = json.loads(rm.content) if isinstance(rm.content, str) else rm.content
    learned = set(
        row[0] for row in
        db.query(LearnedTopic.topic_day).filter(LearnedTopic.goal_id == goal_id).all()
    )

    for phase in content.get('phases', []):
        for topic in phase.get('topics', []):
            if topic.get('day') not in learned:
                return (
                    topic.get('day'),
                    topic.get('title', ''),
                    f'Phase {phase.get("phase")}: {phase.get("title")}',
                    None,
                )
    return None, None, None, None


def _prefetch_next_topic(goal_id: int):
    """后台任务：为下一个未学主题预生成材料并缓存"""
    db = SessionLocal()
    try:
        g = db.query(LearningGoal).filter(LearningGoal.id == goal_id).first()
        if not g:
            return

        day, title, phase_ctx, _ = _find_next_unlearned(db, goal_id)
        if day is None:
            return

        cache_key = f'topic_{day}'

        # 已经缓存过就不重复生成
        existing = db.query(ContentCache).filter(
            ContentCache.goal_id == goal_id,
            ContentCache.cache_type == 'material',
            ContentCache.cache_key == cache_key,
        ).first()
        if existing:
            return

        prompt = generate_topic_materials(
            goal_title=g.title,
            topic_title=title,
            phase_context=phase_ctx or '',
        )
        result = chat_json([{'role': 'user', 'content': prompt}], timeout=50.0)

        cache_entry = ContentCache(
            goal_id=goal_id,
            cache_type='material',
            cache_key=cache_key,
            content=json.dumps(result, ensure_ascii=False),
        )
        db.add(cache_entry)
        db.commit()
    except Exception:
        pass  # 预缓存失败不影响主流程
    finally:
        db.close()


@router.get('/progress', response_model=GoalProgressResponse)
def get_progress(goal_id: int, db: Session = Depends(get_db)):
    g = db.query(LearningGoal).filter(LearningGoal.id == goal_id).first()
    if not g:
        raise HTTPException(status_code=404, detail='目标不存在')

    learned_rows = db.query(LearnedTopic).filter(
        LearnedTopic.goal_id == goal_id
    ).order_by(LearnedTopic.learned_at.desc()).all()

    learned_days = [r.topic_day for r in learned_rows]
    total = _get_total_topics(db, goal_id)
    current_phase, current_day = _find_current_position(db, goal_id)

    return {
        'goal_id': goal_id,
        'learned_days': learned_days,
        'total_topics': total,
        'learned_count': len(learned_days),
        'current_phase': current_phase,
        'current_day': current_day,
    }


@router.post('/progress/{topic_day}', response_model=LearnedTopicResponse)
def mark_topic_learned(goal_id: int, topic_day: int, db: Session = Depends(get_db)):
    g = db.query(LearningGoal).filter(LearningGoal.id == goal_id).first()
    if not g:
        raise HTTPException(status_code=404, detail='目标不存在')

    existing = db.query(LearnedTopic).filter(
        LearnedTopic.goal_id == goal_id,
        LearnedTopic.topic_day == topic_day,
    ).first()
    if existing:
        return {'topic_day': existing.topic_day, 'learned_at': existing.learned_at}

    lt = LearnedTopic(goal_id=goal_id, topic_day=topic_day)
    db.add(lt)
    db.commit()
    db.refresh(lt)

    # 后台预缓存下一个未学主题
    threading.Thread(target=_prefetch_next_topic, args=(goal_id,), daemon=True).start()

    return {'topic_day': lt.topic_day, 'learned_at': lt.learned_at}


@router.delete('/progress/{topic_day}')
def unmark_topic(goal_id: int, topic_day: int, db: Session = Depends(get_db)):
    db.query(LearnedTopic).filter(
        LearnedTopic.goal_id == goal_id,
        LearnedTopic.topic_day == topic_day,
    ).delete()
    db.commit()
    return {'ok': True}
