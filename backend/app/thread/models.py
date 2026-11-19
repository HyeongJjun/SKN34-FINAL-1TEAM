import uuid
from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.shared.ids import uuid7

STATUSES = ("open", "read_only")
# 읽기만 되는 까닭: 다른 업체 확정 · 실측 취소 · 업체 못 받아요 · 고객 탈퇴 · 고객 차단 · 관리자
RO_REASONS = ("other_chosen", "cancelled", "declined", "withdrawn", "blocked", "admin")
SENDER_ROLES = ("customer", "vendor", "system")
MESSAGE_KINDS = ("text", "photo", "system")
WARNS = ("offsite",)  # 믿집 밖 거래 주의 줄 (고객 화면만, D05 A)
BODY_MAX = 1000
# 시스템 카드 코드 (대상 id는 ref_id). 화면이 코드로 카드 모양을 고른다
SYSTEM_CODES = (
    "visit_booked",
    "change_requested",
    "change_done",
    "change_countered",
    "visit_cancelled",
    "quote_sent",
    "extra_sent",
    "extra_asked",
    "deal_confirmed",
    "other_chosen",
)
# 채팅 연락처 · 글 보관 기간(일). L07: 사용자 결정 S18 B대로 기간 제한 없이 둔다(None = 지우지 않음)
THREAD_CONTACT_RETENTION_DAYS: int | None = None


def _in(values: tuple[str, ...]) -> str:
    return "(" + ", ".join(f"'{v}'" for v in values) + ")"


class Thread(Base):
    """고객-업체 대화 하나 = (공사, 업체). 실측이 처음 확정될 때 visit.service가 open()으로 만든다.

    탈퇴해도 업체 쪽 글은 남도록 공사 · 업체 · 고객 칸은 SET NULL이고, 이름표는 만든 때 사본이다
    (업체 화면에는 고객 이름 대신 '상계동 고객').
    """

    __tablename__ = "threads"
    __table_args__ = (
        UniqueConstraint("project_id", "vendor_id", name="uq_threads_project_vendor"),
        Index("ix_threads_customer_last", "customer_id", "last_message_at"),
        Index("ix_threads_vendor_last", "vendor_id", "last_message_at"),
        CheckConstraint("status in ('open', 'read_only')", name="status"),
        CheckConstraint(f"ro_reason is null or ro_reason in {_in(RO_REASONS)}", name="ro_reason"),
        CheckConstraint("(status = 'open') = (ro_reason is null)", name="read_only"),
        CheckConstraint("last_seq >= 0", name="last_seq"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid7)
    project_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("projects.id", ondelete="SET NULL")
    )
    vendor_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("vendors.user_id", ondelete="SET NULL")
    )
    customer_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    # 가장 최근 확정한 요청 (채팅 위 띠의 실측 정보는 화면이 visit API로 따로 읽는다)
    visit_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("visits.id", ondelete="SET NULL"))
    status: Mapped[str] = mapped_column(String(10), default="open", server_default="open")
    ro_reason: Mapped[str | None] = mapped_column(String(12))
    last_seq: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    last_message_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    customer_label: Mapped[str] = mapped_column(String(40))  # '상계동 고객'
    vendor_label: Mapped[str] = mapped_column(String(100))  # 업체 상호
    area_label: Mapped[str] = mapped_column(String(60))  # '노원구 상계동 69.4㎡'
    vendor_muted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))  # A02
    blocked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))  # C31
    # 고객 글이 '○○동 ○○호' 꼴 규칙에 걸린 때 (I7 B 전날 알림이 본다)
    address_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ThreadMessage(Base):
    """대화 글 한 줄. seq는 대화 행 잠금 아래 하나씩 오른다. 같은 (대화, 보낸 사람, client_key)는 한 번만."""

    __tablename__ = "thread_messages"
    __table_args__ = (
        UniqueConstraint("thread_id", "seq", name="uq_thread_messages_seq"),
        UniqueConstraint(
            "thread_id", "sender_id", "client_key", name="uq_thread_messages_client_key"
        ),
        CheckConstraint("seq >= 1", name="seq"),
        CheckConstraint(f"sender_role in {_in(SENDER_ROLES)}", name="sender_role"),
        CheckConstraint(f"kind in {_in(MESSAGE_KINDS)}", name="kind"),
        CheckConstraint("(kind = 'system') = (sender_role = 'system')", name="system_sender"),
        CheckConstraint("kind <> 'system' or system_code is not null", name="system_code"),
        # 글은 비울 수 없다. 보관 기간 정리(redacted_at) 때만 본문을 지운다
        CheckConstraint(
            "kind <> 'text' or body is not null or redacted_at is not null", name="text_body"
        ),
        CheckConstraint("body is null or length(btrim(body)) > 0", name="body"),
        CheckConstraint("warn is null or warn = 'offsite'", name="warn"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid7)
    thread_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("threads.id", ondelete="CASCADE"))
    seq: Mapped[int] = mapped_column(Integer)
    sender_role: Mapped[str] = mapped_column(String(8))
    sender_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    kind: Mapped[str] = mapped_column(String(8))
    body: Mapped[str | None] = mapped_column(String(BODY_MAX))
    # 파일이 지워지면 '사진을 볼 수 없어요'
    file_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("files.id", ondelete="SET NULL"), index=True
    )
    system_code: Mapped[str | None] = mapped_column(String(30))
    ref_id: Mapped[uuid.UUID | None] = mapped_column()
    warn: Mapped[str | None] = mapped_column(String(8))
    client_key: Mapped[uuid.UUID | None] = mapped_column()
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    redacted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ThreadRead(Base):
    """사람마다 마지막으로 읽은 글 번호. 줄지 않게 greatest로만 올린다. 안 읽은 수 = last_seq - 이 값."""

    __tablename__ = "thread_reads"
    __table_args__ = (CheckConstraint("last_read_seq >= 0", name="last_read_seq"),)

    thread_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("threads.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    last_read_seq: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
