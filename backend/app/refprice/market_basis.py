"""표준견적서 비교 기준(2026-11-26 팀 결정): 업체 견적서 235건 시장 단가 견적 금액.

가견적 · 실측 견적서 · 업체 목록이 '표준견적서보다 몇 %'를 말할 때, 화면이 보여 주는 표준견적서(시장 단가)와
같은 금액을 기준으로 써요. 공공 기준 표준견적서(calc.dobae · mokgong)는 가견적 수량을 세는 데만 남아요.
시장 단가 견적은 전체 공사만 셀 수 있어서, 부분 공사는 None(부르는 쪽이 기존 표준견적서 금액을 써요).
"""

from decimal import Decimal

from app.calc import market_quote
from app.refprice import market_book
from app.refprice.book import MOKGONG_2026H2

BOOK = market_quote.Book(
    market_book.VERSION, market_book.QUOTES, market_book.ITEMS, market_book.COEF
)

# 고객이 고른 목공 할 곳 → 시장 단가 목공 선택 항목(몰딩 · 걸레받이는 기본 줄에 늘 있어요)
MOK_OPTIONS = {"door": "doors", "flatten": "board"}


def mok_options(items: list[str] | None) -> frozenset[str] | None:
    """고른 목공 할 곳 → 켤 선택 항목. 모르면(None) 235건에서 흔한 것"""
    if items is None:
        return None
    return frozenset(MOK_OPTIONS[x] for x in items if x in MOK_OPTIONS)


def mok_base(items: list[str] | None) -> dict[str, bool]:
    """고른 목공 할 곳 → 몰딩 · 걸레받이 줄을 넣을지. 모르면(None) 둘 다"""
    if items is None:
        return {"molding": True, "skirting": True}
    return {"molding": "molding" in items, "skirting": "base" in items}


def basis_total(
    trade: str,
    area_m2: Decimal | str,
    area_basis: str,
    grade: str | None,
    scope: str | None,
    mok_items: list[str] | None = None,
) -> int | None:
    """그 공정 하나의 시장 단가 견적 합계(부가세 포함). 전체 공사가 아니면 None.
    목공은 고른 목공 할 곳(mok_items)만 선택 항목으로 켜요(화면 표준견적서와 같은 값)"""
    if (scope or "full") != "full" or trade not in ("dobae", "mokgong"):
        return None
    k = MOKGONG_2026H2.supply_per_exclusive if area_basis == "exclusive" else None
    py = market_quote.pyeong_from_m2(Decimal(str(area_m2)), k)
    rooms, baths = market_quote.default_rooms(py)
    inp = market_quote.Input(
        py,
        rooms,
        baths,
        dobae=trade == "dobae",
        mokgong=trade == "mokgong",
        wallpaper="hapji" if grade == "economy" else "silk",
        options=mok_options(mok_items) if trade == "mokgong" else None,
        **(mok_base(mok_items) if trade == "mokgong" else {}),
    )
    return market_quote.build(inp, BOOK).total
