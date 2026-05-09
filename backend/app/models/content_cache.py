from datetime import datetime, timezone
from sqlalchemy import Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from ..database import Base


class ContentCache(Base):
    """通用内容缓存：学习材料 + 预生成题目"""
    __tablename__ = 'content_cache'

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    goal_id: Mapped[int] = mapped_column(Integer, ForeignKey('learning_goals.id', ondelete='CASCADE'), nullable=False)
    cache_type: Mapped[str] = mapped_column(String(20), nullable=False)  # 'material' | 'questions'
    cache_key: Mapped[str] = mapped_column(String(50), nullable=False)   # e.g. 'topic_5', 'questions_batch_2'
    content: Mapped[str] = mapped_column(Text, nullable=False)           # JSON string
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
