"""가견적: 업체가 확인한 단가 × 이 집 표준견적서 수량.

- 수량은 표준견적서 줄 수량을 그대로 쓴다. 합계에 들어가는 줄(포함 · 따로 계산)만 본다.
  실측 후 줄(철거 · 폐기물 · 짐 이동)은 업체 단가를 받지 않으니 처음부터 보지 않는다.
- 업체 단가는 부가세 빼고 적는다. '다른 줄에 포함'(included_in) 줄은 0원이다.
- 업체 단가가 없는 줄은 빼고 missing에 남긴다. 단가를 받는 표준 행이 아닌 줄(짐 있는 집 할증처럼
  수량이 없는 줄)은 left_out에 남긴다.
- 부가세는 공급가에 한 번만 붙인다(common.with_vat). 면세 업체는 0원.
"""

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from decimal import Decimal

from app.calc.common import COUNTED, Money, with_vat, won
from app.calc.dobae import GRADE_PAPER


@dataclass(frozen=True)
class PriceRow:
    """업체가 단가를 넣는 표준 행 (부가세 빼고, 단위당)"""

    key: str
    name: str
    unit: str


# 공정별로 업체 단가를 받는 표준 행. 키는 계산 엔진 줄 키와 같고, 도배지만 등급마다 따로 받는다
PRICE_ROWS: dict[str, tuple[PriceRow, ...]] = {
    "dobae": (
        PriceRow("wall", "벽 도배 시공 (풀 포함)", "㎡"),
        PriceRow("ceiling", "천장 도배 시공 (풀 포함)", "㎡"),
        *(PriceRow(f"paper_{g}", f"도배지 ({GRADE_PAPER[g]})", "㎡") for g in ("basic", "economy")),
        PriceRow("primer", "초배지", "㎡"),
    ),
    "mokgong": (
        PriceRow("frame", "천장 평탄화 · 경량천장틀", "㎡"),
        PriceRow("board", "천장 평탄화 · 석고보드 1겹", "㎡"),
        PriceRow("ceiling_mat", "천장틀 · 석고보드 자재", "㎡"),
        PriceRow("door", "방문 교체 (문틀 · 문짝)", "개"),
        PriceRow("casing", "문선 설치 (문 둘레 양면)", "m"),
        PriceRow("door_mat", "방문 자재 (ABS 문틀 · 문짝 · 문선)", "개"),
        PriceRow("molding", "천장 몰딩 설치", "m"),
        PriceRow("molding_mat", "몰딩 자재", "m"),
        PriceRow("base", "걸레받이 설치 (MDF)", "m"),
        PriceRow("base_mat", "걸레받이 자재", "m"),
    ),
}
PRICE_KEYS: dict[str, tuple[str, ...]] = {
    t: tuple(r.key for r in rows) for t, rows in PRICE_ROWS.items()
}


def price_key(line_key: str, grade: str | None) -> str:
    """표준견적서 줄 키 → 업체 단가 키. 도배지는 고객이 고른 등급의 단가를 쓴다."""
    return f"paper_{grade}" if line_key == "paper" and grade else line_key


@dataclass(frozen=True)
class StdLine:
    """표준견적서 줄에서 가견적에 쓰는 것"""

    key: str
    qty: Decimal | None
    state: str


@dataclass(frozen=True)
class VendorPrice:
    """업체 단가 한 줄: 단가(원, 부가세 빼고) 또는 다른 줄에 포함"""

    unit_price: int | None = None
    included_in: str | None = None

    def __post_init__(self) -> None:
        if (self.unit_price is None) == (self.included_in is None):
            raise ValueError("단가와 '다른 줄에 포함' 중 하나만 있어야 해요")
        if self.unit_price is not None and self.unit_price < 0:
            raise ValueError("단가는 0 이상이어야 해요")


@dataclass(frozen=True)
class EstimateLine:
    key: str  # 표준견적서 줄 키
    price_key: str  # 업체 단가 키 (도배지는 paper_basic · paper_economy)
    qty: Decimal
    unit_price: int | None  # 다른 줄에 포함이면 None
    included_in: str | None
    amount: int


@dataclass(frozen=True)
class Estimate:
    lines: tuple[EstimateLine, ...]
    supply: int
    vat: int
    total: int
    missing: tuple[str, ...]  # 업체 단가가 없어 뺀 표준 행
    left_out: tuple[str, ...]  # 업체 단가를 받지 않는 줄이라 뺀 것


def estimate(
    lines: Sequence[StdLine],
    prices: Mapping[str, VendorPrice],
    *,
    trade: str,
    grade: str | None = None,
    exempt: bool = False,
) -> Estimate:
    keys = PRICE_KEYS[trade]
    # 포함 대상은 이번 집에서 수량과 직접 단가로 실제 계산하는 줄이어야 한다.
    priced_keys = {
        price_key(ln.key, grade)
        for ln in lines
        if ln.state in COUNTED
        and ln.qty is not None
        and ln.qty > 0
        and price_key(ln.key, grade) in keys
        and (vp := prices.get(price_key(ln.key, grade))) is not None
        and vp.unit_price is not None
    }
    out: list[EstimateLine] = []
    missing: list[str] = []
    left_out: list[str] = []
    for ln in lines:
        if ln.state not in COUNTED:
            continue
        pk = price_key(ln.key, grade)
        if pk not in keys or ln.qty is None:
            left_out.append(ln.key)
            continue
        vp = prices.get(pk)
        if vp is None:
            missing.append(ln.key)
        elif vp.included_in is not None:
            if vp.included_in in priced_keys:
                out.append(EstimateLine(ln.key, pk, ln.qty, None, vp.included_in, 0))
            else:
                missing.append(ln.key)
        else:
            amount = won(ln.qty * vp.unit_price)
            out.append(EstimateLine(ln.key, pk, ln.qty, vp.unit_price, None, amount))
    supply = sum(x.amount for x in out)
    money = Money(supply, 0, supply) if exempt else with_vat(supply)
    return Estimate(
        tuple(out), money.supply, money.vat, money.total, tuple(missing), tuple(left_out)
    )
