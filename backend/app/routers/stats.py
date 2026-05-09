import json
from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..database import get_db
from ..models.goal import LearningGoal
from ..models.roadmap import Roadmap
from ..models.journal import JournalEntry
from ..models.plan import DailyPlan
from ..models.question import DailyQuestion, UserAnswer
from ..models.learned import LearnedTopic
from ..models.content_cache import ContentCache
from ..services.ai_service import chat_json
from ..services.prompt_templates import generate_concept_map

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

    # 阶段进度 — 基于 LearnedTopic 精确统计
    rm = db.query(Roadmap).filter(
        Roadmap.goal_id == goal_id, Roadmap.is_active == True
    ).order_by(Roadmap.version.desc()).first()

    # 已学知识点（来自 LearnedTopic 表）
    learned_days_set = set(
        r[0] for r in db.query(LearnedTopic.topic_day).filter(LearnedTopic.goal_id == goal_id).all()
    )

    phase_progress = []
    total_topics = 0
    learned_count = 0
    if rm:
        content = json.loads(rm.content) if isinstance(rm.content, str) else rm.content
        for phase in content.get('phases', []):
            days = phase.get('duration_days', 0)
            topics = phase.get('topics', [])
            topic_days = [t.get('day') for t in topics]
            learned_in_phase = len([d for d in topic_days if d in learned_days_set])
            total_topics += len(topic_days)
            learned_count += learned_in_phase
            phase_progress.append({
                'phase': phase.get('phase'),
                'title': phase.get('title', ''),
                'total_days': days,
                'completed_days': learned_in_phase,
                'percent': round(learned_in_phase / len(topic_days) * 100, 1) if topic_days else 0,
            })

        overall_percent = round(learned_count / total_topics * 100, 1) if total_topics > 0 else 0
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


@router.get('/heatmap')
def get_heatmap(goal_id: int, db: Session = Depends(get_db)):
    """返回热力图数据：从目标创建到今天的每日学习活跃度"""
    g = db.query(LearningGoal).filter(LearningGoal.id == goal_id).first()
    if not g:
        return []

    today = date.today()
    start_date = g.created_at.date() if g.created_at else today - timedelta(days=365)
    # 至少显示 84 天（约3个月），保证热力图有足够的网格
    min_start = today - timedelta(days=83)
    if start_date > min_start:
        start_date = min_start
    days_range = (today - start_date).days + 1

    # 每日学习时长
    journal_rows = db.query(JournalEntry.date, func.sum(JournalEntry.duration_minutes), func.count(JournalEntry.id)).filter(
        JournalEntry.goal_id == goal_id,
        JournalEntry.date >= start_date,
    ).group_by(JournalEntry.date).all()
    journal_map = {str(r[0]): {'minutes': r[1] or 0, 'journals': r[2]} for r in journal_rows}

    # 每日完成的规划
    plan_rows = db.query(DailyPlan.date).filter(
        DailyPlan.goal_id == goal_id,
        DailyPlan.completed == True,
        DailyPlan.date >= start_date,
    ).all()
    plan_dates = {str(r[0]) for r in plan_rows}

    # 每日答题数
    q_rows = db.query(DailyQuestion.date, func.count(DailyQuestion.id)).filter(
        DailyQuestion.goal_id == goal_id,
        DailyQuestion.status == 'answered',
        DailyQuestion.date >= start_date,
    ).group_by(DailyQuestion.date).all()
    question_map = {str(r[0]): r[1] for r in q_rows}

    # 计算强度等级
    def calc_level(minutes: int, has_activity: bool) -> int:
        if minutes <= 0 and not has_activity: return 0
        if minutes <= 0 and has_activity: return 1
        if minutes <= 30: return 1
        if minutes <= 60: return 2
        if minutes <= 120: return 3
        return 4

    result = []
    for i in range(days_range):
        d = start_date + timedelta(days=i)
        ds = str(d)
        jm = journal_map.get(ds, {'minutes': 0, 'journals': 0})
        minutes = jm['minutes']
        has_activity = jm['journals'] > 0 or ds in plan_dates or question_map.get(ds, 0) > 0
        result.append({
            'date': ds,
            'level': calc_level(minutes, has_activity),
            'minutes': minutes,
            'journals': jm['journals'],
            'plan_completed': ds in plan_dates,
            'questions': question_map.get(ds, 0),
        })

    return result


