import json
import logging
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

from ..database import get_db
from ..models.goal import LearningGoal
from ..models.roadmap import Roadmap
from ..models.plan import DailyPlan
from ..models.question import DailyQuestion
from ..models.journal import JournalEntry
from ..schemas.api import GoalCreate, GoalUpdate, GoalResponse, GoalDetailResponse
from ..services.ai_service import chat_json
from ..services.prompt_templates import generate_roadmap as roadmap_prompt, generate_daily_plan

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
    return [{'id': q.id, 'goal_id': q.goal_id, 'date': str(q.date),
             'question': q.question, 'expected_answer': q.expected_answer,
             'difficulty': q.difficulty, 'status': q.status, 'created_at': q.created_at.isoformat()}
            for q in qs]


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
    db.flush()

    # AI 生成学习路线
    try:
        result = chat_json([{'role': 'user', 'content': roadmap_prompt(data.title, data.description)}])
        rm = Roadmap(goal_id=g.id, content=json.dumps(result, ensure_ascii=False), version=1)
        db.add(rm)
        db.flush()

        # 生成今日规划
        plan_json = chat_json([{'role': 'user', 'content': generate_daily_plan(
            goal_title=data.title,
            roadmap_summary=json.dumps(result, ensure_ascii=False)[:3000],
            current_phase=result.get('phases', [{}])[0].get('title', '开始阶段') if result.get('phases') else '开始阶段',
            date_str=str(date.today()),
        )}])
        dp = DailyPlan(goal_id=g.id, date=date.today(), plan_content=json.dumps(plan_json, ensure_ascii=False))
        db.add(dp)
    except Exception:
        logger.exception('AI 生成路线/规划失败')

    db.commit()
    db.refresh(g)

    return {
        **_goal_to_response(g),
        'roadmap': _get_roadmap(db, g.id),
        'today_plan': _get_today_plan(db, g.id),
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
