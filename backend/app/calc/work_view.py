"""v3 공사 화면 보조 계산 (B3 · C37 · C38). DB · HTTP · 시계를 모른다: 오늘은 인자로 받는다.

- 공사 몇째 날: 업체가 하나씩 고른 공사 날(deals.work_days) 기준. 사이에 쉬는 날은 세지 않는다.
- 공사 금액: 확정 금액 + 승인한 추가 금액(원 단위 부가세 포함 금액을 더할 뿐, 반올림 없음).
"""

from collections.abc import Iterable
from datetime import date

from app.calc.common import sum_won


def day_no(work_days: Iterable[date], today: date) -> int | None:
    """오늘이 공사 몇째 날인지 (1부터). 오늘이 공사 날이 아니면(시작 전 · 쉬는 날 · 끝난 뒤) None."""
    days = sorted(set(work_days))
    return days.index(today) + 1 if today in days else None


def grand_total(deal_total: int, approved: Iterable[int]) -> int:
    """공사 금액 = 확정 금액 + 승인한 추가 금액 (부가세 포함, 원)."""
    return sum_won([deal_total, *approved])
