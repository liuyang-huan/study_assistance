def detect_language(text: str) -> str:
    """字符统计启发式语言检测。返回 'zh' | 'ja' | 'en' | 'unknown'。"""
    sample = text[:5000].strip()
    if not sample:
        return 'unknown'

    total = len(sample)
    cjk = sum(1 for c in sample if '一' <= c <= '鿿' or '㐀' <= c <= '䶿')
    hiragana = sum(1 for c in sample if '぀' <= c <= 'ゟ')
    katakana = sum(1 for c in sample if '゠' <= c <= 'ヿ')

    if (hiragana + katakana) / total > 0.05:
        return 'ja'
    if cjk / total > 0.15:
        return 'zh'
    return 'en'


def needs_translation(lang: str | None) -> bool:
    """非中文且非未知的语言需要翻译。"""
    return lang is not None and lang not in ('zh', 'unknown')
