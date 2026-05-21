from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session
from urllib.parse import quote

from ..database import get_db
from ..models.goal import LearningGoal
from ..models.note import UserNote
from ..schemas.api import NoteCreate, NoteUpdate, NoteResponse

router = APIRouter(prefix='/api/goals/{goal_id}', tags=['notes'])


def _note_to_response(n: UserNote) -> dict:
    return {
        'id': n.id,
        'goal_id': n.goal_id,
        'topic_title': n.topic_title,
        'content': n.content,
        'created_at': n.created_at.isoformat(),
        'updated_at': n.updated_at.isoformat(),
    }


@router.get('/notes', response_model=list[NoteResponse])
def list_notes(
    goal_id: int,
    topic_title: str = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(UserNote).filter(UserNote.goal_id == goal_id)
    if topic_title:
        q = q.filter(UserNote.topic_title == topic_title)
    notes = q.order_by(UserNote.updated_at.desc()).all()
    return [_note_to_response(n) for n in notes]


@router.post('/notes', response_model=NoteResponse)
def save_note(goal_id: int, data: NoteCreate, db: Session = Depends(get_db)):
    g = db.query(LearningGoal).filter(LearningGoal.id == goal_id).first()
    if not g:
        raise HTTPException(status_code=404, detail='目标不存在')

    existing = db.query(UserNote).filter(
        UserNote.goal_id == goal_id,
        UserNote.topic_title == data.topic_title,
    ).first()

    if existing:
        existing.content = data.content
        db.commit()
        db.refresh(existing)
        return _note_to_response(existing)

    note = UserNote(goal_id=goal_id, topic_title=data.topic_title, content=data.content)
    db.add(note)
    db.commit()
    db.refresh(note)
    return _note_to_response(note)


@router.delete('/notes/{note_id}')
def delete_note(goal_id: int, note_id: int, db: Session = Depends(get_db)):
    note = db.query(UserNote).filter(
        UserNote.id == note_id,
        UserNote.goal_id == goal_id,
    ).first()
    if not note:
        raise HTTPException(status_code=404, detail='笔记不存在')
    db.delete(note)
    db.commit()
    return {'ok': True}
