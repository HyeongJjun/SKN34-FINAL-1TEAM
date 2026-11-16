"""정밀 계산(precise_dobae · precise_mokgong · market_band)이 같이 쓰는 것."""

from dataclasses import dataclass
from decimal import Decimal
from typing import Literal

from app.calc.common import PYEONG_M2, Basis, Line, m2, won

# 단가 근거: 공공 기준 · 실견적 · 고른 자재 판매가 · 팀 가정값 · 업체 견적에서 확인
PriceBasis = Literal["public", "market", "pick", "assumed", "none"]
# 등급: 화면 이름은 frontend가 정한다 (지금 v2 화면: 베이직 · 스탠다드 · 프리미엄)
Grade = Literal["economy", "basic", "premium"]


@dataclass(frozen=True)
class SilkPaper:
    """고객이 고른 실크벽지 종류와 평당 자재값. 도배 유형(등급) 대신 벽지 줄 값을 정한다"""

    key: str  # 화면 · API에서 부르는 이름 (best · diamant)
    name: str  # 견적서 줄 이름
    per_py: int  # 원/평 (벽지를 바를 넓이 평, 소요량 포함)
    source: str


def silk_qty(paper_m2: Decimal) -> Decimal:
    """벽지 소요량 ㎡ → 평 (0.1평 반올림). 업체 견적서처럼 평으로 센다"""
    return m2(paper_m2 / PYEONG_M2)


def silk_amount(paper_m2: Decimal, s: SilkPaper) -> tuple[Decimal, int]:
    qty = silk_qty(paper_m2)
    return qty, won(qty * s.per_py)


@dataclass(frozen=True)
class V2Line(Line):
    """팀 Line에 자세한 단가 근거와 수량 풀이를 더한 줄. 팀 basis는 공공이 아닌 값을 assumed로 둔다."""

    price_basis: PriceBasis = "public"
    calc: str = ""


def team_basis(b: PriceBasis) -> Basis:
    return "public" if b == "public" else "none" if b == "none" else "assumed"


def num(x: Decimal) -> str:
    """글에 넣는 숫자: 25.0 → 25, 2.4 → 2.4"""
    return format(x.normalize(), "f")
