import json
from datetime import date, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..database import get_db
from ..models.goal import LearningGoal
from ..models.roadmap import Roadmap
from ..models.journal import JournalEntry
from ..models.plan import DailyPlan
from ..models.question import DailyQuestion, UserAnswer

router = APIRouter(prefix='/api/goals/{goal_id}', tags=['stats'])


@router.get('/stats')
def get_stats(goal_id: int, db: Session = Depends(get_db)):
    g = db.query(LearningGoal).filter(LearningGoal.id == goal_id).first()
    if not g:
        return {}

    # 学习天数（有日志或已完成规划的不同日期数）
    journal_dates = set(r[0] for r in db.query(JournalEntry.date).filter(
        JournalEntry.goal_id == goal_id
    ).distinct().all())

    plan_dates = set(r[0] for r in db.query(DailyPlan.date).filter(
        DailyPlan.goal_id == goal_id, DailyPlan.completed == True
    ).distinct().all())

    all_study_dates = sorted(journal_dates | plan_dates)
    total_study_days = len(all_study_dates)

    # 今日是否有学习记录
    today = date.today()
    studied_today = today in all_study_dates

    # 连续学习天数
    streak = 0
    check_date = today
    while check_date in all_study_dates:
        streak += 1
        check_date -= timedelta(days=1)

    # 总学习时长
    total_minutes = db.query(func.sum(JournalEntry.duration_minutes)).filter(
        JournalEntry.goal_id == goal_id
    ).scalar() or 0

    # 完成规划数
    completed_plans = db.query(func.count(DailyPlan.id)).filter(
        DailyPlan.goal_id == goal_id, DailyPlan.completed == True
    ).scalar() or 0

    # 问答统计
    total_questions = db.query(func.count(DailyQuestion.id)).filter(
        DailyQuestion.goal_id == goal_id
    ).scalar() or 0

    answered_questions = db.query(func.count(DailyQuestion.id)).filter(
        DailyQuestion.goal_id == goal_id, DailyQuestion.status == 'answered'
    ).scalar() or 0

    answers = db.query(UserAnswer).join(DailyQuestion).filter(
        DailyQuestion.goal_id == goal_id
    ).order_by(UserAnswer.created_at.asc()).all()

    score_trend = [{'date': a.created_at.strftime('%m-%d'), 'score': a.score}
                   for a in answers if a.score is not None]

    avg_score = sum(s['score'] for s in score_trend) / len(score_trend) if score_trend else 0

    # 最近7天评分趋势
    recent_scores = score_trend[-7:] if len(score_trend) > 7 else score_trend

    # 阶段进度
    rm = db.query(Roadmap).filter(
        Roadmap.goal_id == goal_id, Roadmap.is_active == True
    ).order_by(Roadmap.version.desc()).first()

    phase_progress = []
    if rm:
        content = json.loads(rm.content) if isinstance(rm.content, str) else rm.content
        total_days = 0
        completed_days = total_study_days
        for phase in content.get('phases', []):
            days = phase.get('duration_days', 0)
            total_days += days
            phase_completed = max(0, min(days, completed_days - sum(
                p.get('completed_days', 0) for p in phase_progress
            )))
            phase_progress.append({
                'phase': phase.get('phase'),
                'title': phase.get('title', ''),
                'total_days': days,
                'completed_days': phase_completed,
                'percent': round(phase_completed / days * 100, 1) if days > 0 else 0,
            })
            completed_days -= phase_completed

        overall_percent = round(min(100, total_study_days / total_days * 100), 1) if total_days > 0 else 0
        current_phase = next((p for p in phase_progress if p['completed_days'] < p['total_days']), phase_progress[-1] if phase_progress else None)
    else:
        overall_percent = 0
        current_phase = None

    # 按日期的学习时长趋势
    daily_minutes = db.query(JournalEntry.date, func.sum(JournalEntry.duration_minutes)).filter(
        JournalEntry.goal_id == goal_id
    ).group_by(JournalEntry.date).order_by(JournalEntry.date.asc()).limit(30).all()
    study_trend = [{'date': str(d), 'minutes': m} for d, m in daily_minutes]

    # 已学主题（从日志和问题中汇总）
    topics_covered = []
    journals = db.query(JournalEntry).filter(
        JournalEntry.goal_id == goal_id
    ).order_by(JournalEntry.date.desc()).limit(20).all()
    for j in journals:
        if j.content:
            topics_covered.append({
                'date': str(j.date),
                'type': 'journal',
                'content': j.content[:100],
                'reflection': j.reflection[:100] if j.reflection else '',
            })

    answered_qs = db.query(DailyQuestion).filter(
        DailyQuestion.goal_id == goal_id, DailyQuestion.status == 'answered'
    ).order_by(DailyQuestion.date.desc()).limit(10).all()
    for q in answered_qs:
        ans = db.query(UserAnswer).filter(UserAnswer.question_id == q.id).first()
        if ans and ans.score is not None:
            topics_covered.append({
                'date': str(q.date),
                'type': 'question',
                'content': q.question[:100],
                'score': ans.score,
            })

    return {
        'total_study_days': total_study_days,
        'streak': streak,
        'studied_today': studied_today,
        'total_minutes': total_minutes,
        'completed_plans': completed_plans,
        'total_questions': total_questions,
        'answered_questions': answered_questions,
        'avg_score': round(avg_score, 1),
        'score_trend': recent_scores,
        'phase_progress': phase_progress,
        'overall_percent': overall_percent,
        'current_phase': current_phase,
        'study_trend': study_trend[-14:],
        'topics_covered': sorted(topics_covered, key=lambda x: x['date'], reverse=True)[:20],
    }
