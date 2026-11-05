import re
import uuid
from datetime import date, datetime, time
from decimal import Decimal
from typing import Annotated, Literal
from urllib.parse import urlsplit

from pydantic import (
    AwareDatetime,
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    field_validator,
    model_validator,
)

from app.auth.schemas import clean_name, normalize_email, normalize_phone
from app.vendor.models import LINKS_MAX, NEEDS_INFO_CODES, PORTFOLIO_MAX, REJECT_CODES

Trade = Literal["dobae", "mokgong"]
# 전화 · 문자 · 카카오톡 채널 · 홈페이지 상담
ContactMethod = Literal["phone", "sms", "kakao", "web"]
FaqKey = Literal["process", "pricing", "extra_cost", "duration", "as_refund"]
Text = Annotated[str, StringConstraints(strip_whitespace=True)]
VISIT_FEE_MAX = 1_000_000


def clean_url(v: str | None) -> str | None:
    """비면 None. 'www.example.com'처럼 적으면 https://를 붙인다. http · https만 받는다."""
    v = (v or "").strip()
    if not v:
        return None
    if "://" not in v:
        v = "https://" + v
    try:
        parts = urlsplit(v)
        ok = parts.scheme in ("http", "https") and "." in (parts.hostname or "")
    except ValueError:  # 대괄호가 깨진 주소 같은 것
        ok = False
    if not ok or any(c.isspace() for c in v):
        raise ValueError("주소를 확인해 주세요. 예: https://www.example.com")
    if len(v) > 300:
        raise ValueError("주소는 300자까지 적을 수 있어요.")
    return v


def _blank_none(v: str | None) -> str | None:
    return v or None


def _local_time(v: time | None) -> time | None:
    if v is not None and v.tzinfo is not None:
        raise ValueError("시각만 적어 주세요. 예: 09:00")
    return v


class AreaIn(BaseModel):
    sido: str
    sgg: str


class AreaOut(AreaIn):
    label: str  # 서울 노원구


def _biz_name(v: str) -> str:
    v = " ".join(v.split())
    if not v:
        raise ValueError("상호를 적어 주세요.")
    return v


def normalize_biz_no(v: str) -> str:
    """214-86-03518 · 2148603518 → 2148603518"""
    digits = re.sub(r"[\s-]", "", v)
    if not re.fullmatch(r"[0-9]{10}", digits):
        raise ValueError("사업자등록번호 10자리를 넣어 주세요.")
    return digits


class ApplicationFields(BaseModel):
    """가입 신청서 칸. 가입 · 거절 뒤 다시 신청이 같이 쓴다 (사업자등록번호는 가입 때만 받는다)."""

    biz_name: str = Field(max_length=100, description="상호")
    owner_name: str = Field(max_length=50, description="대표자 이름")
    phone: str = Field(max_length=20, description="휴대폰 (승인 뒤 실측을 요청한 고객에게 보인다)")
    trades: list[Trade] = Field(min_length=1, max_length=2)
    areas: list[AreaIn] = Field(min_length=1, max_length=100)

    _biz = field_validator("biz_name")(_biz_name)
    _owner = field_validator("owner_name")(clean_name)
    _phone = field_validator("phone")(normalize_phone)


class VendorSignupIn(ApplicationFields):
    """업체 가입 신청. 사업자등록증 파일은 multipart로 따로 받는다. 관리자가 승인하면 업체 기능을 쓴다."""

    name: str | None = Field(default=None, max_length=50, description="담당자 이름 (비우면 대표자)")
    email: str = Field(max_length=254)
    password: str = Field(min_length=8, max_length=128)
    biz_no: str = Field(max_length=20, description="사업자등록번호 10자리 (- 는 빼도 된다)")

    _email = field_validator("email")(normalize_email)
    _biz_no = field_validator("biz_no")(normalize_biz_no)

    @field_validator("name")
    @classmethod
    def _name(cls, v: str | None) -> str | None:
        return clean_name(v) if v and v.strip() else None

    @field_validator("areas", mode="before")
    @classmethod
    def _areas(cls, v):
        """multipart 폼은 지역을 'seoul/노원구'처럼 글로 보낸다."""
        if isinstance(v, list):
            return [
                dict(zip(("sido", "sgg"), x.split("/", 1), strict=False))
                if isinstance(x, str)
                else x
                for x in v
            ]
        return v


class ReapplyIn(ApplicationFields):
    """거절된 업체가 같은 계정 · 같은 사업자등록번호로 다시 신청. 새 등록증은 먼저 POST /files (kind=license)."""

    model_config = ConfigDict(extra="forbid")

    license_file_id: uuid.UUID | None = None


