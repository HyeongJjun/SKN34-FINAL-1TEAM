import uuid
from datetime import datetime

from sqlalchemy import BigInteger, CheckConstraint, DateTime, ForeignKey, Index, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.shared.ids import uuid7

# photo: 공간 사진 · plan: 아파트 도면 (고객) / license: 사업자등록증 · portfolio: 시공 사진 (업체)
# price_doc: 가견적 근거 견적서 · 단가표 · quote_doc: 실측 견적서 · work_photo: 공사 사진 (업체)
# v3(0028): chat_photo 채팅 사진 · review_photo 리뷰 사진 (고객) · done_photo 공사 끝 사진 (업체)
KINDS = (
    "photo",
    "plan",
    "license",
    "portfolio",
    "price_doc",
    "quote_doc",
    "work_photo",
    "chat_photo",
    "review_photo",
    "done_photo",
)


class File(Base):
    """올린 파일 한 개. 내용은 저장소(files/storage.py)에, 여기에는 위치와 정보만 둔다."""

    __tablename__ = "files"
    __table_args__ = (
        CheckConstraint(
            "kind in ('photo', 'plan', 'license', 'portfolio', 'price_doc', 'quote_doc',"
            " 'work_photo', 'chat_photo', 'review_photo', 'done_photo')",
            name="kind",
        ),
        CheckConstraint("size > 0", name="size"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid7)
    owner_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    kind: Mapped[str] = mapped_column(String(12))  # review_photo가 12자
    storage_key: Mapped[str] = mapped_column(String(100), unique=True)
    filename: Mapped[str] = mapped_column(String(200))
    content_type: Mapped[str] = mapped_column(String(100))  # 엑셀 MIME은 65자
    size: Mapped[int] = mapped_column(BigInteger)
    sha256: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# 열람 기록을 남기는 사람 역할 (users.role과 같은 값)
VIEWER_ROLES = ("customer", "vendor", "admin")


class FileView(Base):
    """파일 열람 기록(지금은 사업자등록증). 안전성 확보조치 기준 제8조: 1년 이상 남기고 고치거나 지우지 않는다.

    파일이 지워지거나 회원이 탈퇴해도 기록은 남겨야 해서 FK를 두지 않는다(0032, B7 부탁).
    쓰기는 files.service.record_view 한 곳에서만 한다.
    """

    __tablename__ = "file_views"
    __table_args__ = (
        CheckConstraint("viewer_role in ('customer', 'vendor', 'admin')", name="viewer_role"),
        Index("ix_file_views_owner_at", "owner_id", "at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid7)
    file_id: Mapped[uuid.UUID]
    owner_id: Mapped[uuid.UUID]  # 파일 주인 (사업자등록증이면 업체 사용자)
    viewer_id: Mapped[uuid.UUID]
    viewer_role: Mapped[str] = mapped_column(String(10))
    kind: Mapped[str] = mapped_column(String(12))  # 본 때의 files.kind 사본
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
