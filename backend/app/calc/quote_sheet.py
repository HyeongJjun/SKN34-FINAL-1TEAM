"""표준견적서 총괄표 (팀 엑셀 양식 '표준견적서_양식' 견적서 시트 모양). DB · HTTP · 시계를 모르는 순수 함수.

v2 표준견적서(v2_quote.build)의 정밀 공정 줄을 자재비 · 시공비 · 경비로 나눠 공정별로 더하고,
순공사비 위에 회사이윤 · 공과잡비 · 산재보험료 · 고용보험료를 요율로 붙인 뒤 단수(끝자리)를 정리한다.
합계(부가세 별도) → 부가세 → 총 금액. 반올림은 won() 한 곳에서만 한다.
"""

from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from decimal import ROUND_FLOOR, ROUND_HALF_UP, Decimal
from typing import Literal

from app.calc.common import COUNTED, with_vat, won

Bucket = Literal["material", "labor", "expense"]


@dataclass(frozen=True)
class Rate:
    key: str
    name: str
    rate: Decimal


# 엑셀 양식의 처음 요율 (양식에서 '요율 수정 가능'). 바꾸면 RATES_VERSION을 올린다
RATES_VERSION = "sheet-2026.11"
RATES: tuple[Rate, ...] = (
    Rate("profit", "회사이윤", Decimal("0.05")),
    Rate("misc", "공과잡비", Decimal("0.02")),
    Rate("injury", "산재보험료", Decimal("0.011")),
    Rate("employ", "고용보험료", Decimal("0.0042")),
)
CUT_UNIT = 10_000  # 단수: 만 원 아래를 버린다

# 줄 → 비용 종류. 공공 일위대가 시공 단가(풀 · 소모 자재 포함)는 시공비로 본다
MATERIAL_KEYS = frozenset({"paper", "primer"})
EXPENSE_KEYS = frozenset({"waste", "moving"})


def bucket_of(key: str) -> Bucket:
    if key in MATERIAL_KEYS or key.endswith("_mat"):
        return "material"
    if key in EXPENSE_KEYS:
        return "expense"
    return "labor"


@dataclass(frozen=True)
class SheetLine:
    key: str
    name: str
    qty: Decimal | None
    unit: str
    amount: int | None
    state: str
    bucket: Bucket
    counted: bool  # 합계에 들어가는 줄 (포함 · 따로 계산)


@dataclass(frozen=True)
class SheetTrade:
    trade: str
    ko: str
    material: int
    labor: int
    expense: int
    total: int
    share: Decimal  # 순공사비 중 비중 % (소수 한 자리)
    bar: int  # 가장 큰 공정을 100으로 본 막대 길이
    days: Decimal
    lines: list[SheetLine]


@dataclass(frozen=True)
class Overhead:
    key: str
    name: str
    rate: Decimal  # 0.05 = 5%
    amount: int


@dataclass(frozen=True)
class Sheet:
    trades: list[SheetTrade]
    material: int
    labor: int
    expense: int
    net: int  # 순공사비
    mix: dict[Bucket, Decimal]  # 순공사비 구성비 % (자재비 : 시공비 : 경비)
    overheads: list[Overhead]
    cut: int  # 단수 (0 이하)
    supply: int  # 합계 금액 (부가세 별도)
    vat: int
    total: int  # 총 금액 (부가세 포함)
    per_pyeong: int  # 평당 (부가세 포함)
    pyeong: Decimal
    rates_version: str


def _pct(part: int, whole: int) -> Decimal:
    if whole <= 0:
        return Decimal(0)
    return (Decimal(part) * 100 / whole).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)


def _trade(t: Mapping) -> tuple[dict, list[SheetLine]]:
    sums: dict[Bucket, int] = {"material": 0, "labor": 0, "expense": 0}
    lines = []
    for ln in t["lines"]:
        b = bucket_of(ln["key"])
        counted = ln["state"] in COUNTED and ln["amount"] is not None
        if counted:
            sums[b] += ln["amount"]
        qty = ln["qty"]
        lines.append(
            SheetLine(
                ln["key"],
                ln["name"],
                None if qty is None else Decimal(str(qty)),
                ln["unit"],
                ln["amount"],
                ln["state"],
                b,
                counted,
            )
        )
    if sum(sums.values()) != t["supply"]:
        raise ValueError("공정 줄 합계가 공급가와 맞지 않아요")
    return sums, lines


def build(precise: Iterable[Mapping], pyeong: Decimal, rates: tuple[Rate, ...] = RATES) -> Sheet:
    """precise: v2_quote.build 결과의 'precise' (공정마다 trade · ko · lines · supply · days)."""
    if pyeong <= 0:
        raise ValueError("평형은 0보다 커야 해요")
    rows = [(t, *_trade(t)) for t in precise]
    net = sum(t["supply"] for t, _, _ in rows)
    top = max((t["supply"] for t, _, _ in rows), default=0)
    trades = [
        SheetTrade(
            t["trade"],
            t["ko"],
            s["material"],
            s["labor"],
            s["expense"],
            t["supply"],
            _pct(t["supply"], net),
            won(Decimal(t["supply"]) * 100 / top) if top else 0,
            Decimal(str(t["days"])),
            lines,
        )
        for t, s, lines in rows
    ]
    material = sum(t.material for t in trades)
    labor = sum(t.labor for t in trades)
    expense = sum(t.expense for t in trades)
    overheads = [Overhead(r.key, r.name, r.rate, won(Decimal(net) * r.rate)) for r in rates]
    before = net + sum(o.amount for o in overheads)
    supply = int((Decimal(before) / CUT_UNIT).to_integral_value(rounding=ROUND_FLOOR)) * CUT_UNIT
    money = with_vat(supply)
    return Sheet(
        trades=trades,
        material=material,
        labor=labor,
        expense=expense,
        net=net,
        mix={
            "material": _pct(material, net),
            "labor": _pct(labor, net),
            "expense": _pct(expense, net),
        },
        overheads=overheads,
        cut=supply - before,
        supply=money.supply,
        vat=money.vat,
        total=money.total,
        per_pyeong=won(Decimal(money.total) / pyeong),
        pyeong=pyeong,
        rates_version=RATES_VERSION,
    )
