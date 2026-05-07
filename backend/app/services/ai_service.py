import json
import re
from openai import OpenAI
from ..config import DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL

client = OpenAI(api_key=DEEPSEEK_API_KEY, base_url=DEEPSEEK_BASE_URL)


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
    text = chat(messages, temperature)
    # 尝试提取 JSON 块
    match = re.search(r'\{[\s\S]*\}', text)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass
    # 重试一次，强调 JSON 格式
    messages.append({'role': 'assistant', 'content': text})
    messages.append({'role': 'user', 'content': '请严格按 JSON 格式重新输出，不要添加任何额外文字。'})
    text2 = chat(messages, temperature=0.3)
    match2 = re.search(r'\{[\s\S]*\}', text2)
    if match2:
        return json.loads(match2.group())
    raise ValueError(f'AI 返回无法解析为 JSON: {text2[:200]}')
