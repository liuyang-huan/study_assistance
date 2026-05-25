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
from ..models.book_import import BookImport
from ..schemas.api import PlanResponse
from ..services.ai_service import chat_json
from ..services.prompt_templates import generate_daily_plan

router = APIRouter(prefix='/api', tags=['plans'])


def _plan_to_response(p: DailyPlan) -> dict:
    return {'id': p.id, 'goal_id': p.goal_id, 'date': str(p.date),
            'plan_content': json.loads(p.plan_content) if isinstance(p.plan_content, str) else p.plan_content,
            'is_adjusted': p.is_adjusted, 'completed': p.completed,
            'created_at': p.created_at.isoformat()}


def _build_book_plan(roadmap_data: dict, learned_days: set[int]) -> dict:
    """为教材学习模式构建每日规划：直接从路线中取下一个未学的主题。"""
    tasks = []
    for phase in roadmap_data.get('phases', []):
        for topic in phase.get('topics', []):
            day = topic.get('day')
            if day and day not in learned_days:
                tasks.append({
                    'title': topic.get('title', ''),
                    'duration_min': 30,
                    'detail': f'Day {day} — 阅读教材原文',
                    'day': day,
                })
                if len(tasks) >= 2:
                    break
        if len(tasks) >= 2:
            break
    if not tasks:
        tasks.append({'title': '复习已学内容', 'duration_min': 30, 'detail': '回顾之前学过的章节'})
    return {'tasks': tasks, 'note': '今日教材阅读计划'}


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
def gen_plan(goal_id: int, teaching_style: str = Query(''), db: Session = Depends(get_db)):
    g = db.query(LearningGoal).filter(LearningGoal.id == goal_id).first()
    if not g:
        raise HTTPException(status_code=404, detail='目标不存在')

    rm = db.query(Roadmap).filter(Roadmap.goal_id == goal_id, Roadmap.is_active == True).first()
    roadmap_data = json.loads(rm.content) if rm and isinstance(rm.content, str) else (rm.content if rm else {'phases': []})

    # 检查是否关联了教材导入
    book_import = db.query(BookImport).filter(
        BookImport.goal_id == goal_id, BookImport.status == 'done'
    ).order_by(BookImport.id.desc()).first()

    if book_import:
        # 教材学习模式：直接从路线取下一个未学主题，不调 AI
        from ..models.progress import LearnedTopic
        learned = db.query(LearnedTopic.topic_day).filter(
            LearnedTopic.goal_id == goal_id
        ).all()
        learned_days = {r[0] for r in learned}
        result = _build_book_plan(roadmap_data, learned_days)

        today = date.today()
        db.query(DailyPlan).filter(DailyPlan.goal_id == goal_id, DailyPlan.date == today).delete()
        p = DailyPlan(goal_id=goal_id, date=today, plan_content=json.dumps(result, ensure_ascii=False))
        db.add(p)
        db.commit()
        db.refresh(p)
        return _plan_to_response(p)

    # 原有 AI 规划流程
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
            teaching_style=teaching_style,
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
