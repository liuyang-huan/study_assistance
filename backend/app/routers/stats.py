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


@router.get('/knowledge-graph')
def knowledge_graph(goal_id: int, db: Session = Depends(get_db)):
    """返回知识图谱数据：节点（阶段/主题）和边（关联关系）"""
    g = db.query(LearningGoal).filter(LearningGoal.id == goal_id).first()
    if not g:
        return {'nodes': [], 'edges': []}

    rm = db.query(Roadmap).filter(
        Roadmap.goal_id == goal_id, Roadmap.is_active == True
    ).order_by(Roadmap.version.desc()).first()
    if not rm:
        return {'nodes': [], 'edges': []}

    content = json.loads(rm.content) if isinstance(rm.content, str) else rm.content
    phases = content.get('phases', [])

    # 获取学习数据来标记状态
    journal_dates: set[str] = set()
    journals = db.query(JournalEntry).filter(JournalEntry.goal_id == goal_id).all()
    for j in journals:
        journal_dates.add(str(j.date))

    # 获取问答评分
    answers = db.query(UserAnswer).join(DailyQuestion).filter(
        DailyQuestion.goal_id == goal_id
    ).all()
    avg_score = sum(a.score for a in answers if a.score) / max(len([a for a in answers if a.score]), 1)

    nodes = []
    edges = []
    prev_topic_id = None

    for phase in phases:
        phase_id = f'phase_{phase.get("phase")}'
        phase_title = phase.get('title', '')
        phase_days = phase.get('duration_days', 0)

        # 阶段节点的状态基于其主题完成情况
        topics = phase.get('topics', [])
        topics_with_data = sum(1 for _ in topics)
        phase_status = 'pending'

        nodes.append({
            'id': phase_id,
            'label': phase_title,
            'type': 'phase',
            'subtitle': f'{phase_days}天',
            'status': phase_status,
            'x': None, 'y': None,
        })

        for topic in topics:
            topic_id = f'topic_{topic.get("day")}'
            topic_title = topic.get('title', '')

            # 判断主题状态：有日志记录的是 completed
            topic_status = 'pending'
            if prev_topic_id is None:
                topic_status = 'in_progress'

            nodes.append({
                'id': topic_id,
                'label': topic_title,
                'type': 'topic',
                'subtitle': f'Day {topic.get("day")}',
                'status': topic_status,
                'score': round(avg_score, 1) if avg_score else None,
                'x': None, 'y': None,
            })

            # 边：阶段 → 主题
            edges.append({'source': phase_id, 'target': topic_id})

            # 边：主题 → 下一个主题（顺序）
            if prev_topic_id:
                edges.append({'source': prev_topic_id, 'target': topic_id})
            prev_topic_id = topic_id

        # 更新阶段状态
        nodes[-1]['status'] = 'completed' if journal_dates else 'pending'

    # 根据日志更新节点状态
    all_topics = [n for n in nodes if n['type'] == 'topic']
    studied_count = len(journal_dates)
    for i, topic_node in enumerate(all_topics):
        if i < studied_count:
            topic_node['status'] = 'completed'
        elif i == studied_count:
            topic_node['status'] = 'in_progress'

    # 更新阶段状态
    for node in nodes:
        if node['type'] == 'phase':
            phase_topics = [n for n in nodes if n['type'] == 'topic' and any(
                e['source'] == node['id'] and e['target'] == n['id'] for e in edges
            )]
            if phase_topics:
                statuses = [t['status'] for t in phase_topics]
                if all(s == 'completed' for s in statuses):
                    node['status'] = 'completed'
                elif any(s == 'in_progress' for s in statuses) or any(s == 'completed' for s in statuses):
                    node['status'] = 'in_progress'

    return {'nodes': nodes, 'edges': edges}
