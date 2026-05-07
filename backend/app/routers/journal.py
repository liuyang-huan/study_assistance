import json
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.goal import LearningGoal
from ..models.journal import JournalEntry
from ..schemas.api import JournalCreate, JournalResponse

router = APIRouter(prefix='/api/goals/{goal_id}', tags=['journal'])


def _journal_to_response(j: JournalEntry) -> dict:
    return {'id': j.id, 'goal_id': j.goal_id, 'date': str(j.date),
            'content': j.content, 'reflection': j.reflection,
            'duration_minutes': j.duration_minutes, 'created_at': j.created_at.isoformat()}


@router.get('/journal', response_model=JournalResponse | dict)
def get_journal(goal_id: int, target_date: str = Query(None, alias='date'), db: Session = Depends(get_db)):
    if target_date:
        j = db.query(JournalEntry).filter(
            JournalEntry.goal_id == goal_id, JournalEntry.date == target_date
        ).first()
        if not j:
            return {}
        return _journal_to_response(j)
    else:
        j = db.query(JournalEntry).filter(
            JournalEntry.goal_id == goal_id, JournalEntry.date == date.today()
        ).first()
        if not j:
            return {}
        return _journal_to_response(j)


@router.post('/journal', response_model=JournalResponse)
def save_journal(goal_id: int, data: JournalCreate, db: Session = Depends(get_db)):
    g = db.query(LearningGoal).filter(LearningGoal.id == goal_id).first()
    if not g:
        raise HTTPException(status_code=404, detail='目标不存在')

    today = date.today()
    j = db.query(JournalEntry).filter(
        JournalEntry.goal_id == goal_id, JournalEntry.date == today
    ).first()

    if j:
        j.content = data.content
        j.reflection = data.reflection
        j.duration_minutes = data.duration_minutes
    else:
        j = JournalEntry(
            goal_id=goal_id, date=today,
            content=data.content, reflection=data.reflection,
            duration_minutes=data.duration_minutes,
        )
        db.add(j)
    db.commit()
    db.refresh(j)
    return _journal_to_response(j)


@router.get('/journal/history', response_model=list[JournalResponse])
def journal_history(goal_id: int, db: Session = Depends(get_db)):
    entries = db.query(JournalEntry).filter(
        JournalEntry.goal_id == goal_id
    ).order_by(JournalEntry.date.desc()).limit(30).all()
    return [_journal_to_response(e) for e in entries]
