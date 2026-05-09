import json
import re
from openai import OpenAI
from ..config import DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL

client = OpenAI(api_key=DEEPSEEK_API_KEY, base_url=DEEPSEEK_BASE_URL, timeout=60.0)


def chat(messages: list[dict], temperature: float = 0.7, timeout: float | None = None) -> str:
    """调用 DeepSeek 聊天，返回纯文本"""
    kwargs = dict(model='deepseek-chat', messages=messages, temperature=temperature)
    if timeout is not None:
        kwargs['timeout'] = timeout
    resp = client.chat.completions.create(**kwargs)
    return resp.choices[0].message.content or ''


def chat_json(messages: list[dict], temperature: float = 0.7, timeout: float | None = None) -> dict:
    """调用 DeepSeek 聊天，提取 JSON 返回"""
    kwargs = dict(model='deepseek-chat', messages=messages, temperature=temperature)
    if timeout is not None:
        kwargs['timeout'] = timeout
    kwargs['response_format'] = {'type': 'json_object'}
    resp = client.chat.completions.create(**kwargs)
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
    # 重试一次，强调 JSON 格式
    messages.append({'role': 'assistant', 'content': text})
    messages.append({'role': 'user', 'content': '请严格按 JSON 格式重新输出，不要添加任何额外文字。'})
    text2 = chat(messages, temperature=0.3, timeout=timeout)
    match2 = re.search(r'\{[\s\S]*\}', text2)
    if match2:
        return json.loads(match2.group())
    raise ValueError(f'AI 返回无法解析为 JSON: {text2[:200]}')
