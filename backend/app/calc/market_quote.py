"""도배 · 목공(문 포함) 표준견적서: 업체 견적서 235건 시장 단가 기준. DB · HTTP · 시계를 모르는 순수 함수.

양식은 팀 엑셀 '표준견적서_양식'을 따른다: 줄마다 자재비 · 인건비 · 경비 → 순공사비
→ 회사이윤 · 공과잡비 · 산재보험료 · 고용보험료(순공사비 × 요율) → 단수(만 원 아래 버림) → 부가세.
목공은 기본 항목과 소비자가 고르는 선택 항목으로 나눈다. 선택 항목마다 넣고 뺄 때 총액이 얼마 바뀌는지도 낸다.
"""

from collections.abc import Callable, Mapping
from dataclasses import dataclass, replace
from decimal import ROUND_CEILING, ROUND_FLOOR, ROUND_HALF_UP, Decimal
from typing import Literal

from app.calc.common import PYEONG_M2, Money, with_vat, won

Wallpaper = Literal["hapji", "silk"]
DoorKind = Literal["abs", "emboss"]
Jungmun = Literal["slim3", "slide", "swing"]
Kind = Literal["material", "labor", "expense"]

WALLPAPER_ITEM = {"hapji": "1203-basic", "silk": "1203-comfort"}
DOOR_ITEM = {"abs": "312-basic", "emboss": "312-comfort"}
JUNGMUN_ITEM = {"slim3": "310-basic", "slide": "310-comfort", "swing": "310-signature"}

# 양식 요율 (순공사비 × 요율, '요율 수정 가능')
RATES: tuple[tuple[str, str, Decimal], ...] = (
    ("profit", "회사이윤", Decimal("0.05")),
    ("misc", "공과잡비", Decimal("0.02")),
    ("injury", "산재보험료", Decimal("0.011")),
    ("employ", "고용보험료", Decimal("0.0042")),
)
CUT_UNIT = 10_000
DEFAULT_SHARE = Decimal("0.8")  # 235건 중 이 비율 이상 들어간 선택 항목은 처음에 켠다


@dataclass(frozen=True)
class OptionDef:
    key: str
    name: str
    desc: str
    item: str  # 등장 건수를 볼 대표 품목


# 목공 선택 항목 (문 공정을 합쳤다)
OPTIONS: tuple[OptionDef, ...] = (
    OptionDef(
        "doors",
        "방문 교체",
        "방 · 욕실 문을 문틀째 새것으로 바꿔요 (문짝 · 문틀 · 손잡이 · 문선)",
        "313",
    ),
    OptionDef("jungmun", "현관 중문 설치", "현관과 거실 사이에 유리 중문을 달아요", "310-basic"),
    OptionDef(
        "entry_hw", "현관문 철물 교체", "현관문 잠금장치 · 도어클로저 · 스토퍼를 바꿔요", "304"
    ),
    OptionDef(
        "board",
        "천장 · 벽 보드 보수",
        "들뜨거나 갈라진 천장 · 벽을 석고보드 · 각재로 다시 잡아요",
        "1317",
    ),
    OptionDef(
        "insulation",
        "외벽 단열 보강",
        "바깥과 닿은 벽에 단열재 · 단열 보드를 덧대 결로 · 곰팡이를 줄여요",
        "1319",
    ),
    OptionDef(
        "bath_board",
        "욕실 천장 방수 보드",
        "욕실 천장을 습기에 강한 방수 석고보드로 바꿔요",
        "1318",
    ),
)
OPTION_KEYS = frozenset(o.key for o in OPTIONS)


@dataclass(frozen=True)
class Book:
    version: str
    quotes: int
    items: Mapping[str, Mapping]
    coef: Mapping[str, float]


@dataclass(frozen=True)
class Input:
    pyeong: Decimal  # 공급평형
    rooms: int
    baths: int
    dobae: bool = True
    mokgong: bool = True
    wallpaper: Wallpaper = "silk"
    door: DoorKind = "abs"
    jungmun: Jungmun = "slim3"
    options: frozenset[str] | None = None  # 켠 선택 항목. None이면 235건에서 흔한 것


@dataclass(frozen=True)
class QLine:
    item: str
    group: str  # base 또는 선택 항목 키
    name: str
    spec: str
    kind: Kind
    qty: Decimal
    unit: str
    unit_price: int
    amount: int
    qty_why: str  # 수량을 어떻게 셌는지
    price_why: str  # 업체 235건에서 이 단가가 어디쯤인지
    note: str


@dataclass(frozen=True)
class QTrade:
    key: Literal["dobae", "mokgong"]
    name: str
    material: int
    labor: int
    expense: int
    total: int
    share: Decimal
    lines: list[QLine]


@dataclass(frozen=True)
class QOption:
    key: str
    name: str
    desc: str
    on: bool
    common: bool  # 235건 중 80% 이상에 들어간 항목 (처음에 켠다)
    seen: int  # 235건 중 들어간 건수
    amount: int  # 이 항목 줄 합 (순공사비)
    delta: int  # 켜고 끌 때 총액(부가세 포함) 변화. 켜져 있으면 빼면 줄어드는 금액(음수)


