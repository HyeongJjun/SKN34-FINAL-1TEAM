import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field, model_validator

from app.calc.schedule import JOB_MAX_DAYS
from app.quote.models import QUOTE_FILES_MAX

VatMode = Literal["included", "excluded", "exempt"]  # 넣은 금액이 부가세 포함 · 부가세 빼고 · 면세
AMOUNT_MAX = 1_000_000_000


class StandardLineOut(BaseModel):
    key: str
    name: str
    qty: Decimal | None
    unit: str
    unit_price: int | None
    amount: int | None
    state: str
    source: str


class StandardTradeOut(BaseModel):
    trade: str
    version: int
    grade: str | None
    lines: list[StandardLineOut]
    supply: int
    vat: int
    total: int
    man_day: Decimal
    crew: int
    notes: list[str]


class BudgetOut(BaseModel):
    band: str
    status: Literal["within", "over", "open"]  # open: 위 한도 없음 · 아직 몰라요
    over_by: int | None  # 넣은 예산 위 한도보다 많은 금액 (부가세 포함 합계 기준)


class StandardOut(BaseModel):
    project_id: uuid.UUID
    code: str
    project_rev: int
    formula_ver: str
    price_ver: str
    computed_at: datetime
    area_m2: Decimal
    area_basis: str
    pyeong: Decimal
    trades: list[StandardTradeOut]
    supply: int
    vat: int
    total: int
    budget: BudgetOut | None


class QuoteDraftIn(BaseModel):
    """실측 견적서 임시 저장 (통째로). 파일은 먼저 POST /files (kind=quote_doc)로 올린다."""

    file_ids: list[uuid.UUID] = Field(default_factory=list, max_length=QUOTE_FILES_MAX)
    measured_on: date | None = Field(default=None, description="실측한 날")
    entered_amount: int | None = Field(
        default=None, ge=0, le=AMOUNT_MAX, description="견적서에 적은 낼 금액 그대로 (원)"
    )
    vat_mode: VatMode | None = None
    days: int | None = Field(default=None, ge=1, le=JOB_MAX_DAYS, description="공사 기간 (일)")
    valid_until: date | None = Field(default=None, description="견적 유효기간 (이날까지)")

    @model_validator(mode="after")
    def _files(self) -> "QuoteDraftIn":
        if len(set(self.file_ids)) != len(self.file_ids):
            raise ValueError("같은 파일을 두 번 붙였어요.")
        return self


class QuoteFileOut(BaseModel):
    file_id: uuid.UUID
    filename: str
    content_type: str
    size: int
    sort: int


class VendorQuoteOut(BaseModel):
    """실측 견적서 한 버전. supply · vat · total은 계산 엔진(from_entered)이 만든 값이다."""

    id: uuid.UUID
    code: str
    version: int
    sent_at: datetime | None = Field(description="비면 임시 저장")
    measured_on: date | None
    entered_amount: int | None
    vat_mode: str | None
    supply: int | None
    vat: int | None
    total: int | None = Field(description="고객이 낼 금액")
    days: int | None
    valid_until: date | None
    created_at: datetime
    updated_at: datetime
    files: list[QuoteFileOut]


class QuoteBriefOut(BaseModel):
    """고객 쪽 요청 목록에 붙는 보낸 최신 견적서 요약"""

    id: uuid.UUID
    code: str
    version: int
    total: int
    days: int | None
    valid_until: date | None
    sent_at: datetime
