import json
from datetime import date
from urllib.parse import quote
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.goal import LearningGoal
from ..models.roadmap import Roadmap
from ..models.plan import DailyPlan
from ..models.journal import JournalEntry
from ..models.question import DailyQuestion, UserAnswer
from ..models.note import UserNote

router = APIRouter(prefix='/api/goals/{goal_id}', tags=['export'])


def _download_response(content: str, filename: str) -> Response:
    safe_name = quote(filename)
    return Response(
        content=content.encode('utf-8'),
        media_type='text/markdown; charset=utf-8',
        headers={'Content-Disposition': f"attachment; filename*=UTF-8''{safe_name}"},
    )


@router.get('/export/roadmap')
def export_roadmap(goal_id: int, db: Session = Depends(get_db)):
    g = db.query(LearningGoal).filter(LearningGoal.id == goal_id).first()
    if not g:
        raise HTTPException(404, '目标不存在')

    rm = db.query(Roadmap).filter(
        Roadmap.goal_id == goal_id, Roadmap.is_active == True
    ).order_by(Roadmap.version.desc()).first()
    if not rm:
        raise HTTPException(404, '暂无学习路线')

    content = json.loads(rm.content) if isinstance(rm.content, str) else rm.content
    phases = content.get('phases', [])

    md = f'# 学习路线：{g.title}\n\n'
    md += f'> 版本 {rm.version} | 生成于 {rm.created_at.strftime("%Y-%m-%d")}\n\n'
    md += f'{g.description}\n\n' if g.description else ''
    md += '---\n\n'

    for phase in phases:
        md += f'## Phase {phase.get("phase")}: {phase.get("title")}\n\n'
        md += f'> 预计时长：{phase.get("duration_days")} 天\n\n'
        for topic in phase.get('topics', []):
            md += f'### Day {topic.get("day")}: {topic.get("title")}\n\n'
            if topic.get('resources'):
                md += '**学习资源：**\n'
                for r in topic['resources']:
                    md += f'- {r}\n'
                md += '\n'
            if topic.get('exercises'):
                md += '**练习任务：**\n'
                for e in topic['exercises']:
                    md += f'- {e}\n'
                md += '\n'

    return _download_response(md, f'学习路线_{g.title}_v{rm.version}.md')


@router.get('/export/plan')
def export_plan(goal_id: int, target_date: str = Query(None, alias='date'), db: Session = Depends(get_db)):
    g = db.query(LearningGoal).filter(LearningGoal.id == goal_id).first()
    if not g:
        raise HTTPException(404, '目标不存在')

    qdate = target_date if target_date else str(date.today())
    p = db.query(DailyPlan).filter(
        DailyPlan.goal_id == goal_id, DailyPlan.date == qdate
    ).first()
    if not p:
        raise HTTPException(404, f'{qdate} 暂无规划')

    plan_content = json.loads(p.plan_content) if isinstance(p.plan_content, str) else p.plan_content
    tasks = plan_content.get('tasks', [])
    note = plan_content.get('note', '')

    md = f'# 学习规划：{g.title}\n\n'
    md += f'> 日期：{qdate} | 状态：{"已完成" if p.completed else "未完成"}\n\n'
    md += '---\n\n'

    for i, task in enumerate(tasks, 1):
        md += f'## 任务 {i}: {task.get("title")}\n\n'
        md += f'> 时长：{task.get("duration_min")} 分钟\n\n'
        md += f'{task.get("detail")}\n\n'

        materials = task.get('materials')
        if materials:
            if materials.get('summary'):
                md += f'### 概述\n\n{materials["summary"]}\n\n'
            if materials.get('key_concepts'):
                md += '### 核心知识点\n\n'
                for kc in materials['key_concepts']:
                    md += f'- **{kc.get("name")}**：{kc.get("explanation")}\n'
                md += '\n'
            if materials.get('content'):
                md += f'### 学习内容\n\n{materials["content"]}\n\n'
            if materials.get('example'):
                md += f'### 示例\n\n{materials["example"]}\n\n'
            if materials.get('practice'):
                md += f'### 练习\n\n{materials["practice"]}\n\n'
        md += '---\n\n'

    if note:
        md += f'> 💡 {note}\n'

    return _download_response(md, f'学习规划_{g.title}_{qdate}.md')


