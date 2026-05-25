from datetime import date


def _style_instruction(style: str = '') -> str:
    """根据用户偏好的教学风格生成指令"""
    if not style or style == 'default':
        return ''
    styles = {
        'analogy': '【教学风格要求】请多用生活中的类比和比喻来解释概念，让抽象的知识变得具体可感，像给朋友聊天一样自然。',
        'feynman': '【教学风格要求】请用费曼学习法：用最简单直白的语言解释，假装听者是零基础的小白，避免任何术语堆砌，每个概念都用"说白了就是..."的方式讲清楚。',
        'rigorous': '【教学风格要求】请用学术严谨的风格，注重概念的精确性和知识体系的完整性，给出权威的参考来源。逻辑推导要严密。',
        'code-heavy': '【教学风格要求】请大量使用实际代码示例和动手练习来说明概念，让用户通过写代码来理解知识点，每个概念都配可运行的代码演示。',
    }
    return f'\n{styles.get(style, "")}'


def generate_roadmap(goal_title: str, goal_description: str, skill_level: str = '', teaching_style: str = '') -> str:
    return f"""你是一个专业的学习规划师。用户想学习：{goal_title}。
用户描述：{goal_description or '无补充描述'}。
当前基础：{skill_level or '零基础/未说明'}。{_style_instruction(teaching_style)}

请为这个学习目标生成一份详细的学习路线，按阶段划分。阶段数量根据目标难度合理设定（一般4-8个阶段）。
每个阶段需要包含：
- 阶段编号、名称、持续天数
- 该阶段每天的学习主题（day从1开始全局编号）
- 每天推荐的学习资源（书籍章节、视频、文章等）
- 每天的练习任务

重要：严格以 JSON 格式返回，不要包含任何其他文字：
{{"phases": [{{"phase": 1, "title": "阶段名称", "duration_days": 7,
"topics": [{{"day": 1, "title": "学习主题", "resources": ["资源1", "资源2"], "exercises": ["练习1"]}}]
}}]}}"""


def generate_daily_plan(goal_title: str, roadmap_summary: str, current_phase: str, date_str: str,
                        recent_journals: str = '', recent_evaluations: str = '', teaching_style: str = '') -> str:
    return f"""用户正在学习：{goal_title}。{_style_instruction(teaching_style)}
学习路线概要：{roadmap_summary}
当前所处阶段：{current_phase}
目标日期：{date_str}

近期学习日志：{recent_journals or '暂无'}
近期问答表现：{recent_evaluations or '暂无'}

请为 {date_str} 生成当天的学习规划（2-3个任务，总时长不超过3小时）。每个任务的材料要讲深讲透。

【重要】每个 task 的 materials 必须包含以下丰富内容：

- summary: 2-3句话概述本节内容
- learning_objectives: 3-5条学完后应掌握的能力
- key_concepts: 3-5个核心知识点，每个2-3句话通俗解释
- content: 800-1500字的Markdown格式学习内容，必须包含 ## 基础概念、## 深入理解、## 实际应用、## 常见误区 四个子章节
- examples: 2-3个递进示例（基础→进阶→综合），每个含 title/description/code
- practice_questions: 2-3道练习题，每题含 question/hint

返回 JSON：
{{"tasks": [{{
  "title": "任务名称",
  "duration_min": 45,
  "detail": "一句话描述",
  "materials": {{
    "summary": "2-3句话概述",
    "learning_objectives": ["学完后能..."],
    "key_concepts": [{{"name": "概念名", "explanation": "2-3句话解释"}}],
    "content": "## 基础概念\\n...\\n\\n## 深入理解\\n...\\n\\n## 实际应用\\n...\\n\\n## 常见误区\\n...",
    "examples": [{{"title": "示例名", "description": "说明", "code": "内容"}}],
    "practice_questions": [{{"question": "题目", "hint": "思路提示"}}]
  }}
}}], "note": "当日学习提示"}}"""


def generate_questions(goal_title: str, current_topic: str, difficulty: str = 'medium',
                       learned_topics: list[str] | None = None,
                       review_topics: list[str] | None = None,
                       previous_questions: list[str] | None = None,
                       teaching_style: str = '') -> str:
    learned_text = ''
    if learned_topics:
        learned_text = '\n用户已学过的知识点：\n' + '\n'.join(f'  - {t}' for t in learned_topics)
    review_text = ''
    if review_topics:
        review_text = '\n【必须回顾】请务必包含 1-2 道回顾以下旧知识点的题目：\n' + '\n'.join(f'  - {t}' for t in review_topics)
    avoid_text = ''
    if previous_questions:
        avoid_text = '\n【重要】以下问题用户已经回答过，请勿重复出题：\n' + '\n'.join(f'  - {q}' for q in previous_questions)
    return f"""用户正在学习：{goal_title}。{_style_instruction(teaching_style)}
当前学习主题：{current_topic}。
难度要求：{difficulty}{learned_text}{review_text}{avoid_text}

请生成 3-4 个问题，分为两类：
- 1-2 道「新学」题：检测对当前主题的理解，从基础到深入
- 1-2 道「回顾」题：检测对回顾列表中旧知识点的掌握程度

每个问题需标记 type 字段（"new" 或 "review"）。

返回 JSON：
{{"questions": [{{"question": "问题内容", "expected_answer": "参考答案要点", "difficulty": "easy/medium/hard", "type": "new"}}]}}"""


