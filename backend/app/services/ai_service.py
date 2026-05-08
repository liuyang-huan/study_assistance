import json
import re
from openai import OpenAI
from ..config import DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL

client = OpenAI(api_key=DEEPSEEK_API_KEY, base_url=DEEPSEEK_BASE_URL, timeout=60.0)


def chat(messages: list[dict], temperature: float = 0.7) -> str:
    """调用 DeepSeek 聊天，返回纯文本"""
    resp = client.chat.completions.create(
        model='deepseek-chat',
        messages=messages,
        temperature=temperature,
    )
    return resp.choices[0].message.content or ''


def chat_json(messages: list[dict], temperature: float = 0.7) -> dict:
    """调用 DeepSeek 聊天，提取 JSON 返回"""
    resp = client.chat.completions.create(
        model='deepseek-chat',
        messages=messages,
        temperature=temperature,
        response_format={'type': 'json_object'},
    )
    text = resp.choices[0].message.content or ''
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    # 降级：从文本中提取 JSON 块
    match = re.search(r'\{[\s\S]*\}', text)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass
    raise ValueError(f'AI 返回无法解析为 JSON: {text[:200]}')