class ResubmitIn(BaseModel):
    """보완 요청에 다시 보내기. 관리자가 고른 사유에 맞게 열린 칸만 받는다(열리지 않은 칸은 422)."""

    model_config = ConfigDict(extra="forbid")

    biz_name: str | None = Field(default=None, max_length=100)
    owner_name: str | None = Field(default=None, max_length=50)
    license_file_id: uuid.UUID | None = None

    _biz = field_validator("biz_name")(lambda v: None if v is None else _biz_name(v))
    _owner = field_validator("owner_name")(lambda v: None if v is None else clean_name(v))


class ReviewIn(BaseModel):
    """관리자 결정 저장: 승인 · 보완 요청 · 거절. 직접 쓰기(other)면 업체에 보낼 말이 꼭 있어야 한다."""

    action: Literal["approve", "needs_info", "reject"]
    code: str | None = Field(default=None, max_length=20)
    note: Annotated[Text, Field(max_length=300)] | None = None
    opened_on: date | None = Field(default=None, description="등록증에서 읽은 개업일 (선택)")

    _note = field_validator("note")(_blank_none)

    @model_validator(mode="after")
    def _codes(self) -> "ReviewIn":
        if self.action == "approve" and (self.code or self.note):
            raise ValueError("승인할 때는 사유와 보낼 말을 넣지 않아요.")
        if self.action == "needs_info" and self.code not in NEEDS_INFO_CODES:
            raise ValueError("보완 요청 사유를 골라 주세요.")
        if self.action == "reject" and self.code not in REJECT_CODES:
            raise ValueError("거절 사유를 골라 주세요.")
        if self.code == "other" and not self.note:
            raise ValueError("업체에 보낼 말을 적어 주세요.")
        return self


class LicenseOut(BaseModel):
    id: uuid.UUID
    filename: str
    content_type: str
    size: int
    created_at: datetime


class ReviewOut(BaseModel):
    """처리 기록 한 줄"""

    id: uuid.UUID
    action: str
    code: str | None
    note: str | None
    changes: dict | None = Field(description="다시 낼 때 바뀐 칸의 전 값")
    by_id: uuid.UUID | None
    by_name: str | None
    at: datetime


class VendorAdminOut(BaseModel):
    """관리자 업체 심사 목록 · 자세히"""

    user_id: uuid.UUID
    name: str
    email: str
    status: str
    review_code: str | None
    review_note: str | None
    created_at: datetime
    reviewed_at: datetime | None
    approved_at: datetime | None
    opened_on: date | None
    submitted_at: datetime | None = Field(description="마지막으로 낸 때 (가입 · 보완 · 다시 신청)")
    waiting_days: int | None = Field(description="낸 뒤 지난 날 수 (서울 날짜, 0 = 오늘)")
    resubmitted: bool = Field(description="보완 · 다시 신청으로 다시 낸 신청인지")
    changes: dict | None = Field(description="다시 낸 신청이면 바뀐 칸의 전 값")
    biz_name: str | None
    owner_name: str | None
    biz_no: str | None
    phone: str | None
    address: str | None
    site_url: str | None
    trades: list[str]
    areas: list[AreaOut]
    intro: str
    license_file_id: uuid.UUID
    license: LicenseOut | None


class VendorAdminDetailOut(VendorAdminOut):
    reviews: list[ReviewOut] = Field(description="처리 기록 (최근 순)")


class ReviewSummaryOut(BaseModel):
    pending: int
    needs_info: int
    done: int


class OpenFieldOut(BaseModel):
    field: Literal["biz_name", "owner_name", "license_file_id"]
    required: bool


class DecisionOut(BaseModel):
    action: str
    code: str | None
    note: str | None
    at: datetime


class ApplicationOut(BaseModel):
    """업체 홈의 가입 심사 칸 (승인 전에도 본인만)"""

    status: str
    applied_at: datetime | None = Field(description="마지막으로 낸 때")
    approved_at: datetime | None
    biz_name: str | None
    owner_name: str | None
    biz_no: str | None
    phone: str | None
    trades: list[str]
    areas: list[AreaOut]
    license: LicenseOut | None
    decision: DecisionOut | None = Field(description="최근 관리자 결정")
    open_fields: list[OpenFieldOut] = Field(description="보완 요청일 때 열리는 칸")


class FaqIn(BaseModel):
    key: FaqKey
    answer: Annotated[Text, Field(max_length=200)]  # 비우면 그 질문은 지운다


