"""업체 금액과 표준견적서 금액의 차이."""

from decimal import ROUND_HALF_UP, Decimal


def percent_vs(amount: int, standard: int) -> Decimal:
    """표준 대비 몇 % 많은지(음수면 적음). 소수 한 자리에서 반올림한다."""
    if standard <= 0 or amount < 0:
        raise ValueError("금액은 0보다 커야 해요")
    pct = (Decimal(amount) - Decimal(standard)) / Decimal(standard) * 100
    return pct.quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)


# 예산 구간(원, 부가세 포함 합계와 견준다)의 위 한도. 위 한도가 없거나 아직 몰라요면 None
BUDGET_TOP: dict[str, int | None] = {
    "u300": 3_000_000,
    "300-500": 5_000_000,
    "500-700": 7_000_000,
    "700-1000": 10_000_000,
    "o1000": None,
    "undecided": None,
}


def budget_gap(total: int, band: str) -> tuple[str, int | None]:
    """('within' · 'over' · 'open', 넘은 금액). 위 한도가 없으면 open."""
    if band not in BUDGET_TOP or total < 0:
        raise ValueError("예산 구간을 다시 확인해 주세요")
    top = BUDGET_TOP[band]
    if top is None:
        return "open", None
    return ("over", total - top) if total > top else ("within", None)