@router.get('/export/journal')
def export_journal(goal_id: int, db: Session = Depends(get_db)):
    g = db.query(LearningGoal).filter(LearningGoal.id == goal_id).first()
    if not g:
        raise HTTPException(404, '目标不存在')

    journals = db.query(JournalEntry).filter(
        JournalEntry.goal_id == goal_id
    ).order_by(JournalEntry.date.desc()).all()

    md = f'# 学习日志：{g.title}\n\n'
    md += f'> 共 {len(journals)} 篇 | 导出于 {date.today()}\n\n'
    md += '---\n\n'

    if not journals:
        md += '暂无学习日志记录。\n'
    else:
        for j in journals:
            md += f'## {j.date}\n\n'
            if j.duration_minutes:
                md += f'> 学习时长：{j.duration_minutes} 分钟\n\n'
            if j.content:
                md += f'### 学习内容\n\n{j.content}\n\n'
            if j.reflection:
                md += f'### 心得反思\n\n{j.reflection}\n\n'
            md += '---\n\n'

    return _download_response(md, f'学习日志_{g.title}.md')


@router.get('/export/notes')
def export_notes(goal_id: int, db: Session = Depends(get_db)):
    g = db.query(LearningGoal).filter(LearningGoal.id == goal_id).first()
    if not g:
        raise HTTPException(404, '目标不存在')

    notes = db.query(UserNote).filter(
        UserNote.goal_id == goal_id
    ).order_by(UserNote.updated_at.desc()).all()

    md = f'# 学习笔记：{g.title}\n\n'
    md += f'> 共 {len(notes)} 条 | 导出于 {date.today()}\n\n'
    md += '---\n\n'

    if not notes:
        md += '暂无学习笔记。\n'
    else:
        for n in notes:
            md += f'## {n.topic_title}\n\n'
            md += f'> 最后更新：{n.updated_at.strftime("%Y-%m-%d %H:%M")}\n\n'
            md += f'{n.content}\n\n'
            md += '---\n\n'

    return _download_response(md, f'学习笔记_{g.title}.md')


@router.get('/export/all')
def export_all(goal_id: int, db: Session = Depends(get_db)):
    """导出全部内容：路线 + 最新规划 + 日志"""
    g = db.query(LearningGoal).filter(LearningGoal.id == goal_id).first()
    if not g:
        raise HTTPException(404, '目标不存在')

    md = f'# {g.title} — 学习档案\n\n'
    md += f'> 导出于 {date.today()}\n\n'
    md += '---\n\n'

    # 路线
    rm = db.query(Roadmap).filter(
        Roadmap.goal_id == goal_id, Roadmap.is_active == True
    ).order_by(Roadmap.version.desc()).first()
    if rm:
        content = json.loads(rm.content) if isinstance(rm.content, str) else rm.content
        md += '## 学习路线\n\n'
        for phase in content.get('phases', []):
            md += f'### Phase {phase.get("phase")}: {phase.get("title")} ({phase.get("duration_days")}天)\n\n'
            for topic in phase.get('topics', []):
                md += f'- Day {topic.get("day")}: {topic.get("title")}\n'
            md += '\n'

    # 最新规划
    today = date.today()
    plan = db.query(DailyPlan).filter(
        DailyPlan.goal_id == goal_id, DailyPlan.date == today
    ).first()
    if plan:
        plan_content = json.loads(plan.plan_content) if isinstance(plan.plan_content, str) else plan.plan_content
        md += '## 今日规划\n\n'
        for t in plan_content.get('tasks', []):
            md += f'### {t.get("title")} ({t.get("duration_min")}分钟)\n\n'
            m = t.get('materials')
            if m:
                md += f'{m.get("summary", "")}\n\n'
                md += f'{m.get("content", "")}\n\n'

    # 日志
    journals = db.query(JournalEntry).filter(
        JournalEntry.goal_id == goal_id
    ).order_by(JournalEntry.date.desc()).limit(30).all()
    if journals:
        md += '## 学习日志\n\n'
        for j in journals:
            md += f'### {j.date} ({j.duration_minutes}分钟)\n\n'
            if j.content:
                md += f'{j.content}\n\n'
            if j.reflection:
                md += f'> {j.reflection}\n\n'

    # 笔记
    notes = db.query(UserNote).filter(
        UserNote.goal_id == goal_id
    ).order_by(UserNote.updated_at.desc()).all()
    if notes:
        md += '## 学习笔记\n\n'
        for n in notes:
            md += f'### {n.topic_title}\n\n'
            md += f'{n.content}\n\n'

    return _download_response(md, f'{g.title}_学习档案.md')
