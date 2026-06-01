from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.global_note import GlobalNote
from ..schemas.api import GlobalNoteCreate, GlobalNoteUpdate, GlobalNoteResponse

router = APIRouter(prefix='/api/notes', tags=['global_notes'])


def _note_to_response(n: GlobalNote) -> dict:
    return {
        'id': n.id,
        'content': n.content,
        'created_at': n.created_at.isoformat(),
        'updated_at': n.updated_at.isoformat(),
    }


@router.get('', response_model=list[GlobalNoteResponse])
def list_notes(db: Session = Depends(get_db)):
    notes = db.query(GlobalNote).order_by(GlobalNote.created_at.desc()).all()
    return [_note_to_response(n) for n in notes]


@router.post('', response_model=GlobalNoteResponse)
def create_note(data: GlobalNoteCreate, db: Session = Depends(get_db)):
    note = GlobalNote(content=data.content)
    db.add(note)
    db.commit()
    db.refresh(note)
    return _note_to_response(note)


@router.put('/{note_id}', response_model=GlobalNoteResponse)
def update_note(note_id: int, data: GlobalNoteUpdate, db: Session = Depends(get_db)):
    note = db.query(GlobalNote).filter(GlobalNote.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail='笔记不存在')
    note.content = data.content
    db.commit()
    db.refresh(note)
    return _note_to_response(note)


@router.delete('/{note_id}')
def delete_note(note_id: int, db: Session = Depends(get_db)):
    note = db.query(GlobalNote).filter(GlobalNote.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail='笔记不存在')
    db.delete(note)
    db.commit()
    return {'ok': True}