def evaluate_answer(goal_title: str, question: str, expected_answer: str, user_answer: str) -> str:
    return f"""用户正在学习：{goal_title}。
问题：{question}
参考答案要点：{expected_answer}
用户回答：{user_answer}

请评估用户回答的质量，给出：
- 正确性评分（1-10）
- 正确性说明
- 理解深度评估
- 学习建议
- 是否需要调整学习路线（true/false，如果用户明显没掌握当前内容或明显超前，则建议调整）
- 满分标准答案：针对这道题，给出一个完整、透彻的满分答案，涵盖所有关键知识点，可作为用户的学习参考

返回 JSON：
{{"score": 8, "correctness": "评估说明", "depth": "理解深度", "suggestion": "学习建议", "need_adjust": false, "model_answer": "满分标准答案的完整内容"}}"""


def generate_topic_materials(goal_title: str, topic_title: str, phase_context: str, teaching_style: str = '') -> str:
    return f"""你是一位资深技术导师。用户正在学习：{goal_title}。{_style_instruction(teaching_style)}
当前学习主题：{topic_title}
所在阶段：{phase_context}

请为这个主题生成一份精炼的学习材料。控制总长度，突出重点。

content 正文 400-600 字，按以下结构组织（用 Markdown 二级标题）：
  ## 基础概念 — 用通俗语言解释核心概念
  ## 深入理解 — 剖析原理和设计思路
  ## 实际应用 — 真实场景中的使用方式
  ## 常见误区 — 1-2 个初学者常犯的错误

examples 给 1-2 个由浅入深的示例，每个含 title/description/code。

practice_questions 给 1-2 道练习题，每题含 question/hint。
key_concepts 给 2-3 个核心知识点。
learning_objectives 给 2-3 条。

返回 JSON（不要 Markdown 代码块标记）：
{{
  "title": "{topic_title}",
  "duration_min": 45,
  "detail": "一句话描述",
  "materials": {{
    "summary": "本节概述（1-2句话）",
    "learning_objectives": ["学完后能..."],
    "key_concepts": [{{"name": "概念名", "explanation": "2-3句话解释"}}],
    "content": "## 基础概念\\n...\\n\\n## 深入理解\\n...\\n\\n## 实际应用\\n...\\n\\n## 常见误区\\n...",
    "examples": [{{"title": "示例标题", "description": "简要说明", "code": "代码或详细内容"}}],
    "practice_questions": [{{"question": "题目", "hint": "思路提示"}}]
  }}
}}"""


def study_buddy_chat(goal_title: str, task_context: str, chat_history: str, user_message: str, teaching_style: str = '') -> str:
    return f"""你是一个友好的 AI 学习搭子，正在陪用户一起学习。{_style_instruction(teaching_style)}

用户学习目标：{goal_title}
当前学习内容：{task_context or '未指定具体内容'}
对话历史：
{chat_history or '（新对话）'}

用户说：{user_message}

请用亲切、鼓励的语气回答用户的问题。你是学习伙伴，不是老师，所以：
- 用通俗易懂的语言解释，像朋友聊天一样
- 可以给出具体代码示例或学习技巧
- 适当鼓励用户，保持积极的学习氛围
- 如果用户问的问题不清晰，友好地请用户澄清
- 回答要透彻深入，把知识点讲清楚讲明白，不要怕长。可以充分展开解释、举例、类比，让用户真正理解。一般不超过3000字
- 可以适当使用 Markdown 格式（代码块、加粗等）

直接回答用户的问题即可，不要加前缀标签。"""


def adjust_roadmap(current_roadmap: str, goal_title: str, progress_summary: str,
                    weak_points: str = '', strengths: str = '', teaching_style: str = '') -> str:
    return f"""用户正在学习：{goal_title}。{_style_instruction(teaching_style)}
当前学习路线：{current_roadmap}
近期学习情况总结：{progress_summary}
薄弱环节：{weak_points or '无特别薄弱环节'}
掌握较好的部分：{strengths or '暂无'}

请根据用户实际学习情况调整后续阶段（保持已完成阶段不变）。
- 如果用户掌握得好，可以适当加快节奏或增加深度
- 如果存在薄弱环节，应在后续阶段中增加复习巩固内容
- 保持原有 JSON 结构

返回完整的学习路线 JSON（包含所有阶段，结构不变）：
{{"phases": [...]}}"""