class LinkIn(BaseModel):
    label: Annotated[Text, Field(max_length=40)] | None = None
    url: str

    _label = field_validator("label")(_blank_none)

    @field_validator("url")
    @classmethod
    def _url(cls, v: str) -> str:
        out = clean_url(v)
        if out is None:
            raise ValueError("주소를 적어 주세요.")
        return out


class PortfolioMeta(BaseModel):
    title: Annotated[Text, Field(min_length=1, max_length=60)]
    space: Annotated[Text, Field(max_length=20)] | None = None
    pyeong: int | None = Field(default=None, ge=1, le=200)
    taken_on: date | None = None

    _space = field_validator("space")(_blank_none)


class PortfolioIn(PortfolioMeta):
    """시공 사진 더하기. 사진은 먼저 POST /files (kind=portfolio)로 올린다."""

    file_id: uuid.UUID


class PortfolioEdit(PortfolioMeta):
    id: uuid.UUID


class PortfolioOut(PortfolioMeta):
    id: uuid.UUID
    file_id: uuid.UUID


class ProfileIn(BaseModel):
    """업체 정보 통째로 저장. 상호 · 대표자 · 사업자번호 · 개업일은 심사 대상이라 여기서 바꾸지 않는다."""

    updated_at: AwareDatetime | None = Field(
        description="GET에서 받은 값 그대로. 그 사이 다른 곳에서 저장했으면 409"
    )
    phone: str = Field(max_length=20)
    address: Annotated[Text, Field(max_length=200)] | None = None
    site_url: str | None = None
    trades: list[Trade] = Field(min_length=1, max_length=2)
    areas: list[AreaIn] = Field(min_length=1, max_length=100)
    contact_method: ContactMethod
    contact_url: str | None = Field(
        default=None, description="카카오톡 채널 · 홈페이지 상담일 때 필수"
    )
    call_start: time | None = None
    call_end: time | None = None
    visit_fee: int = Field(ge=0, le=VISIT_FEE_MAX, description="원, 부가세 포함. 0 = 무료")
    visit_fee_refund: bool = False
    tax_kind: Literal["general", "exempt"] = "general"
    interior_license: Annotated[Text, Field(max_length=100)] | None = None
    insurance: Annotated[Text, Field(max_length=100)] | None = None
    faqs: list[FaqIn] = Field(default_factory=list, max_length=5)
    links: list[LinkIn] = Field(default_factory=list, max_length=LINKS_MAX)
    portfolio: list[PortfolioEdit] | None = Field(
        default=None,
        max_length=PORTFOLIO_MAX,
        description="보내면 사진 설명 · 순서를 바꾼다. 지금 있는 사진을 모두 담는다",
    )

    _phone = field_validator("phone")(normalize_phone)
    _site = field_validator("site_url", "contact_url")(clean_url)
    _blank = field_validator("address", "interior_license", "insurance")(_blank_none)
    _time = field_validator("call_start", "call_end")(_local_time)

    @model_validator(mode="after")
    def _check(self) -> "ProfileIn":
        if self.contact_method in ("kakao", "web") and self.contact_url is None:
            raise ValueError("채널 · 상담 주소를 넣어 주세요.")
        if (self.call_start is None) != (self.call_end is None):
            raise ValueError("통화 가능 시간은 시작과 끝을 함께 골라 주세요.")
        if self.call_start is not None and self.call_start >= self.call_end:
            raise ValueError("통화 가능 시간의 끝을 시작보다 늦게 골라 주세요.")
        if self.visit_fee_refund and self.visit_fee == 0:
            raise ValueError("출장비를 받을 때만 '계약하면 빼 줘요'를 고를 수 있어요.")
        if len({f.key for f in self.faqs}) != len(self.faqs):
            raise ValueError("같은 질문의 답을 두 번 적었어요.")
        if self.portfolio is not None and len({p.id for p in self.portfolio}) != len(
            self.portfolio
        ):
            raise ValueError("같은 사진이 두 번 들어 있어요.")
        return self


class PublicCardOut(BaseModel):
    """고객이 보는 업체 목록 한 줄. 휴대폰 · 채널 주소는 넣지 않는다(실측 요청 뒤 visit이 보여 준다)."""

    vendor_id: uuid.UUID
    biz_name: str | None
    trades: list[str]
    areas: list[AreaOut]
    verified_at: datetime | None = Field(description="믿집이 사업자를 확인(승인)한 때")
    contact_method: str | None
    call_start: time | None
    call_end: time | None
    visit_fee: int | None
    visit_fee_refund: bool
    tax_kind: str