@router.get('/knowledge-graph')
def knowledge_graph(goal_id: int, db: Session = Depends(get_db)):
    """返回知识图谱数据：根节点(目标) + 阶段 + 主题 + 概念 + 边"""
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

    # 用 LearnedTopic 精确判断每个 topic 的完成状态
    learned_days: set[int] = set(
        row[0] for row in
        db.query(LearnedTopic.topic_day).filter(LearnedTopic.goal_id == goal_id).all()
    )

    # 获取平均评分
    answers = db.query(UserAnswer).join(DailyQuestion).filter(
        DailyQuestion.goal_id == goal_id
    ).all()
    scores = [a.score for a in answers if a.score is not None]
    avg_score = round(sum(scores) / len(scores), 1) if scores else None

    # 尝试加载缓存的概念图
    concept_cache = db.query(ContentCache).filter(
        ContentCache.goal_id == goal_id,
        ContentCache.cache_type == 'concept_map',
    ).order_by(ContentCache.created_at.desc()).first()

    concepts = []
    concept_deps = []
    has_concepts = False
    if concept_cache:
        try:
            cm = json.loads(concept_cache.content) if isinstance(concept_cache.content, str) else concept_cache.content
            concepts = cm.get('concepts', [])
            concept_deps = cm.get('dependencies', [])
            has_concepts = True
        except (json.JSONDecodeError, TypeError):
            pass

    nodes = []
    edges = []

    # 根节点：学习目标
    nodes.append({
        'id': 'root',
        'label': g.title,
        'type': 'root',
        'subtitle': g.description[:50] if g.description else '',
        'status': 'in_progress' if g.status != 'completed' else 'completed',
        'score': avg_score,
    })

    all_topics = []
    prev_topic_id = None

    for phase in phases:
        phase_num = phase.get('phase')
        phase_id = f'phase_{phase_num}'
        phase_title = phase.get('title', '')
        phase_days = phase.get('duration_days', 0)
        topics = phase.get('topics', [])

        topic_days_in_phase = [t.get('day') for t in topics]
        learned_in_phase = len([d for d in topic_days_in_phase if d in learned_days])
        if learned_in_phase == len(topic_days_in_phase) and len(topic_days_in_phase) > 0:
            phase_status = 'completed'
        elif learned_in_phase > 0:
            phase_status = 'in_progress'
        else:
            phase_status = 'pending'

        nodes.append({
            'id': phase_id,
            'label': phase_title,
            'type': 'phase',
            'subtitle': f'{phase_days}天 · {learned_in_phase}/{len(topic_days_in_phase)}',
            'status': phase_status,
        })

        edges.append({'source': 'root', 'target': phase_id})

        for topic in topics:
            topic_day = topic.get('day')
            topic_id = f'topic_{topic_day}'
            topic_title = topic.get('title', '')

            if topic_day in learned_days:
                topic_status = 'completed'
            elif not learned_days or min(learned_days, default=0) >= topic_day:
                all_learned = set(learned_days)
                prev_days = [t.get('day') for t in all_topics[-3:]]
                is_next = topic_day == min(
                    (d for d in topic_days_in_phase if d not in all_learned),
                    default=None
                ) or (not prev_days and topic_day == topic_days_in_phase[0])
                topic_status = 'in_progress' if is_next else 'pending'
            else:
                topic_status = 'pending'

            # 统计该 topic 下的概念数
            topic_concepts = [c for c in concepts if c.get('topic_day') == topic_day]
            concept_count = len(topic_concepts)

            nodes.append({
                'id': topic_id,
                'label': topic_title,
                'type': 'topic',
                'subtitle': f'Day {topic_day}' + (f' · {concept_count}个概念' if concept_count else ''),
                'status': topic_status,
                'score': avg_score,
                'concept_count': concept_count,
            })

            all_topics.append(topic)

            edges.append({'source': phase_id, 'target': topic_id})

            if prev_topic_id:
                edges.append({'source': prev_topic_id, 'target': topic_id})
            prev_topic_id = topic_id

            # 概念节点和边（如果有）
            for c in topic_concepts:
                concept_id = c['id']
                nodes.append({
                    'id': concept_id,
                    'label': c['label'],
                    'type': 'concept',
                    'subtitle': c.get('summary', ''),
                    'status': topic_status,
                    'topic_day': topic_day,
                })
                edges.append({'source': topic_id, 'target': concept_id})

    # 概念间依赖边
    for dep in concept_deps:
        edges.append({'source': dep['from'], 'target': dep['to'], 'dependency': True})

    return {'nodes': nodes, 'edges': edges, 'has_concepts': has_concepts}


@router.post('/knowledge-graph/generate-concepts')
def generate_concepts(goal_id: int, db: Session = Depends(get_db)):
    """调用 AI 为路线中每个 topic 提取核心概念和依赖关系"""
    g = db.query(LearningGoal).filter(LearningGoal.id == goal_id).first()
    if not g:
        raise HTTPException(status_code=404, detail='目标不存在')

    rm = db.query(Roadmap).filter(
        Roadmap.goal_id == goal_id, Roadmap.is_active == True
    ).order_by(Roadmap.version.desc()).first()
    if not rm:
        raise HTTPException(status_code=404, detail='暂无学习路线')

    content = json.loads(rm.content) if isinstance(rm.content, str) else rm.content

    # 精简路线数据给 AI，只保留结构和标题
    slim_phases = []
    for p in content.get('phases', []):
        slim_phases.append({
            'phase': p.get('phase'),
            'title': p.get('title', ''),
            'topics': [{'day': t.get('day'), 'title': t.get('title', '')}
                        for t in p.get('topics', [])],
        })

    prompt = generate_concept_map(g.title, json.dumps({'phases': slim_phases}, ensure_ascii=False))
    result = chat_json([{'role': 'user', 'content': prompt}], timeout=60.0)

    # 缓存结果
    existing = db.query(ContentCache).filter(
        ContentCache.goal_id == goal_id,
        ContentCache.cache_type == 'concept_map',
    ).first()
    if existing:
        existing.content = json.dumps(result, ensure_ascii=False)
    else:
        db.add(ContentCache(
            goal_id=goal_id,
            cache_type='concept_map',
            cache_key='default',
            content=json.dumps(result, ensure_ascii=False),
        ))
    db.commit()

    return {'concepts': result.get('concepts', []), 'dependencies': result.get('dependencies', [])}
