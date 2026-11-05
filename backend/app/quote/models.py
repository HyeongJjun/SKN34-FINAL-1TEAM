import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    ARRAY,
    BigInteger,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    SmallInteger,
    String,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.shared.ids import uuid7

LINE_STATES = ("included", "bundled", "separate", "optional", "after_visit", "excluded")


class StandardQuote(Base):
    """표준견적서 한 공정 · 한 버전. 집 정보(rev) · 산식 · 단가 버전이 바뀌면 새 버전을 쌓는다."""

    __tablename__ = "standard_quotes"
    __table_args__ = (
        UniqueConstraint("project_id", "trade", "version", name="uq_standard_quotes_version"),
        CheckConstraint("trade in ('dobae', 'mokgong')", name="trade"),
        CheckConstraint("version >= 1", name="version"),
        CheckConstraint("supply >= 0 and vat >= 0 and total = supply + vat", name="money"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid7)
    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    trade: Mapped[str] = mapped_column(String(10))
    version: Mapped[int] = mapped_column(SmallInteger)
    project_rev: Mapped[int] = mapped_column(SmallInteger)
    formula_ver: Mapped[str] = mapped_column(String(20))
    price_ver: Mapped[str] = mapped_column(String(20))
    grade: Mapped[str | None] = mapped_column(String(10))
    area_m2: Mapped[Decimal] = mapped_column(Numeric(7, 1))
    area_basis: Mapped[str] = mapped_column(String(10))
    pyeong: Mapped[Decimal] = mapped_column(Numeric(5, 1))
    supply: Mapped[int] = mapped_column(BigInteger)
    vat: Mapped[int] = mapped_column(BigInteger)
    total: Mapped[int] = mapped_column(BigInteger)
    man_day: Mapped[Decimal] = mapped_column(Numeric(4, 1))
    crew: Mapped[int] = mapped_column(SmallInteger)
    notes: Mapped[list[str]] = mapped_column(ARRAY(String(200)), default=list, server_default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class StandardQuoteLine(Base):
    """표준견적서 줄. 표준 행 키와 포함 상태 6종으로 남긴다(합계에는 포함 · 따로 계산만)."""

    __tablename__ = "standard_quote_lines"
    __table_args__ = (
        CheckConstraint(
            "state in ('included', 'bundled', 'separate', 'optional', 'after_visit', 'excluded')",
            name="state",
        ),
        CheckConstraint("basis in ('public', 'assumed', 'none')", name="basis"),
    )

    quote_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("standard_quotes.id", ondelete="CASCADE"), primary_key=True
    )
    key: Mapped[str] = mapped_column(String(40), primary_key=True)
    name: Mapped[str] = mapped_column(String(60))
    qty: Mapped[Decimal | None] = mapped_column(Numeric(9, 1))
    unit: Mapped[str] = mapped_column(String(10))
    unit_price: Mapped[int | None] = mapped_column(BigInteger)
    amount: Mapped[int | None] = mapped_column(BigInteger)
    state: Mapped[str] = mapped_column(String(12))
    basis: Mapped[str] = mapped_column(String(10))
    source: Mapped[str] = mapped_column(String(120))
    sort: Mapped[int] = mapped_column(SmallInteger)


VAT_MODES = ("included", "excluded", "exempt")  # 넣은 금액이 부가세 포함 · 부가세 빼고 · 면세
QUOTE_FILES_MAX = 10
# 보낸 견적서에 꼭 있어야 하는 칸: 낼 금액 · 부가세 방식 (파일 1개 이상은 service가 본다)
_SENT_FIELDS = " and ".join(f"{c} is not null" for c in ("entered_amount", "vat_mode", "total"))


class VendorQuote(Base):
    """업체 실측 견적서 한 버전. 파일은 업체 양식 그대로, 낼 금액 · 부가세 방식 · 공사 기간 ·
    유효기간만 칸에 적는다(줄로 바꾸지 않음). 실측한 날 · 공사 기간 · 유효기간은 선택이다. 공급가 · 부가세 · 합계는 계산 엔진이 만든다.
    sent_at이 비면 임시 저장(요청마다 하나), 보내면 그 버전은 바꾸지 않는다."""

    __tablename__ = "vendor_quotes"
    __table_args__ = (
        UniqueConstraint("visit_id", "version", name="uq_vendor_quotes_version"),
        UniqueConstraint("code", "version", name="uq_vendor_quotes_code_version"),
        Index(
            "uq_vendor_quotes_draft",
            "visit_id",
            unique=True,
            postgresql_where=text("sent_at is null"),
        ),
        CheckConstraint("version >= 1", name="version"),
        CheckConstraint("code ~ '^Q-[0-9]{4}-[0-9]{4,}$'", name="code"),
        CheckConstraint("vat_mode in ('included', 'excluded', 'exempt')", name="vat_mode"),
        CheckConstraint("entered_amount >= 0", name="entered_amount"),
        CheckConstraint(
            "(supply is null) = (total is null) and (vat is null) = (total is null)"
            " and (total is null or (supply >= 0 and vat >= 0 and total = supply + vat))",
            name="money",
        ),
        CheckConstraint(
            "total is null or (entered_amount is not null and vat_mode is not null)",
            name="money_from",
        ),
        CheckConstraint(
            "vat_mode is distinct from 'exempt' or vat is null or vat = 0", name="exempt"
        ),
        CheckConstraint("days between 1 and 120", name="days"),
        CheckConstraint("valid_until >= measured_on", name="valid_until"),
        CheckConstraint(f"sent_at is null or ({_SENT_FIELDS})", name="sent_fields"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid7)
    visit_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("visits.id", ondelete="CASCADE"), index=True
    )
    # Q-2611-0041. 요청마다 번호 하나, 다시 올리면 같은 번호에 버전만 올린다
    code: Mapped[str] = mapped_column(String(16))
    version: Mapped[int] = mapped_column(SmallInteger)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    measured_on: Mapped[date | None] = mapped_column(Date)
    entered_amount: Mapped[int | None] = mapped_column(BigInteger)  # 업체가 적은 낼 금액
    vat_mode: Mapped[str | None] = mapped_column(String(10))
    supply: Mapped[int | None] = mapped_column(BigInteger)
    vat: Mapped[int | None] = mapped_column(BigInteger)
    total: Mapped[int | None] = mapped_column(BigInteger)  # 고객이 낼 금액
    days: Mapped[int | None] = mapped_column(SmallInteger)  # 공사 기간 (일)
    valid_until: Mapped[date | None] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class VendorQuoteFile(Base):
    """견적서 버전에 붙인 업체 양식 파일 (files.kind = quote_doc).
    같은 요청의 버전끼리는 같은 파일을 다시 붙일 수 있고, 다른 요청의 견적서에는 못 붙인다(service)."""

    __tablename__ = "vendor_quote_files"
    __table_args__ = (CheckConstraint("sort between 0 and 9", name="sort"),)

    quote_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("vendor_quotes.id", ondelete="CASCADE"), primary_key=True
    )
    file_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("files.id", ondelete="CASCADE"), primary_key=True, index=True
    )
    sort: Mapped[int] = mapped_column(SmallInteger)