@dataclass(frozen=True)
class Overhead:
    key: str
    name: str
    rate: Decimal
    amount: int


@dataclass(frozen=True)
class Quote:
    pyeong: Decimal
    rooms: int
    baths: int
    doors: int
    trades: list[QTrade]
    options: list[QOption]
    material: int
    labor: int
    expense: int
    net: int  # 순공사비
    overheads: list[Overhead]
    cut: int
    supply: int
    vat: int
    total: int
    per_pyeong: int  # 평당 (부가세 포함)
    quotes: int
    version: str


def _r(x: Decimal, places: int = 0) -> Decimal:
    return x.quantize(Decimal(1).scaleb(-places), rounding=ROUND_HALF_UP)


def _up(x: Decimal) -> Decimal:
    return x.to_integral_value(rounding=ROUND_CEILING)


def _num(x: Decimal) -> str:
    s = format(x.normalize(), "f")
    return f"{int(s):,}" if "." not in s else s


def pyeong_from_m2(m2: Decimal, supply_per_exclusive: Decimal | None = None) -> Decimal:
    """면적 ㎡ → 공급평형 (소수 한 자리). 전용면적이면 공급면적으로 바꾼 뒤 센다"""
    if m2 <= 0:
        raise ValueError("면적은 0보다 커야 해요")
    if supply_per_exclusive is not None:
        m2 = m2 * supply_per_exclusive
    return _r(m2 / PYEONG_M2, 1)


def default_rooms(py: Decimal) -> tuple[int, int]:
    """평형만 넣었을 때 방 · 욕실 수 (아파트 흔한 구성)"""
    if py < 18:
        return 2, 1
    if py < 25:
        return 3, 1
    if py < 40:
        return 3, 2
    return 4, 2


def common_options(book: Book) -> frozenset[str]:
    """235건 중 80% 이상에 들어간 선택 항목"""
    return frozenset(o.key for o in OPTIONS if _seen(book, o) >= DEFAULT_SHARE * book.quotes)


def _seen(book: Book, o: OptionDef) -> int:
    return int(book.items[o.item]["n"])


def _price_why(it: Mapping, quotes: int) -> str:
    n, lo, hi = it["n"], it["p25"], it["p75"]
    if lo is None or hi is None:
        return f"업체 {quotes}건 중 {n}건에 있어요"
    if lo == hi:
        return f"업체 {quotes}건 중 {n}건, 대부분 {lo:,}원"
    return f"업체 {quotes}건 중 {n}건, 보통 {lo:,} ~ {hi:,}원"


def _lines(inp: Input, book: Book) -> tuple[list[QLine], list[QLine], int]:
    py, c = inp.pyeong, {k: Decimal(str(v)) for k, v in book.coef.items()}
    doors = inp.rooms + inp.baths
    on = common_options(book) if inp.options is None else inp.options
    pyn = _num(py)

    def per_py(
        key: str, rnd: Callable[[Decimal], Decimal], how: str, unit: str
    ) -> tuple[Decimal, str]:
        q = rnd(c[key] * py)
        return q, f"{pyn}평 × {_num(c[key])} = {_num(q)}{unit} ({how}, 235건 중앙값 비율)"

    def line(item: str, group: str, qty: Decimal, why: str) -> QLine:
        it = book.items[item]
        p = int(it["price"])
        return QLine(
            item,
            group,
            it["name"],
            it["spec"],
            it["kind"],
            qty,
            it["unit"],
            p,
            won(qty * p),
            why,
            _price_why(it, book.quotes),
            it["note"],
        )

    one = (Decimal(1), "1회분")
    dobae: list[QLine] = []
    if inp.dobae:
        area, area_why = per_py("도배면적", _r, "반올림", "평")
        crew, crew_why = per_py("품_도배", _up, "올림", "품")
        dobae = [
            line("1201", "base", py, f"공급 {pyn}평 전체"),
            line(WALLPAPER_ITEM[inp.wallpaper], "base", area, f"벽 + 천장 {area_why}"),
            line("1205", "base", py, f"공급 {pyn}평 전체"),
            line("1206", "base", crew, f"도배공 {crew_why}"),
            line("1207", "base", crew, "인력 수만큼"),
            line("1208", "base", *one),
        ]
    mok: list[QLine] = []
    if inp.mokgong:
        crew, crew_why = per_py("품_목공", _up, "올림", "품")
        mok = [
            line("1302", "base", *per_py("몰딩", _up, "올림", "개")),
            line("1304", "base", *per_py("걸레받이", _up, "올림", "개")),
            line("1306", "base", crew, f"목수 {crew_why}"),
            line("1307", "base", crew, "인력 수만큼"),
            line("1305", "base", *one),
            line("1308", "base", *one),
        ]
        if "doors" in on:
            d, dwhy = Decimal(doors), f"방 {inp.rooms} + 욕실 {inp.baths} = {doors}개"
            dc = _up(c["품_실내문"] * d)
            mok += [
                line(DOOR_ITEM[inp.door], "doors", d, dwhy),
                line("313", "doors", d, dwhy),
                line("316", "doors", d, dwhy),
                line("314", "doors", d, dwhy),
                line("315", "doors", d, dwhy),
                line(
                    "319",
                    "doors",
                    dc,
                    f"문 {doors}개 × {_num(c['품_실내문'])} = {_num(dc)}품 (올림)",
                ),
                line("317", "doors", *one),
                line("320", "doors", *one),
            ]
        if "jungmun" in on:
            mok.append(
                line(JUNGMUN_ITEM[inp.jungmun], "jungmun", Decimal(1), "현관 1곳 (설치 포함 가격)")
            )
        if "entry_hw" in on:
            mok += [
                line("304", "entry_hw", Decimal(1), "현관문 1개"),
                line("306", "entry_hw", Decimal(1), "현관문 1개"),
                line("305", "entry_hw", Decimal(1), "현관문 1개"),
                line("307", "entry_hw", Decimal("0.5"), "반나절 작업 (235건 중앙값)"),
                line("308", "entry_hw", Decimal(1), "1회"),
            ]
        if "board" in on:
            mok += [
                line("1317", "board", *per_py("석고보드", _up, "올림", "장")),
                line("1327", "board", *per_py("각재", _up, "올림", "단")),
                line("1322", "board", *per_py("MDF", _up, "올림", "장")),
                line("1324", "board", Decimal(1), "1장 (235건 중앙값)"),
                line("1328", "board", Decimal(1), "1단 (235건 중앙값)"),
            ]
        if "insulation" in on:
            mok += [
                line("1319", "insulation", *per_py("GCS보드", _up, "올림", "장")),
                line("1320", "insulation", *per_py("단열재", _up, "올림", "장")),
            ]
        if "bath_board" in on:
            mok.append(line("1318", "bath_board", *per_py("방수석고", _up, "올림", "장")))
    return dobae, mok, doors


