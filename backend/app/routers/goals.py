import json
import threading
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db, SessionLocal
from ..models.goal import LearningGoal
from ..models.roadmap import Roadmap
from ..models.plan import DailyPlan
from ..models.question import DailyQuestion
from ..models.journal import JournalEntry
from ..models.learned import LearnedTopic
from ..models.content_cache import ContentCache
from ..services.ai_service import chat_json
from ..services.prompt_templates import generate_topic_materials
from ..schemas.api import GoalCreate, GoalUpdate, GoalResponse, GoalDetailResponse

router = APIRouter(prefix='/api/goals', tags=['goals'])


def _goal_to_response(g: LearningGoal) -> dict:
    return {
        'id': g.id, 'title': g.title, 'description': g.description,
        'status': g.status, 'skill_level': g.skill_level,
        'created_at': g.created_at, 'updated_at': g.updated_at,
    }


def _get_roadmap(db: Session, goal_id: int) -> dict | None:
    r = db.query(Roadmap).filter(
        Roadmap.goal_id == goal_id, Roadmap.is_active == True
    ).order_by(Roadmap.version.desc()).first()
    if r:
        return {'id': r.id, 'goal_id': r.goal_id, 'content': json.loads(r.content),
                'version': r.version, 'is_active': r.is_active, 'created_at': r.created_at.isoformat()}
    return None


def _get_today_plan(db: Session, goal_id: int) -> dict | None:
    today = date.today()
    p = db.query(DailyPlan).filter(
        DailyPlan.goal_id == goal_id, DailyPlan.date == today
    ).first()
    if p:
        return {'id': p.id, 'goal_id': p.goal_id, 'date': str(p.date),
                'plan_content': json.loads(p.plan_content) if isinstance(p.plan_content, str) else p.plan_content,
                'is_adjusted': p.is_adjusted, 'completed': p.completed, 'created_at': p.created_at.isoformat()}
    return None


def _get_today_questions(db: Session, goal_id: int) -> list[dict]:
    today = date.today()
    qs = db.query(DailyQuestion).filter(
        DailyQuestion.goal_id == goal_id, DailyQuestion.date == today
    ).all()
    result = []
    for q in qs:
        item = {'id': q.id, 'goal_id': q.goal_id, 'date': str(q.date),
                'question': q.question, 'expected_answer': q.expected_answer,
                'difficulty': q.difficulty, 'status': q.status, 'created_at': q.created_at.isoformat()}
        if q.status == 'answered':
            ans = db.query(UserAnswer).filter(
                UserAnswer.question_id == q.id
            ).order_by(UserAnswer.created_at.desc()).first()
            if ans and ans.ai_evaluation:
                item['evaluation'] = json.loads(ans.ai_evaluation) if isinstance(ans.ai_evaluation, str) else ans.ai_evaluation
            else:
                item['evaluation'] = None
        result.append(item)
    return result


def _get_today_journal(db: Session, goal_id: int) -> dict | None:
    today = date.today()
    j = db.query(JournalEntry).filter(
        JournalEntry.goal_id == goal_id, JournalEntry.date == today
    ).first()
    if j:
        return {'id': j.id, 'goal_id': j.goal_id, 'date': str(j.date),
                'content': j.content, 'reflection': j.reflection,
                'duration_minutes': j.duration_minutes, 'created_at': j.created_at.isoformat()}
    return None


@router.get('', response_model=list[GoalResponse])
def list_goals(db: Session = Depends(get_db)):
    goals = db.query(LearningGoal).order_by(LearningGoal.updated_at.desc()).all()
    return [_goal_to_response(g) for g in goals]


@router.post('', response_model=GoalDetailResponse)
def create_goal(data: GoalCreate, db: Session = Depends(get_db)):
    g = LearningGoal(title=data.title, description=data.description)
    db.add(g)
    db.commit()
    db.refresh(g)

    return {
        **_goal_to_response(g),
        'roadmap': None,
        'today_plan': None,
        'today_questions': [],
        'today_journal': None,
    }


@router.get('/{goal_id}', response_model=GoalDetailResponse)
def get_goal(goal_id: int, db: Session = Depends(get_db)):
    g = db.query(LearningGoal).filter(LearningGoal.id == goal_id).first()
    if not g:
        raise HTTPException(status_code=404, detail='目标不存在')
    return {
        **_goal_to_response(g),
        'roadmap': _get_roadmap(db, g.id),
        'today_plan': _get_today_plan(db, g.id),
        'today_questions': _get_today_questions(db, g.id),
        'today_journal': _get_today_journal(db, g.id),
    }


@router.put('/{goal_id}', response_model=GoalResponse)
def update_goal(goal_id: int, data: GoalUpdate, db: Session = Depends(get_db)):
    g = db.query(LearningGoal).filter(LearningGoal.id == goal_id).first()
    if not g:
        raise HTTPException(status_code=404, detail='目标不存在')
    if data.title is not None:
        g.title = data.title
    if data.description is not None:
        g.description = data.description
    if data.status is not None:
        g.status = data.status
    db.commit()
    db.refresh(g)
    return _goal_to_response(g)


