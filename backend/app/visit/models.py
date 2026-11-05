import uuid
from datetime import date, datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    SmallInteger,
    String,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.shared.ids import uuid7

# 요청함 · 견적서 옴 · 취소(고객) · 못 받음(업체) · 닫힘(다른 업체 확정 · 다시 고르기) · 확정
STATUSES = ("requested", "quoted", "cancelled", "declined", "closed", "chosen")
LIVE = ("requested", "quoted", "chosen")  # 칸을 차지하는 상태 (공정마다 3곳까지)
SLOTS = 3
DECLINE_CODES = ("full", "out_of_area", "other")  # 일정이 꽉 찼어요 · 지역 밖이에요 · 그 밖
CLOSE_REASONS = ("other_chosen", "reselected")  # 다른 업체를 확정 · 다시 고르기

_LIVE_SQL = "status in ('requested', 'quoted', 'chosen')"
_STATUS_SQL = "('requested', 'quoted', 'cancelled', 'declined', 'closed', 'chosen')"


class Visit(Base):
    """실측 요청 한 건 (이 집 · 한 공정 · 한 업체). 믿집은 연결만 하고 방문 날짜는 다루지 않는다.

    요청할 때 업체 이름 · 가견적(확인한 단가 묶음과 합계)을 사본으로 고정한다.
    고객 연락처는 share_contact(업체마다 동의)일 때만 업체에 보인다.
    """

    __tablename__ = "visits"
    __table_args__ = (
        Index(
            "uq_visits_slot",
            "project_id",
            "trade",
            "slot",
            unique=True,
            postgresql_where=text(_LIVE_SQL),
        ),
        Index(
            "uq_visits_vendor",
            "project_id",
            "trade",
            "vendor_id",
            unique=True,
            postgresql_where=text(_LIVE_SQL),
        ),
        CheckConstraint("trade in ('dobae', 'mokgong')", name="trade"),
        CheckConstraint("slot between 1 and 3", name="slot"),
        CheckConstraint(f"status in {_STATUS_SQL}", name="status"),
        CheckConstraint("share_contact = (consent_at is not null)", name="share_contact"),
        CheckConstraint("(consent_ver is null) = (consent_at is null)", name="consent"),
        CheckConstraint("message is null or length(btrim(message)) > 0", name="message"),
        CheckConstraint("estimate_total >= 0", name="estimate_total"),
        CheckConstraint(
            "estimate_set_id is null or estimate_total is not null", name="estimate_set"
        ),
        CheckConstraint(
            "(status = 'declined') = (decline_code is not null)"
            " and (decline_code is null or decline_code in ('full', 'out_of_area', 'other'))",
            name="decline_code",
        ),
        CheckConstraint(
            "(status = 'closed') = (close_reason is not null)"
            " and (close_reason is null or close_reason in ('other_chosen', 'reselected'))",
            name="close_reason",
        ),
        CheckConstraint("quote_ver >= 1", name="quote_ver"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid7)
    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    trade: Mapped[str] = mapped_column(String(10))
    # 업체가 탈퇴해도 요청 기록은 남긴다 (이름은 사본으로)
    vendor_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("vendors.user_id", ondelete="SET NULL"), index=True
    )
    vendor_name: Mapped[str] = mapped_column(String(100))
    slot: Mapped[int] = mapped_column(SmallInteger)
    status: Mapped[str] = mapped_column(String(10), default="requested", server_default="requested")
    share_contact: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    consent_ver: Mapped[str | None] = mapped_column(String(20))
    consent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    message: Mapped[str | None] = mapped_column(String(300))
    # 요청 때의 가견적 사본. 가견적 없음이면 둘 다 비어 있다
    estimate_set_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("vendor_price_sets.id", ondelete="SET NULL")
    )
    estimate_total: Mapped[int | None] = mapped_column(BigInteger)
    decline_code: Mapped[str | None] = mapped_column(String(12))
    close_reason: Mapped[str | None] = mapped_column(String(12))
    quote_ver: Mapped[int | None] = mapped_column(SmallInteger)  # 고객이 본 견적서 버전
    contact_until: Mapped[date | None] = mapped_column(Date)  # 확정 뒤 연락처가 보이는 마지막 날
    vendor_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class VisitEvent(Base):
    """실측 요청 상태 이력 (만들 때 없음 → requested)"""

    __tablename__ = "visit_events"
    __table_args__ = (
        CheckConstraint(f"from_status is null or from_status in {_STATUS_SQL}", name="from_status"),
        CheckConstraint(f"to_status in {_STATUS_SQL}", name="to_status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid7)
    visit_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("visits.id", ondelete="CASCADE"), index=True
    )
    from_status: Mapped[str | None] = mapped_column(String(10))
    to_status: Mapped[str] = mapped_column(String(10))
    by_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    code: Mapped[str | None] = mapped_column(String(20))
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
