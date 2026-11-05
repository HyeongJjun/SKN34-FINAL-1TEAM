import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.shared.ids import uuid7

ROLES = ("customer", "vendor", "admin")


class User(Base):
    """회원 한 명. 일반 회원 · 업체 회원 · 관리자가 같은 표를 쓰고 role로 나눈다."""

    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("role in ('customer', 'vendor', 'admin')", name="role"),
        CheckConstraint("status in ('active', 'suspended')", name="status"),
        CheckConstraint("email = lower(email)", name="email_lower"),
        CheckConstraint("phone ~ '^01[0-9]{8,9}$'", name="phone"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid7)
    email: Mapped[str] = mapped_column(String(254), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    name: Mapped[str] = mapped_column(String(50))
    # 휴대폰 번호(숫자만). 실측을 요청하면 고객이 고른 업체에 간다. 업체 회원은 vendors.phone을 쓴다
    phone: Mapped[str | None] = mapped_column(String(20))
    role: Mapped[str] = mapped_column(String(10))
    status: Mapped[str] = mapped_column(String(10), default="active", server_default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class UserSession(Base):
    """로그인 세션. 쿠키에는 무작위 토큰을, DB에는 그 해시만 둔다 (DB가 새도 세션을 못 쓴다)."""

    __tablename__ = "user_sessions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)  # sha256(token) hex
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
