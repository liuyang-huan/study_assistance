from datetime import datetime, timezone, date
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.todo import TodoTask
from ..schemas.api import TodoCreate, TodoUpdate, TodoResponse

router = APIRouter(prefix='/api/todos', tags=['todos'])


def _todo_to_response(t: TodoTask) -> dict:
    return {
        'id': t.id,
        'title': t.title,
        'description': t.description,
        'deadline': t.deadline,
        'completed': t.completed,
        'completed_at': t.completed_at.isoformat() if t.completed_at else None,
        'created_at': t.created_at.isoformat(),
        'updated_at': t.updated_at.isoformat(),
    }


@router.get('', response_model=list[TodoResponse])
def list_todos(
    status: str | None = Query(None, description='active | completed | all'),
    db: Session = Depends(get_db),
):
    q = db.query(TodoTask)
    if status == 'active':
        q = q.filter(TodoTask.completed == False)
    elif status == 'completed':
        q = q.filter(TodoTask.completed == True)
    # 'all' or None returns everything
    q = q.order_by(
        TodoTask.completed.asc(),       # 未完成在前
        TodoTask.deadline.asc().nullslast(),  # 截止日期近的在前
        TodoTask.created_at.desc(),
    )
    return [_todo_to_response(t) for t in q.all()]


@router.post('', response_model=TodoResponse)
def create_todo(data: TodoCreate, db: Session = Depends(get_db)):
    todo = TodoTask(
        title=data.title,
        description=data.description or None,
        deadline=data.deadline,
    )
    db.add(todo)
    db.commit()
    db.refresh(todo)
    return _todo_to_response(todo)


@router.put('/{todo_id}', response_model=TodoResponse)
def update_todo(todo_id: int, data: TodoUpdate, db: Session = Depends(get_db)):
    todo = db.query(TodoTask).filter(TodoTask.id == todo_id).first()
    if not todo:
        raise HTTPException(status_code=404, detail='待办事项不存在')

    if data.title is not None:
        todo.title = data.title
    if data.description is not None:
        todo.description = data.description
    if data.deadline is not None:
        todo.deadline = data.deadline
    if data.completed is not None:
        todo.completed = data.completed
        if data.completed:
            todo.completed_at = datetime.now(timezone.utc)
        else:
            todo.completed_at = None

    db.commit()
    db.refresh(todo)
    return _todo_to_response(todo)


@router.delete('/{todo_id}')
def delete_todo(todo_id: int, db: Session = Depends(get_db)):
    todo = db.query(TodoTask).filter(TodoTask.id == todo_id).first()
    if not todo:
        raise HTTPException(status_code=404, detail='待办事项不存在')
    db.delete(todo)
    db.commit()
    return {'ok': True}
