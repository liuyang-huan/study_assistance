import os
import pdfplumber
from docx import Document
from pypdf import PdfReader

ALLOWED_EXTENSIONS = {'.pdf', '.docx'}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB


def extract_text_from_pdf(file_path: str, start_page: int | None = None, end_page: int | None = None) -> dict:
    pages = []
    full_text_parts = []
    try:
        with pdfplumber.open(file_path) as pdf:
            total = len(pdf.pages)
            # 页码范围切片（pdf.pages 是 0-indexed 列表）
            page_slice = pdf.pages
            slice_start = 0
            if start_page is not None:
                slice_start = max(0, start_page - 1)
                page_slice = page_slice[slice_start:]
            if end_page is not None:
                page_slice = page_slice[:end_page - slice_start]

            for i, page in enumerate(page_slice, slice_start + 1):
                text = page.extract_text() or ''
                pages.append({"page_num": i, "text": text})
                full_text_parts.append(text)
    except Exception as e:
        raise ValueError(f"PDF解析失败: {str(e)}")

    full_text = '\n'.join(full_text_parts)
    return {"pages": pages, "full_text": full_text, "total_pages": len(pages)}


def extract_toc_from_pdf_outlines(file_path: str) -> list[dict] | None:
    """从 PDF 内嵌书签/大纲提取目录（秒级，不需要提取全文）。

    返回带 page_start 的 TOC 条目列表，如果没有书签则返回 None。
    """
    try:
        reader = PdfReader(file_path)
        root = reader.outline
        if not root:
            return None

        entries = []

        def _walk(items, level=1):
            for item in items:
                if isinstance(item, list):
                    _walk(item, level + 1)
                else:
                    title = (getattr(item, 'title', '') or getattr(item, '/Title', '')).strip()
                    if not title or len(title) < 3:
                        continue
                    page_num = None
                    try:
                        # pypdf Destination: page attribute
                        page = getattr(item, 'page', None) or getattr(item, '/Page', None)
                        if page is not None:
                            page_num = reader.get_page_number(page) + 1
                    except Exception:
                        pass
                    entries.append({
                        'title': title,
                        'level': level,
                        'page_start': page_num,
                    })

        _walk(root)
        return entries if len(entries) >= 3 else None
    except Exception:
        return None


def map_toc_to_pages(pages: list[dict], toc_entries: list[dict]) -> list[dict]:
    """将 TOC 条目映射到 PDF 页码。

    跳过目录页区域（前 10% 或至少前 3 页），优先在正文区域匹配标题。
    """
    total_pages = len(pages)
    toc_end = max(3, int(total_pages * 0.1))

    result = []
    for idx, entry in enumerate(toc_entries):
        title = entry['title'].strip()
        if len(title) < 4:
            result.append({**entry, 'page_start': None})
            continue

        title_no_spaces = ''.join(title.split())
        all_matches = []
        for p in pages:
            page_text_no_spaces = ''.join(p['text'].split())
            if len(title_no_spaces) >= 6 and title_no_spaces in page_text_no_spaces:
                all_matches.append(p['page_num'])

        # 优先取目录区域之后的匹配（真正的正文页）
        real_matches = [m for m in all_matches if m > toc_end]
        if real_matches:
            page_start = real_matches[0]
        elif all_matches:
            page_start = all_matches[-1]  # 回退：取最后一个匹配
        else:
            # 估算：按比例分配页面
            ratio = (idx + 1) / len(toc_entries)
            page_start = max(toc_end + 1, int(toc_end + ratio * (total_pages - toc_end)))

        result.append({**entry, 'page_start': page_start})

    # 计算 page_end
    for i, entry in enumerate(result):
        if i + 1 < len(result):
            next_start = result[i + 1].get('page_start')
            if next_start and next_start > (entry.get('page_start') or 0):
                entry['page_end'] = next_start - 1
            else:
                entry['page_end'] = entry.get('page_start', total_pages)
        else:
            entry['page_end'] = total_pages

    return result


def extract_text_from_docx(file_path: str) -> dict:
    try:
        doc = Document(file_path)
        paragraphs = [p.text for p in doc.paragraphs]
        full_text = '\n'.join(paragraphs)
        return {"full_text": full_text, "total_pages": 0}
    except Exception as e:
        raise ValueError(f"DOCX解析失败: {str(e)}")


def chunk_text(text: str, max_chars: int = 8000, overlap: int = 200) -> list[str]:
    paragraphs = text.split('\n')
    chunks = []
    current = []
    current_len = 0

    for para in paragraphs:
        para_len = len(para) + 1
        if current_len + para_len > max_chars and current:
            chunks.append('\n'.join(current))
            overlap_text = []
            overlap_len = 0
            for p in reversed(current):
                if overlap_len + len(p) > overlap and overlap_text:
                    break
                overlap_text.insert(0, p)
                overlap_len += len(p) + 1
            current = overlap_text
            current_len = overlap_len
        current.append(para)
        current_len += para_len

    if current:
        chunks.append('\n'.join(current))
    return chunks


