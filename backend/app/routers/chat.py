from fastapi import APIRouter
from pydantic import BaseModel

from ..services.ai_service import chat
from ..services.prompt_templates import study_buddy_chat

router = APIRouter(prefix='/api/goals', tags=['chat'])


class ChatRequest(BaseModel):
    message: str
    context: str = ''
    chat_history: list[dict] = []


@router.post('/{goal_id}/chat')
def chat_with_buddy(goal_id: int, data: ChatRequest):
    goal_title = data.context.split('\n')[0] if data.context else f'目标 #{goal_id}'

    history_str = ''
    for h in data.chat_history[-10:]:
        role = '用户' if h['role'] == 'user' else 'AI 搭子'
        history_str += f'{role}: {h["content"]}\n'

    prompt = study_buddy_chat(
        goal_title=goal_title,
        task_context=data.context,
        chat_history=history_str,
        user_message=data.message,
    )

    reply = chat([{'role': 'user', 'content': prompt}])
    return {'reply': reply}
