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

请为 {date_str} 生成当天的学习规划。任务应具体可执行，时长合理（总时长不超过3小时）。
返回 JSON：
{{"tasks": [{{"title": "任务名称", "duration_min": 30, "detail": "具体内容"}}], "note": "当日学习提示"}}"""


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
