import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
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

KINDS = ("chat", "vendor", "link")
# 채팅 · 업체: 믿집 밖 거래 · 욕설 · 약속과 다름 · 그 밖 / 링크: 다른 곳 · 이 업체가 아님 · 그 밖
CHAT_REASONS = ("offsite", "abuse", "promise", "other")
LINK_REASONS = ("wrong_place", "not_vendor", "other")
STATUSES = ("open", "resolved", "dismissed")
# 처리: 경고 · 채팅 쓰기 막기 · 새 요청 막기 · 진행 중도 닫기 · 링크 숨김 · 조치 없음(dismissed)
ACTIONS = ("warn", "mute_chat", "suspend_new", "suspend_all", "hide_link", "none")
ADMIN_ACTIONS = (
    "suspend_user",
    "unsuspend_user",
    "warn_vendor",
    "mute_vendor",
    "unmute_vendor",
    "suspend_vendor",
    "unsuspend_vendor",
    "hide_review",
    "show_review",
    "link_shown",
    "link_hidden",
    "dismiss_report",
)


def _in(values: tuple[str, ...]) -> str:
    return "(" + ", ".join(f"'{v}'" for v in values) + ")"


class Report(Base):
    """신고 한 건 (채팅 · 업체 · 링크). 채팅이면 신고 때 글 사본(evidence)을 남긴다(데이터로만 보여 줌).
    종류별 대상(대화 · 글 · 업체)은 service가 확인한다."""

    __tablename__ = "reports"
    __table_args__ = (
        Index(
            "uq_reports_message_open",
            "reporter_id",
            "message_id",
            unique=True,
            postgresql_where=text("status = 'open' and message_id is not null"),
        ),
        Index("ix_reports_status_created", "status", "created_at"),
        CheckConstraint(f"kind in {_in(KINDS)}", name="kind"),
        CheckConstraint(
            f"(kind in ('chat', 'vendor') and reason_code in {_in(CHAT_REASONS)})"
            f" or (kind = 'link' and reason_code in {_in(LINK_REASONS)})",
            name="reason_code",
        ),
        CheckConstraint("link_sort between 0 and 2", name="link_sort"),
        CheckConstraint("(kind = 'link') = (link_sort is not null)", name="link"),
        CheckConstraint(f"status in {_in(STATUSES)}", name="status"),
        CheckConstraint(f"action is null or action in {_in(ACTIONS)}", name="action"),
        CheckConstraint("(status = 'open') = (action is null)", name="open_action"),
        CheckConstraint("(status = 'open') = (resolved_at is null)", name="resolved"),
        CheckConstraint("note is null or length(btrim(note)) > 0", name="note"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid7)
    kind: Mapped[str] = mapped_column(String(8))
    reporter_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    vendor_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("vendors.user_id", ondelete="SET NULL"), index=True
    )
    thread_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("threads.id", ondelete="SET NULL")
    )
    message_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("thread_messages.id", ondelete="SET NULL")
    )
    link_sort: Mapped[int | None] = mapped_column(SmallInteger)  # 외부 리뷰 링크 번호 0~2
    reason_code: Mapped[str] = mapped_column(String(12))
    note: Mapped[str | None] = mapped_column(String(300))
    evidence: Mapped[str | None] = mapped_column(String(1000))  # 신고 때 글 사본
    block: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    status: Mapped[str] = mapped_column(String(10), default="open", server_default="open")
    action: Mapped[str | None] = mapped_column(String(12))
    admin_note: Mapped[str | None] = mapped_column(String(300))
    resolved_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AdminAction(Base):
    """관리자 처리 기록 (정지 · 경고 · 쓰기 막기 · 숨김 · 링크 확인). 지우지 않고 쌓는다."""

    __tablename__ = "admin_actions"
    __table_args__ = (
        CheckConstraint(f"action in {_in(ADMIN_ACTIONS)}", name="action"),
        CheckConstraint("note is null or length(btrim(note)) > 0", name="note"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid7)
    admin_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    action: Mapped[str] = mapped_column(String(20))
    target_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    report_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("reports.id", ondelete="SET NULL")
    )
    review_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("reviews.id", ondelete="SET NULL")
    )
    note: Mapped[str | None] = mapped_column(String(300))
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
