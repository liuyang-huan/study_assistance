from datetime import date


def generate_roadmap(goal_title: str, goal_description: str, skill_level: str = '') -> str:
    return f"""你是一个专业的学习规划师。用户想学习：{goal_title}。
用户描述：{goal_description or '无补充描述'}。
当前基础：{skill_level or '零基础/未说明'}。

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
                        recent_journals: str = '', recent_evaluations: str = '') -> str:
    return f"""用户正在学习：{goal_title}。
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


def generate_questions(goal_title: str, current_topic: str, difficulty: str = 'medium') -> str:
    return f"""用户正在学习：{goal_title}。
当前学习主题：{current_topic}。
难度要求：{difficulty}

请生成 2-3 个问题来检测用户对当前主题的理解程度。问题应有层次——从基础概念到深入理解。
返回 JSON：
{{"questions": [{{"question": "问题内容", "expected_answer": "参考答案要点", "difficulty": "easy/medium/hard"}}]}}"""


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

返回 JSON：
{{"score": 8, "correctness": "评估说明", "depth": "理解深度", "suggestion": "学习建议", "need_adjust": false}}"""


def generate_topic_materials(goal_title: str, topic_title: str, phase_context: str) -> str:
    return f"""你是一位资深技术导师。用户正在学习：{goal_title}。
当前学习主题：{topic_title}
所在阶段：{phase_context}

请为这个主题生成一份详尽、生动的学习材料。不要敷衍，要像真正的教材一样有深度和层次感。

重要：content 正文至少 800-1500 字，必须按以下结构组织（用 Markdown 二级标题）：
  ## 基础概念 — 用通俗语言解释核心概念，假设读者是新手
  ## 深入理解 — 剖析原理、机制、为什么这样设计
  ## 实际应用 — 真实项目/场景中的使用方式
  ## 常见误区 — 2-3 个初学者常犯的错误及正确做法

examples 至少 2-3 个递进示例（由浅入深）：
  - 基础示例：能 5 分钟看懂的最简示例
  - 进阶示例：解决一个实际问题的示例
  - 综合示例：融合多个相关知识点的完整示例

practice_questions 至少 3 道练习题，从易到难，每题包含题目 + 思路提示。

key_concepts 至少 3-5 个核心知识点。
learning_objectives 列出 3-5 条：学完本节后应掌握的能力。

返回 JSON：
{{
  "title": "{topic_title}",
  "duration_min": 45,
  "detail": "一句话描述",
  "materials": {{
    "summary": "本节概述（2-3句话）",
    "learning_objectives": ["学完后能...", "学完后能..."],
    "key_concepts": [{{"name": "概念名", "explanation": "2-3句话解释，通俗易懂"}}],
    "content": "## 基础概念\\n...\\n\\n## 深入理解\\n...\\n\\n## 实际应用\\n...\\n\\n## 常见误区\\n...",
    "examples": [{{"title": "示例标题", "description": "简要说明", "code": "代码或详细内容"}}],
    "practice_questions": [{{"question": "题目", "hint": "思路提示"}}]
  }}
}}"""


def study_buddy_chat(goal_title: str, task_context: str, chat_history: str, user_message: str) -> str:
    return f"""你是一个友好的 AI 学习搭子，正在陪用户一起学习。

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
- 回答简洁精炼，一般不超过300字
- 可以适当使用 Markdown 格式（代码块、加粗等）

直接回答用户的问题即可，不要加前缀标签。"""


def adjust_roadmap(current_roadmap: str, goal_title: str, progress_summary: str,
                    weak_points: str = '', strengths: str = '') -> str:
    return f"""用户正在学习：{goal_title}。
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