def split_text_by_toc(full_text: str, toc_entries: list[dict]) -> list[dict]:
    lines = full_text.split('\n')
    sections = []
    prev_end = 0

    for i, entry in enumerate(toc_entries):
        title = entry['title']
        start_line = _find_section_start(lines, title, prev_end)

        if i + 1 < len(toc_entries):
            next_title = toc_entries[i + 1]['title']
            end_line = _find_section_start(lines, next_title, max(start_line, prev_end))
            if end_line <= start_line:
                end_line = start_line + 1  # 至少取一行，避免空内容
        else:
            end_line = len(lines)

        section_text = '\n'.join(lines[start_line:end_line]).strip()
        sections.append({
            "section_index": i,
            "title": title,
            "level": entry.get('level', 1),
            "content": section_text if section_text else title,  # 空内容时至少用标题
        })
        prev_end = end_line

    return sections


def build_toc_from_regex(full_text: str) -> list[dict] | None:
    """Build TOC structure programmatically by scanning for Chapter/Part headings.

    Supports English (Chapter 1 / Part II) and Chinese (第一章 / 第1章 / 第一部分) patterns.
    Returns a list of TOC entries if enough structure is found (>=3 chapters), else None.
    """
    import re
    lines = full_text.split('\n')

    chapter_matches = []
    for i, line in enumerate(lines):
        stripped = line.strip()
        if not stripped or len(stripped) > 200:
            continue
        # English: "Chapter N" or "Chapter N: Title" or "CHAPTER N"
        m = re.match(
            r'^(Chapter|CHAPTER)\s+(\d+|[IVX]+)\b',
            stripped, re.IGNORECASE
        )
        if m and 10 < len(stripped) < 200:
            num_str = m.group(2)
            chapter_num = int(num_str) if num_str.isdigit() else _roman_to_int(num_str)
            chapter_matches.append({'line': i, 'title': stripped, 'chapter_num': chapter_num})
            continue
        # English: "Part II: Title" or "Part 3"
        if re.match(r'^(Part|PART)\s+(\d+|[IVX]+)\b', stripped, re.IGNORECASE) and len(stripped) < 200:
            chapter_matches.append({'line': i, 'title': stripped, 'chapter_num': None})
            continue
        # Chinese: "第X章" (Arabic digits) — "第1章 引言", "第12章 结论"
        m_zh = re.match(r'^第\s*(\d+)\s*章\b', stripped)
        if m_zh and 6 < len(stripped) < 200:
            chapter_matches.append({'line': i, 'title': stripped, 'chapter_num': int(m_zh.group(1))})
            continue
        # Chinese: "第一章" through "第二十章" etc (Chinese numerals in chapter context)
        m_zh2 = re.match(r'^(第[一二三四五六七八九十百千]+[章节篇])', stripped)
        if m_zh2 and 6 < len(stripped) < 200:
            chapter_matches.append({'line': i, 'title': stripped, 'chapter_num': None})
            continue
        # Chinese: "第一部分", "第二篇", "第X节"
        m_zh3 = re.match(r'^(第[一二三四五六七八九十百千\d]+[部分篇节])\b', stripped)
        if m_zh3 and 8 < len(stripped) < 200:
            chapter_matches.append({'line': i, 'title': stripped, 'chapter_num': None})
            continue
        # Numbered top-level: "1. Introduction", "一、概述"
        if re.match(r'^(\d+|[一二三四五六七八九十]+)[\.、]\s*\S', stripped) and 8 < len(stripped) < 150:
            chapter_matches.append({'line': i, 'title': stripped, 'chapter_num': None})

    if len(chapter_matches) < 3:
        return None

    # Deduplicate: for each chapter number, keep only the first occurrence
    seen_chapters = set()
    deduped = []
    for cm in chapter_matches:
        key = cm['chapter_num']
        if key is None or key not in seen_chapters:
            seen_chapters.add(key)
            deduped.append(cm)

    deduped.sort(key=lambda x: x['line'])

    entries = []
    for idx, cm in enumerate(deduped):
        entries.append({'title': cm['title'], 'level': 1})

        start_line = cm['line'] + 1
        end_line = deduped[idx + 1]['line'] if idx + 1 < len(deduped) else len(lines)

        for j in range(start_line, min(end_line, start_line + 200)):
            stripped = lines[j].strip()
            if not stripped or len(stripped) > 150:
                continue
            # Numbered subsection: "1.1 Title", "3.2.1 Title"
            if re.match(r'^\d+\.\d+\s+\S', stripped) and 10 < len(stripped) < 150:
                entries.append({'title': stripped, 'level': 2})
            # Chinese numbered subsection: "一、xxx", "(一) xxx"
            elif re.match(r'^[（(]?[一二三四五六七八九十]+[）)]?\s*\S', stripped) and 6 < len(stripped) < 150:
                entries.append({'title': stripped, 'level': 2})
            # Bullet/dash items that look like headings
            elif re.match(r'^[•\-–]\s+\S', stripped) and 10 < len(stripped) < 150:
                entries.append({'title': stripped, 'level': 3})

    return entries


