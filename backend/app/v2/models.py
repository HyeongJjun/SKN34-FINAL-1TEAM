import uuid
from datetime import date, datetime

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.shared.ids import uuid7


class V2Case(Base):
    """v2 상담의 인테리어 한 건. 고른 값(state)은 통째로 남기는 기록이라 JSONB로 둔다.

    견적서 · 공정표(quote · plan)는 저장할 때 서버 계산 엔진이 다시 만든 결과이고,
    목록에 쓰는 합계 · 날짜는 그 결과에서 꺼내 칸으로 둔다.
    """

    __tablename__ = "v2_cases"
    __table_args__ = (
        CheckConstraint("char_length(title) between 1 and 40", name="title"),
        CheckConstraint("quote_total is null or quote_total >= 0", name="quote_total"),
        CheckConstraint("plan_end is null or plan_end >= plan_start", name="plan_dates"),
        CheckConstraint("work_days is null or work_days >= 0", name="work_days"),
        Index("ix_v2_cases_owner_updated", "owner_id", "updated_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid7)
    owner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(40))
    state: Mapped[dict] = mapped_column(JSONB)
    quote: Mapped[dict | None] = mapped_column(JSONB)
    plan: Mapped[dict | None] = mapped_column(JSONB)
    quote_total: Mapped[int | None] = mapped_column(BigInteger)
    quote_code: Mapped[str | None] = mapped_column(String(40))
    plan_start: Mapped[date | None] = mapped_column(Date)
    plan_end: Mapped[date | None] = mapped_column(Date)
    work_days: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
