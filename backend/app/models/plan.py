from datetime import datetime, timezone, date
from sqlalchemy import Integer, Text, Boolean, Date, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from ..database import Base


class DailyPlan(Base):
    __tablename__ = 'daily_plans'

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    goal_id: Mapped[int] = mapped_column(Integer, ForeignKey('learning_goals.id', ondelete='CASCADE'), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    plan_content: Mapped[str] = mapped_column(Text, default='{}')
    is_adjusted: Mapped[bool] = mapped_column(Boolean, default=False)
    completed: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