@router.delete('/{goal_id}')
def delete_goal(goal_id: int, db: Session = Depends(get_db)):
    g = db.query(LearningGoal).filter(LearningGoal.id == goal_id).first()
    if not g:
        raise HTTPException(status_code=404, detail='目标不存在')
    db.delete(g)
    db.commit()
    return {'ok': True}


# --- 已学习主题 ---
@router.get('/{goal_id}/learned')
def get_learned_topics(goal_id: int, db: Session = Depends(get_db)):
    rows = db.query(LearnedTopic).filter(LearnedTopic.goal_id == goal_id).all()
    return {'learned_days': [r.topic_day for r in rows]}


@router.post('/{goal_id}/learned/{topic_day}')
def mark_topic_learned(goal_id: int, topic_day: int, db: Session = Depends(get_db)):
    g = db.query(LearningGoal).filter(LearningGoal.id == goal_id).first()
    if not g:
        raise HTTPException(status_code=404, detail='目标不存在')
    existing = db.query(LearnedTopic).filter(
        LearnedTopic.goal_id == goal_id, LearnedTopic.topic_day == topic_day
    ).first()
    if not existing:
        db.add(LearnedTopic(goal_id=goal_id, topic_day=topic_day))
        db.commit()
    return {'ok': True}


@router.delete('/{goal_id}/learned/{topic_day}')
def unmark_topic_learned(goal_id: int, topic_day: int, db: Session = Depends(get_db)):
    db.query(LearnedTopic).filter(
        LearnedTopic.goal_id == goal_id, LearnedTopic.topic_day == topic_day
    ).delete()
    db.commit()
    return {'ok': True}


@router.post('/{goal_id}/learned/up-to/{topic_day}')
def mark_topics_up_to(goal_id: int, topic_day: int, db: Session = Depends(get_db)):
    """将 day 1..topic_day 全部标记为已学习"""
    g = db.query(LearningGoal).filter(LearningGoal.id == goal_id).first()
    if not g:
        raise HTTPException(status_code=404, detail='目标不存在')
    existing = {r.topic_day for r in db.query(LearnedTopic).filter(
        LearnedTopic.goal_id == goal_id, LearnedTopic.topic_day <= topic_day
    ).all()}
    for d in range(1, topic_day + 1):
        if d not in existing:
            db.add(LearnedTopic(goal_id=goal_id, topic_day=d))
    db.commit()

    # 后台清理已学缓存 + 预缓存下 2 个未学主题
    threading.Thread(target=_cleanup_and_prefetch, args=(goal_id,), daemon=True).start()

    return {'learned_days': list(range(1, topic_day + 1))}


def _cleanup_and_prefetch(goal_id: int, prefetch_count: int = 2):
    """后台任务：删除已学主题缓存，预缓存接下来 N 个未学主题"""
    db = SessionLocal()
    try:
        g = db.query(LearningGoal).filter(LearningGoal.id == goal_id).first()
        if not g:
            return

        rm = db.query(Roadmap).filter(
            Roadmap.goal_id == goal_id, Roadmap.is_active == True
        ).order_by(Roadmap.version.desc()).first()
        if not rm:
            return

        content = json.loads(rm.content) if isinstance(rm.content, str) else rm.content
        learned = set(
            row[0] for row in
            db.query(LearnedTopic.topic_day).filter(LearnedTopic.goal_id == goal_id).all()
        )

        # 1. 删除所有已学主题的缓存
        if learned:
            db.query(ContentCache).filter(
                ContentCache.goal_id == goal_id,
                ContentCache.cache_type == 'material',
                ContentCache.cache_key.in_([f'topic_{d}' for d in learned]),
            ).delete(synchronize_session=False)
            db.commit()

        # 2. 找到下 N 个未学且未缓存的主题
        to_prefetch = []
        for phase in content.get('phases', []):
            for topic in phase.get('topics', []):
                day = topic.get('day')
                if day not in learned:
                    cache_key = f'topic_{day}'
                    already = db.query(ContentCache).filter(
                        ContentCache.goal_id == goal_id,
                        ContentCache.cache_type == 'material',
                        ContentCache.cache_key == cache_key,
                    ).first()
                    if not already:
                        to_prefetch.append({
                            'day': day,
                            'title': topic.get('title', ''),
                            'phase_ctx': f'Phase {phase.get("phase")}: {phase.get("title")}',
                        })
                    if len(to_prefetch) >= prefetch_count:
                        break
            if len(to_prefetch) >= prefetch_count:
                break

        # 3. 逐个生成并缓存
        for item in to_prefetch:
            prompt = generate_topic_materials(
                goal_title=g.title,
                topic_title=item['title'],
                phase_context=item['phase_ctx'],
            )
            result = chat_json([{'role': 'user', 'content': prompt}], timeout=50.0)
            cache_entry = ContentCache(
                goal_id=goal_id,
                cache_type='material',
                cache_key=f'topic_{item["day"]}',
                content=json.dumps(result, ensure_ascii=False),
            )
            db.add(cache_entry)
            db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()
