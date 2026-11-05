"""표준견적서에 넣을 집 크기: 내 집 평수와 계산에 쓸 면적.

- 내 집 평수는 공급면적 기준 평이고 소수 한 자리에서 반올림한다.
  - 정확한 면적: 공급면적이면 ㎡ ÷ 3.3058, 전용면적이면 (㎡ × 공급 환산 비율) ÷ 3.3058.
  - 평형대만 고른 경우: 그 평형대의 대표 평형(집 크기 가정값).
- 공정별 금액 · 품은 dobae · mokgong이 만든다.
"""

from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal

from app.calc.common import PYEONG_M2, AreaBasis, pyeong_to_m2


@dataclass(frozen=True)
class HouseRules:
    """평수 계산에 쓰는 가정값 한 벌. refprice가 버전별로 만들어 넘긴다."""

    version: str
    band_pyeong: dict[str, int]  # 평형대(10 · 20 · 30 · 40 · 50) → 대표 평형 (공급)
    supply_per_exclusive: Decimal  # 전용 → 공급 환산 비율
    source: str


def _py(x: Decimal) -> Decimal:
    return x.quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)


def house_pyeong(
    band: str | None, area_m2: Decimal | None, basis: AreaBasis | None, r: HouseRules
) -> Decimal:
    """내 집 평수 (공급 기준, 소수 한 자리)"""
    if band is not None:
        return _py(Decimal(r.band_pyeong[band]))
    if area_m2 is None or basis is None or area_m2 <= 0:
        raise ValueError("평형대나 면적이 있어야 해요")
    supply = area_m2 if basis == "supply" else area_m2 * r.supply_per_exclusive
    return _py(supply / PYEONG_M2)


def house_area(
    band: str | None, area_m2: Decimal | None, basis: AreaBasis | None, r: HouseRules
) -> tuple[Decimal, AreaBasis]:
    """표준견적서 계산에 넣을 면적: 정확한 면적은 그대로, 평형대는 대표 평형의 공급면적."""
    if band is not None:
        return pyeong_to_m2(Decimal(r.band_pyeong[band])), "supply"
    if area_m2 is None or basis is None or area_m2 <= 0:
        raise ValueError("평형대나 면적이 있어야 해요")
    return area_m2, basis
