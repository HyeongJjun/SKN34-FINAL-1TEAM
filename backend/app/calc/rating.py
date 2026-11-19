"""업체 별점 요약 (I4 · C10 · C11 · D07). DB · HTTP · 시계를 모른다.

- 숨긴 리뷰(관리자)는 부르는 쪽이 빼고 넘긴다(보이는 리뷰의 별점 합 · 수 · 칩별 수).
- 평균 = 별점 합 ÷ 리뷰 수, 소수 한 자리 반올림(ROUND_HALF_UP, calc.common.m2). 리뷰가 없으면 None.
- 칩은 seam(이음매) · on_time(약속 시간) · kind(친절) · tidy(뒷정리) 순으로, 없는 칩은 0.
- 리뷰 기능(review.service)과 업체 고르기(visit.service)가 같은 함수로 센다.
"""

from collections.abc import Mapping
from dataclasses import dataclass, field
from decimal import Decimal

from app.calc.common import m2

TAGS: tuple[str, ...] = ("seam", "on_time", "kind", "tidy")


def average(total: int, count: int) -> Decimal | None:
    """별점 평균 (소수 한 자리). 리뷰가 없으면 None"""
    if total < 0 or count < 0:
        raise ValueError("별점 합과 리뷰 수는 0보다 작을 수 없어요")
    if count == 0:
        return None
    if not count <= total <= 5 * count:
        raise ValueError("별점은 1~5예요")
    return m2(Decimal(total) / Decimal(count))


def tag_counts(counts: Mapping[str, int]) -> dict[str, int]:
    """칩별 수를 정한 순서로 (모르는 칩은 버리고, 없는 칩은 0)"""
    return {t: int(counts.get(t, 0)) for t in TAGS}


@dataclass(frozen=True)
class Summary:
    """업체 한 곳의 별점 요약 (RatingOut과 같은 칸)"""

    avg: Decimal | None
    count: int
    done_count: int
    tags: dict[str, int] = field(default_factory=dict)


def summary(total: int, count: int, done: int, tags: Mapping[str, int] | None = None) -> Summary:
    """보이는 리뷰의 별점 합 · 수 · 칩별 수와 믿집에서 끝낸 공사 수 → 요약"""
    if done < 0:
        raise ValueError("끝낸 공사 수는 0보다 작을 수 없어요")
    return Summary(average(total, count), count, done, tag_counts(tags or {}))
