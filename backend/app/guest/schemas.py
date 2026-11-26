"""로그인 전 표준견적서 계산 (dev-03). 입력은 project.schemas.HomeInfoIn(가입 뒤 POST /projects와 같은 칸)."""

from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field

LineState = Literal["included", "bundled", "separate", "optional", "after_visit", "excluded"]


class GuestLineOut(BaseModel):
    """표준견적서 줄 (계산 엔진). 합계에는 included · separate만 들어간다."""

    key: str
    name: str
    qty: Decimal | None
    unit: str = Field(description="㎡ · 벽지 평 · 품 · 식 (도배지 줄은 '벽지 평', D07 A)")
    unit_price: int | None
    amount: int | None
    state: LineState
    basis: Literal["public", "market", "assumed", "none"] = Field(
        description="공공 기준 · 시장 데이터 기준(도배지 시장 평균) · 팀 가정값 · 공공 단가 없음"
    )
    source: str = Field(description="출처 이름 (벽지 시장 평균 가격 2026.11 …)")


class GuestPartOut(BaseModel):
    """도배 밖 공정 한 장(목공). 가입 뒤 표준견적서 StandardTradeOut과 같은 계산 엔진 값."""

    trade: Literal["mokgong"]
    lines: list[GuestLineOut]
    supply: int
    vat: int
    total: int = Field(description="부가세 포함")


class GuestSumOut(BaseModel):
    """공정이 둘 이상일 때 모든 공정 합계 (가입 뒤 StandardOut.supply · vat · total과 같음)."""

    supply: int
    vat: int
    total: int = Field(description="부가세 포함")


class GuestStandardOut(BaseModel):
    """저장하지 않는 계산 결과. DB · 로그에 입력을 남기지 않는다."""

    formula_ver: str
    price_ver: str
    market_ver: str | None = Field(default=None, description="벽지 시장 평균 가격 판 (도배지 줄)")
    share_ver: str | None = Field(default=None, description="공간 몫 표 판 (부분 공사일 때만)")
    scope: Literal["full", "partial"]
    area_m2: Decimal
    area_basis: str
    pyeong: Decimal = Field(description="표시용 평 (계산 엔진)")
    lines: list[GuestLineOut]
    supply: int
    vat: int
    total: int = Field(description="부가세 포함")
    days: Decimal = Field(description="예상 공사 일수 (반나절 단위)")
    man_day: Decimal = Field(description="품 (0.5 단위 올림)")
    budget_fit: Literal["within", "over"] | None = Field(
        description="넣은 예산 안 · 밖 (예산을 안 넣었으면 비움)"
    )
    assumptions: list[str] = Field(description="계산에 쓴 가정 (화면 '이렇게 셌어요')")
    parts: list[GuestPartOut] = Field(
        default=[], description="목공 할 곳을 골랐으면 목공 공정 (lines · supply · total은 도배만)"
    )
    sum: GuestSumOut | None = Field(
        default=None,
        description="공정이 둘 이상이면 모든 공정 합계. 예산 안/밖 · days도 이 합계 기준",
    )