def _trade(key, name, lines: list[QLine], net: int) -> QTrade:
    s = {
        k: sum(ln.amount for ln in lines if ln.kind == k) for k in ("material", "labor", "expense")
    }
    total = sum(s.values())
    share = _r(Decimal(total) * 100 / net, 1) if net else Decimal(0)
    return QTrade(key, name, s["material"], s["labor"], s["expense"], total, share, lines)


def _total(inp: Input, book: Book) -> int:
    dobae, mok, _ = _lines(inp, book)
    return _money(sum(ln.amount for ln in dobae + mok))[3].total


def _money(net: int) -> tuple[list[Overhead], int, int, Money]:
    ovh = [Overhead(k, n, r, won(Decimal(net) * r)) for k, n, r in RATES]
    before = net + sum(o.amount for o in ovh)
    supply = int((Decimal(before) / CUT_UNIT).to_integral_value(rounding=ROUND_FLOOR)) * CUT_UNIT
    return ovh, before, supply, with_vat(supply)


def build(inp: Input, book: Book) -> Quote:
    if inp.pyeong <= 0:
        raise ValueError("평형은 0보다 커야 해요")
    if inp.rooms < 0 or inp.baths < 0:
        raise ValueError("방 · 욕실 수를 다시 넣어 주세요")
    if not (inp.dobae or inp.mokgong):
        raise ValueError("도배나 목공 중 하나는 골라 주세요")
    if inp.options is not None and not inp.options <= OPTION_KEYS:
        raise ValueError("목공 선택 항목을 다시 골라 주세요")
    dobae, mok, doors = _lines(inp, book)
    net = sum(ln.amount for ln in dobae + mok)
    trades = []
    if inp.dobae:
        trades.append(_trade("dobae", "도배", dobae, net))
    if inp.mokgong:
        trades.append(_trade("mokgong", "목공 (문 포함)", mok, net))
    ovh, before, supply, money = _money(net)

    on = common_options(book) if inp.options is None else inp.options
    common = common_options(book)
    options = []
    if inp.mokgong:
        fixed = replace(inp, options=on)
        for o in OPTIONS:
            flipped = replace(fixed, options=on ^ {o.key})
            with_o = fixed if o.key in on else flipped
            amount = sum(ln.amount for ln in _lines(with_o, book)[1] if ln.group == o.key)
            options.append(
                QOption(
                    o.key,
                    o.name,
                    o.desc,
                    o.key in on,
                    o.key in common,
                    _seen(book, o),
                    amount,
                    _total(flipped, book) - money.total,
                )
            )
    return Quote(
        pyeong=inp.pyeong,
        rooms=inp.rooms,
        baths=inp.baths,
        doors=doors,
        trades=trades,
        options=options,
        material=sum(t.material for t in trades),
        labor=sum(t.labor for t in trades),
        expense=sum(t.expense for t in trades),
        net=net,
        overheads=ovh,
        cut=supply - before,
        supply=money.supply,
        vat=money.vat,
        total=money.total,
        per_pyeong=won(Decimal(money.total) / inp.pyeong),
        quotes=book.quotes,
        version=book.version,
    )
