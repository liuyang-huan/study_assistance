import json
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.goal import LearningGoal
from ..models.roadmap import Roadmap
from ..models.question import DailyQuestion
from ..models.journal import JournalEntry
from ..schemas.api import RoadmapResponse
from ..services.ai_service import chat_json
from ..services.prompt_templates import generate_roadmap as roadmap_prompt, adjust_roadmap, generate_topic_materials

router = APIRouter(prefix='/api/goals/{goal_id}', tags=['roadmap'])


def _get_roadmap_response(rm: Roadmap) -> dict:
    return {'id': rm.id, 'goal_id': rm.goal_id,
            'content': json.loads(rm.content) if isinstance(rm.content, str) else rm.content,
            'version': rm.version, 'is_active': rm.is_active, 'created_at': rm.created_at.isoformat()}


@router.get('/roadmap', response_model=RoadmapResponse)
def get_roadmap(goal_id: int, db: Session = Depends(get_db)):
    rm = db.query(Roadmap).filter(
        Roadmap.goal_id == goal_id, Roadmap.is_active == True
    ).order_by(Roadmap.version.desc()).first()
    if not rm:
        raise HTTPException(status_code=404, detail='暂无学习路线')
    return _get_roadmap_response(rm)


@router.post('/roadmap/generate', response_model=RoadmapResponse)
def generate_roadmap(goal_id: int, db: Session = Depends(get_db)):
    g = db.query(LearningGoal).filter(LearningGoal.id == goal_id).first()
    if not g:
        raise HTTPException(status_code=404, detail='目标不存在')

    # 获取近期学习记录用于调整
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
            )
        else:
            prompt = roadmap_prompt(g.title, g.description)
    else:
        prompt = roadmap_prompt(g.title, g.description)

    # 取消旧版本（先提交，释放写锁）
    db.query(Roadmap).filter(Roadmap.goal_id == goal_id).update({'is_active': False})
    db.commit()

    # AI 调用（耗时较长，不在事务中持有锁）
    result = chat_json([{'role': 'user', 'content': prompt}])

    # 插入新版本
    max_version = db.query(Roadmap).filter(Roadmap.goal_id == goal_id).order_by(Roadmap.version.desc()).first()
    new_version = (max_version.version + 1) if max_version else 1
    rm = Roadmap(goal_id=goal_id, content=json.dumps(result, ensure_ascii=False), version=new_version)
    db.add(rm)
    db.commit()
    db.refresh(rm)
    return _get_roadmap_response(rm)


@router.post('/roadmap/learn/{topic_day}')
def learn_topic(goal_id: int, topic_day: int, db: Session = Depends(get_db)):
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

    # 查找对应 day 的主题
    target_topic = None
    phase_context = ''
    for phase in phases:
        for topic in phase.get('topics', []):
            if topic.get('day') == topic_day:
                target_topic = topic
                phase_context = f'Phase {phase.get("phase")}: {phase.get("title")}'
                break
        if target_topic:
            break

    if not target_topic:
        raise HTTPException(status_code=404, detail=f'未找到 Day {topic_day} 的主题')

    prompt = generate_topic_materials(
        goal_title=g.title,
        topic_title=target_topic.get('title', ''),
        phase_context=phase_context,
    )
    try:
        result = chat_json([{'role': 'user', 'content': prompt}], timeout=50.0)
        return result
    except Exception as e:
        raise HTTPException(status_code=502, detail=f'AI 服务暂时不可用：{str(e)[:100]}')
