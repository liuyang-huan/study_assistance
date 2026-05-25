from datetime import datetime, timezone
from sqlalchemy import Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from ..database import Base


class BookImport(Base):
    __tablename__ = 'book_imports'

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    goal_id: Mapped[int] = mapped_column(Integer, ForeignKey('learning_goals.id', ondelete='CASCADE'), nullable=False)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(20), default='processing')
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_language: Mapped[str | None] = mapped_column(String(20), nullable=True)
    toc: Mapped[str | None] = mapped_column(Text, nullable=True)
    total_pages: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


class BookSection(Base):
    __tablename__ = 'book_sections'

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    book_import_id: Mapped[int] = mapped_column(Integer, ForeignKey('book_imports.id', ondelete='CASCADE'), nullable=False)
    goal_id: Mapped[int] = mapped_column(Integer, ForeignKey('learning_goals.id', ondelete='CASCADE'), nullable=False)
    section_index: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    level: Mapped[int] = mapped_column(Integer, default=1)
    page_start: Mapped[int | None] = mapped_column(Integer, nullable=True)
    page_end: Mapped[int | None] = mapped_column(Integer, nullable=True)
    content: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)
    translated_title: Mapped[str | None] = mapped_column(String(500), nullable=True)
    translated_content: Mapped[str | None] = mapped_column(Text, nullable=True)
    topic_day: Mapped[int | None] = mapped_column(Integer, nullable=True)
    read_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