class PublicProfileOut(PublicCardOut):
    """고객이 보는 업체 자세히. '업체가 적음' 칸(실내건축 · 보험)이 비면 '확인 안 됨'으로 보인다."""

    owner_name: str | None
    biz_no: str | None
    opened_on: date | None
    address_area: str | None = Field(description="사업장 주소의 앞 두 마디 (서울 도봉구)")
    interior_license: str | None
    insurance: str | None
    faqs: list[FaqIn]
    links: list[LinkIn]
    portfolio: list[PortfolioOut]
    updated_at: datetime | None


class ProfileOut(PublicProfileOut):
    """업체 본인이 보는 업체 정보 (고치는 화면)"""

    phone: str | None
    address: str | None
    site_url: str | None
    contact_url: str | None


UNIT_PRICE_MAX = 10_000_000


class PriceLineIn(BaseModel):
    """표준 행 단가 한 줄: unit_price(원, 부가세 빼고) 또는 included_in(같은 묶음의 다른 줄 키)"""

    key: str = Field(max_length=20)
    unit_price: int | None = Field(default=None, ge=0, le=UNIT_PRICE_MAX)
    included_in: str | None = Field(default=None, max_length=20)
    source_file_id: uuid.UUID | None = Field(default=None, description="근거 파일 (선택)")

    @model_validator(mode="after")
    def _one(self) -> "PriceLineIn":
        if (self.unit_price is None) == (self.included_in is None):
            raise ValueError("단가를 넣거나 '다른 줄에 포함'을 골라 주세요.")
        if self.included_in == self.key:
            raise ValueError("자기 줄에는 포함할 수 없어요.")
        return self


class PriceSetIn(BaseModel):
    """고치는 중인 단가 묶음(draft) 통째로 저장. 확인하기 전에는 고객에게 쓰지 않는다."""

    lines: list[PriceLineIn] = Field(default_factory=list, max_length=20)

    @model_validator(mode="after")
    def _unique(self) -> "PriceSetIn":
        if len({ln.key for ln in self.lines}) != len(self.lines):
            raise ValueError("같은 줄을 두 번 넣었어요.")
        return self


class PriceLineOut(BaseModel):
    key: str
    unit_price: int | None
    included_in: str | None
    source_file_id: uuid.UUID | None


class EstimateLineOut(BaseModel):
    key: str = Field(description="표준견적서 줄 키")
    price_key: str = Field(description="업체 단가 키 (도배지는 paper_basic · paper_economy)")
    name: str
    unit: str
    qty: Decimal
    unit_price: int | None = Field(description="다른 줄에 포함이면 비어 있다")
    included_in: str | None
    included_in_name: str | None = Field(description="포함한 줄 이름 (도배지 (실크))")
    amount: int
    source: str | None = Field(description="근거 파일 이름")


class EstimateOut(BaseModel):
    """가견적 (믿집 계산): 업체 단가 × 표준견적서 수량. 금액은 원, 부가세는 따로."""

    lines: list[EstimateLineOut]
    supply: int
    vat: int
    total: int
    missing: list[str] = Field(description="업체 단가가 없어 뺀 표준 행 키")
    left_out: list[str] = Field(description="업체 단가를 받지 않는 줄이라 뺀 키 (짐 있는 집 할증)")


class PriceSetOut(BaseModel):
    id: uuid.UUID
    version: int
    status: str
    created_at: datetime
    confirmed_at: datetime | None
    lines: list[PriceLineOut]
    example: EstimateOut = Field(description="고객에게 보이는 모습 · 32평 아파트(빈 집) 예")


class PriceRowOut(BaseModel):
    key: str
    name: str
    unit: str


class PriceFileIn(BaseModel):
    """가견적 근거 파일 붙이기. 파일은 먼저 POST /files (kind=price_doc)로 올린다."""

    file_id: uuid.UUID
    trade: Trade


class PriceFileOut(BaseModel):
    file_id: uuid.UUID
    trade: str
    filename: str
    content_type: str
    size: int
    created_at: datetime


class PricesOut(BaseModel):
    """업체 정보 '03 가견적에 쓸 견적서': 단가를 넣는 표준 행 · 근거 파일 · 고치는 중 · 확인한 묶음"""

    trade: str
    rows: list[PriceRowOut]
    files: list[PriceFileOut]
    draft: PriceSetOut | None
    confirmed: PriceSetOut | None


class ContactOut(BaseModel):
    """업체 연락처. 실측을 요청한 고객에게만, 연락처 공개 규칙(visit.service)을 지날 때만 보인다."""

    owner_name: str | None
    phone: str | None
    contact_method: str | None
    contact_url: str | None
    call_start: time | None
    call_end: time | None
    visit_fee: int | None
    visit_fee_refund: bool
