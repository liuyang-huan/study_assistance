import json
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from ..services.ai_service import chat, chat_stream
from ..services.prompt_templates import study_buddy_chat

router = APIRouter(prefix='/api/goals', tags=['chat'])


class ChatRequest(BaseModel):
    message: str
    context: str = ''
    chat_history: list[dict] = []
    teaching_style: str = ''


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
        teaching_style=data.teaching_style,
    )

    reply = chat([{'role': 'user', 'content': prompt}])
    return {'reply': reply}


@router.post('/{goal_id}/chat/stream')
def chat_with_buddy_stream(goal_id: int, data: ChatRequest):
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
        teaching_style=data.teaching_style,
    )

    def generate():
        try:
            for token in chat_stream([{'role': 'user', 'content': prompt}]):
                yield f"data: {json.dumps({'token': token}, ensure_ascii=False)}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)}, ensure_ascii=False)}\n\n"

    return StreamingResponse(generate(), media_type='text/event-stream')
