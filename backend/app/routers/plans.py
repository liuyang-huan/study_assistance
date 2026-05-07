import json
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.goal import LearningGoal
from ..models.roadmap import Roadmap
from ..models.plan import DailyPlan
from ..models.journal import JournalEntry
from ..models.question import DailyQuestion
from ..schemas.api import PlanResponse
from ..services.ai_service import chat_json
from ..services.prompt_templates import generate_daily_plan

router = APIRouter(prefix='/api', tags=['plans'])


def _plan_to_response(p: DailyPlan) -> dict:
    return {'id': p.id, 'goal_id': p.goal_id, 'date': str(p.date),
            'plan_content': json.loads(p.plan_content) if isinstance(p.plan_content, str) else p.plan_content,
            'is_adjusted': p.is_adjusted, 'completed': p.completed,
            'created_at': p.created_at.isoformat()}


@router.get('/goals/{goal_id}/plans', response_model=PlanResponse | dict)
def get_plans(goal_id: int, target_date: str = Query(None, alias='date'), db: Session = Depends(get_db)):
    qdate = target_date if target_date else str(date.today())
    p = db.query(DailyPlan).filter(
        DailyPlan.goal_id == goal_id, DailyPlan.date == qdate
    ).first()
    if not p:
        return {}
    return _plan_to_response(p)


@router.post('/goals/{goal_id}/plans/generate', response_model=PlanResponse)
def gen_plan(goal_id: int, db: Session = Depends(get_db)):
    g = db.query(LearningGoal).filter(LearningGoal.id == goal_id).first()
    if not g:
        raise HTTPException(status_code=404, detail='目标不存在')

    rm = db.query(Roadmap).filter(Roadmap.goal_id == goal_id, Roadmap.is_active == True).first()
    roadmap_data = json.loads(rm.content) if rm and isinstance(rm.content, str) else (rm.content if rm else {'phases': []})
    current_phase = roadmap_data.get('phases', [{}])[0].get('title', '初始阶段') if roadmap_data.get('phases') else '初始阶段'

    recent_journals = db.query(JournalEntry).filter(
        JournalEntry.goal_id == goal_id
    ).order_by(JournalEntry.date.desc()).limit(3).all()
    journal_text = '\n'.join([f'{j.date}: {j.reflection or j.content[:100]}' for j in recent_journals])

    recent_qs = db.query(DailyQuestion).filter(
        DailyQuestion.goal_id == goal_id, DailyQuestion.status == 'answered'
    ).order_by(DailyQuestion.date.desc()).limit(3).all()
    q_text = f'最近回答了{len(recent_qs)}个问题' if recent_qs else '暂未回答问题'

    try:
        result = chat_json([{'role': 'user', 'content': generate_daily_plan(
            goal_title=g.title,
            roadmap_summary=json.dumps(roadmap_data, ensure_ascii=False)[:3000],
            current_phase=current_phase,
            date_str=str(date.today()),
            recent_journals=journal_text,
            recent_evaluations=q_text,
        )}])
    except Exception:
        raise HTTPException(status_code=500, detail='AI 生成规划失败')

    # 删除今天已有规划，用新生成替代
    today = date.today()
    db.query(DailyPlan).filter(DailyPlan.goal_id == goal_id, DailyPlan.date == today).delete()

    p = DailyPlan(goal_id=goal_id, date=today, plan_content=json.dumps(result, ensure_ascii=False))
    db.add(p)
    db.commit()
    db.refresh(p)
    return _plan_to_response(p)


@router.put('/plans/{plan_id}/complete')
def complete_plan(plan_id: int, db: Session = Depends(get_db)):
    p = db.query(DailyPlan).filter(DailyPlan.id == plan_id).first()
    if not p:
        raise HTTPException(status_code=404, detail='规划不存在')
    p.completed = True
    db.commit()
    return {'ok': True}