def extract_toc_from_book(book_title: str, full_text_sample: str) -> str:
    return f"""你是一位图书分析专家。请分析以下书籍文本，提取其章节目录结构。

    书名：{book_title}

    【重要】下方===== 全书章节标题行汇总 =====部分包含了从全书各处提取的章节标题行（标注了行号）。
    这些标题行覆盖了整本书的所有章节。你必须基于这些标题行来识别所有的 Chapter 和 Part，
    确保不要遗漏任何一个章节。开头的文本内容仅用于补充了解章节内的子结构。

    请提取这本书的完整章节目录结构。每个条目包含：
    - title: 章节/节的标题（只保留实际的章节标题，过滤掉"前言""致谢""参考文献"等非主体内容）
    - level: 层级（1=章/Part, 2=节, 3=小节）

    务必包含"全书章节标题行汇总"中出现的每一个 Chapter 和 Part。

    返回 JSON：
    {{"has_toc": true, "entries": [{{"title": "第1章 概述", "level": 1}}, {{"title": "1.1 背景", "level": 2}}], "total_estimated_pages": 300}}

    {full_text_sample}"""


def generate_roadmap_from_toc(goal_title: str, goal_description: str, toc_json: str, book_title: str, teaching_style: str = '') -> str:
    return f"""你是一个专业的学习规划师。用户想通过学习一本教材来掌握：{goal_title}。
教材名称：{book_title}
用户补充描述：{goal_description or '无'}。{_style_instruction(teaching_style)}

这本书的目录结构如下（JSON格式）：
{toc_json}

请以这本书的目录为基础，生成学习路线。要求：
- level=1 的章节作为学习阶段 (phase)
- level>=2 的节/小节作为学习主题 (topic)。如果一个章下面没有小节，就把整章作为一个 topic
- 阶段数量 = 章的数量
- day 从 1 开始全局递增编号
- duration_days 根据每个阶段内的 topic 数量合理设定
- 每个 topic 附带 1-2 个推荐学习资源（可以是同类书籍的相关章节、在线文档等，不需要和原书完全一样）和 1-2 个练习任务

重要：严格以 JSON 格式返回，不要包含任何其他文字：
{{"phases": [{{"phase": 1, "title": "章标题", "duration_days": 7,
"topics": [{{"day": 1, "title": "节标题", "resources": ["资源1"], "exercises": ["练习1"]}}]
}}]}}"""


def generate_concept_map(goal_title: str, roadmap_json: str) -> str:
    return f"""你是一个知识体系构建专家。用户正在学习「{goal_title}」，以下是完整的学习路线：

{roadmap_json}

请为路线中的每个 topic（按 day 编号）提取最核心的概念节点，并找出概念之间的依赖关系。

要求：
- 每个 topic 提取 2-4 个核心概念（真正重要的，不是简单罗列所有术语）
- 每个概念给一句简短的解释（15字以内）
- 标出概念间的依赖关系（A 依赖 B 意味着必须先理解 B 才能理解 A）
- 依赖关系可以跨 topic、跨阶段

返回 JSON：
{{
  "concepts": [
    {{"id": "c_1", "label": "变量", "topic_day": 1, "summary": "存储数据的基本单元"}},
    {{"id": "c_2", "label": "数据类型", "topic_day": 1, "summary": "整数、字符串等数据分类"}},
    {{"id": "c_3", "label": "函数", "topic_day": 2, "summary": "封装可复用代码块"}},
    ...
  ],
  "dependencies": [
    {{"from": "c_3", "to": "c_1"}},
    ...
  ]
}}

注意：
- id 使用 "c_N" 格式，从 c_1 开始递增
- dependencies 中 from 依赖 to，即必须先学 to 才能学 from
- 只标注真正重要的依赖关系，不要过度关联"""


def translate_section(section_title: str, section_content: str, source_lang: str = '英文') -> str:
    return f"""你是一位专业的技术翻译。请将以下{source_lang}教材内容翻译成中文。

原文标题：{section_title}

翻译要求：
- 准确传达原文意思，专业术语使用标准中文译名
- 保持段落结构和 Markdown 格式（标题、列表、代码块等）
- 代码示例、数学公式、专有名词（API、框架名等）、文件路径保留原文不变
- 代码中的注释需要翻译成中文
- 翻译要通顺自然，符合中文表达习惯
- 如果原文有编号列表(1. 2. 3. 或 -)，保持列表结构

原文内容：
{section_content[:30000]}

请严格以 JSON 格式返回，不要包含 Markdown 代码块标记：
{{"title": "翻译后的标题", "content": "翻译后的完整内容"}}"""


def translate_titles_batch(titles: list[str], source_lang: str = '英文') -> str:
    titles_json = '\n'.join(f'  {{"index": {i}, "original": "{t}"}}' for i, t in enumerate(titles))
    return f"""你是一位专业的技术翻译。请将以下{source_lang}教材目录中的所有章节标题翻译成中文。

翻译要求：
- 准确传达原标题含义，专业术语使用标准中文译名
- 保持标题的简洁性，不要过度展开
- 专有名词（API、框架名等）保留原文

章节标题列表：
[
{titles_json}
]

请严格以 JSON 格式返回，不要包含 Markdown 代码块标记，为每个标题输出翻译结果：
{{"translations": [{{"index": 0, "title": "翻译后的标题"}}, ...]}}"""
