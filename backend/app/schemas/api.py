import json
from datetime import datetime, date
from pydantic import BaseModel, field_validator


# --- 学习目标 ---
class GoalCreate(BaseModel):
    title: str
    description: str = ''


class GoalUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    status: str | None = None


class GoalResponse(BaseModel):
    id: int
    title: str
    description: str
    status: str
    skill_level: str | None
    created_at: datetime
    updated_at: datetime


class GoalDetailResponse(GoalResponse):
    roadmap: dict | None = None
    today_plan: dict | None = None
    today_questions: list[dict] = []
    today_journal: dict | None = None


# --- 学习路线 ---
class RoadmapResponse(BaseModel):
    id: int
    goal_id: int
    content: dict
    version: int
    is_active: bool
    created_at: datetime

    @field_validator('content', mode='before')
    @classmethod
    def parse_content(cls, v):
        if isinstance(v, str):
            return json.loads(v)
        return v


# --- 每日规划 ---
class PlanResponse(BaseModel):
    id: int
    goal_id: int
    date: date
    plan_content: dict
    is_adjusted: bool
    completed: bool
    created_at: datetime

    @field_validator('plan_content', mode='before')
    @classmethod
    def parse_content(cls, v):
        if isinstance(v, str):
            return json.loads(v)
        return v


# --- 学习日志 ---
class JournalCreate(BaseModel):
    content: str = ''
    reflection: str = ''
    duration_minutes: int = 0


class JournalResponse(BaseModel):
    id: int
    goal_id: int
    date: date
    content: str
    reflection: str
    duration_minutes: int
    created_at: datetime


# --- 每日问答 ---
class AnswerSubmit(BaseModel):
    answer: str


class QuestionResponse(BaseModel):
    id: int
    goal_id: int
    date: date
    question: str
    expected_answer: str
    difficulty: str
    status: str
    created_at: datetime
    evaluation: dict | None = None
    type: str | None = None  # 'new' | 'review'


# --- 学习进度 ---
class LearnedTopicResponse(BaseModel):
    topic_day: int
    learned_at: datetime


class GoalProgressResponse(BaseModel):
    goal_id: int
    learned_days: list[int]
    total_topics: int
    learned_count: int
    current_phase: int | None
    current_day: int | None


class AnswerResponse(BaseModel):
    id: int
    question_id: int
    answer: str
    ai_evaluation: dict | None
    score: int | None
    created_at: datetime

    @field_validator('ai_evaluation', mode='before')
    @classmethod
    def parse_eval(cls, v):
        if isinstance(v, str) and v:
            return json.loads(v)
        return v


# --- 学习笔记 ---
class NoteCreate(BaseModel):
    topic_title: str
    content: str = ''


class NoteUpdate(BaseModel):
    content: str


class NoteResponse(BaseModel):
    id: int
    goal_id: int
    topic_title: str
    content: str
    created_at: datetime
    updated_at: datetime


# --- 图书导入 ---
class TocEntrySchema(BaseModel):
    title: str
    level: int
    section_index: int


class BookImportResponse(BaseModel):
    id: int
    goal_id: int
    filename: str
    original_filename: str
    file_size: int
    status: str
    error_message: str | None = None
    toc: list[TocEntrySchema] | None = None
    total_pages: int | None = None
    created_at: datetime

    @field_validator('toc', mode='before')
    @classmethod
    def parse_toc(cls, v):
        if isinstance(v, str) and v:
            return json.loads(v)
        return v


class TranslationUpdate(BaseModel):
    content_translated: str
    title_translated: str | None = None


class BookSectionResponse(BaseModel):
    id: int
    section_index: int
    title: str
    level: int
    content: str = ''
    topic_day: int | None = None
    translated_title: str | None = None
    translated_content: str | None = None