def _roman_to_int(roman: str) -> int:
    """Convert Roman numeral string to integer."""
    values = {'I': 1, 'V': 5, 'X': 10, 'L': 50, 'C': 100}
    result = 0
    prev = 0
    for c in reversed(roman.upper()):
        v = values.get(c, 0)
        if v >= prev:
            result += v
        else:
            result -= v
        prev = v
    return result


def extract_heading_lines(full_text: str) -> str:
    """Extract lines that look like chapter/section headings from the entire book text.

    Returns a formatted string of heading candidates for AI to structure into a TOC.
    This ensures all chapters are captured even for very large books.
    """
    import re
    lines = full_text.split('\n')
    heading_lines = []
    for i, line in enumerate(lines):
        stripped = line.strip()
        if not stripped or len(stripped) > 200:
            continue
        # English: "Chapter N" / "Chapter N: Title" / "CHAPTER N"
        if re.match(r'^(Chapter|CHAPTER)\s+(\d+|[IVX]+)\b', stripped):
            heading_lines.append(f'[line {i}] {stripped}')
        # English: "Part II" / "Part 3"
        elif re.match(r'^(Part|PART)\s+(\d+|[IVX]+)\b', stripped):
            heading_lines.append(f'[line {i}] {stripped}')
        # Chinese: "第X章", "第X节", "第X篇", "第X部分"
        elif re.match(r'^第[\d一二三四五六七八九十百千]+\s*[章节篇部分]', stripped):
            heading_lines.append(f'[line {i}] {stripped}')
        # Numbered sections: "1.1 Title", "3.2.1 Title"
        elif re.match(r'^\d+\.\d+\s+\S', stripped) and 10 < len(stripped) < 150:
            heading_lines.append(f'[line {i}] {stripped}')
        # Chinese numbered: "一、xxx", "(一) xxx"
        elif re.match(r'^[（(]?[一二三四五六七八九十]+[）)]?[、\s]\S', stripped) and 6 < len(stripped) < 150:
            heading_lines.append(f'[line {i}] {stripped}')
        # Markdown-style: "## Section" or "# Chapter"
        elif re.match(r'^#{1,3}\s+\S', stripped) and 10 < len(stripped) < 150:
            heading_lines.append(f'[line {i}] {stripped}')

    result = '\n'.join(heading_lines)
    # Cap at ~30k chars to avoid token overflow in AI prompt
    if len(result) > 30000:
        result = result[:30000] + '\n... (truncated)'
    return result


def sample_text_for_ai(full_text: str, max_samples: int = 5, chunk_size: int = 4000) -> str:
    """均匀采样文本 — 从书的开头、中间、结尾各取几段，让 AI 看到全书结构。"""
    paragraphs = full_text.split('\n')
    total = len(paragraphs)
    if total == 0:
        return ''

    # 取开头 N 段
    head = paragraphs[:min(20, total)]
    # 取结尾 N 段
    tail = paragraphs[max(0, total - 10):]
    # 均匀采样中间点
    mid_indices = []
    step = max(1, total // (max_samples + 1))
    for k in range(1, max_samples + 1):
        idx = k * step
        if idx < total:
            mid_indices.append(idx)

    mid_samples = []
    for idx in mid_indices:
        end = min(total, idx + 15)
        mid_samples.append('\n'.join(paragraphs[idx:end]))

    parts = ['\n'.join(head)]
    parts.extend(mid_samples)
    parts.append('\n'.join(tail))
    return '\n\n---\n\n'.join(parts)


def _find_section_start(lines: list[str], title: str, from_line: int = 0) -> int:
    """在文本中查找章节标题所在行号。

    对于中文书籍，PDF提取可能导致空格/换行差异，所以多层次匹配：
    1. 精确行匹配（忽略首尾空白）
    2. 去空白后匹配（忽略所有空白字符）
    3. 标题前N个有效字符的模糊匹配
    4. 回退：按比例估算位置
    """
    title_clean = title.strip()
    title_no_spaces = ''.join(title_clean.split())

    # 策略1：精确行匹配
    for i in range(from_line, len(lines)):
        line = lines[i].strip()
        if not line:
            continue
        if line == title_clean:
            return i

    # 策略2：行内容包含标题（如 "第一章  引言" 匹配 "第一章 引言"）
    for i in range(from_line, len(lines)):
        line = lines[i].strip()
        if not line:
            continue
        line_no_spaces = ''.join(line.split())
        if len(title_no_spaces) >= 6 and line_no_spaces == title_no_spaces:
            return i

    # 策略3：标题是行的一部分（title in line）
    if len(title_clean) >= 6:
        for i in range(from_line, len(lines)):
            line = lines[i].strip()
            if not line:
                continue
            if title_clean in line:
                return i

    # 策略4：取标题前12个字符做子串匹配
    title_short = title_no_spaces[:12]
    if len(title_short) >= 6:
        for i in range(from_line, len(lines)):
            line = lines[i].strip()
            if not line:
                continue
            line_no_spaces = ''.join(line.split())
            if title_short in line_no_spaces:
                return i

    # 最终回退：按比例估算（比 from_line 原值更合理）
    # 假设标题大致均匀分布，用标题序号在全文中的位置比例估算
    return from_line
