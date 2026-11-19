"""v3 공사 화면 보조 계산(calc.work_view: 공사 몇째 날 · 공사 금액)과 업체 알림 공사 이름
(notify.catalog.work_name) · 실측 알림 kind 셋: 순수 함수."""

from datetime import date

import pytest

from app.calc import work_view
from app.notify import catalog

DAYS = [date(2027, 1, 4), date(2027, 1, 5), date(2027, 1, 7)]  # 6일(수)은 쉬는 날


@pytest.mark.parametrize(
    ("today", "want"),
    [
        (date(2027, 1, 3), None),  # 시작 전
        (date(2027, 1, 4), 1),
        (date(2027, 1, 5), 2),
        (date(2027, 1, 6), None),  # 고른 날 사이 쉬는 날
        (date(2027, 1, 7), 3),
        (date(2027, 1, 8), None),  # 끝난 뒤
    ],
)
def test_day_no_counts_only_picked_work_days(today, want):
    assert work_view.day_no(DAYS, today) == want
    assert work_view.day_no([*reversed(DAYS), DAYS[0]], today) == want  # 순서 · 겹침과 상관없이
    assert work_view.day_no([], today) is None


def test_grand_total_adds_approved_extras():
    assert work_view.grand_total(3_388_000, []) == 3_388_000
    assert work_view.grand_total(3_388_000, [55_000, 110_000]) == 3_553_000


def test_work_name_for_vendor_notifications():
    assert catalog.work_name("노원구", "상계동", "dobae") == "노원구 상계동 도배"
    assert catalog.work_name("노원구", None, "mokgong") == "노원구 목공"
    assert catalog.work_name(None, None, "dobae") == "도배"


def test_new_visit_kinds_go_to_the_vendor_request_screen():
    for kind in ("visit_change_withdrawn", "visit_repicked", "visit_visited"):
        assert catalog.KINDS[kind].who == "vendor" and len(kind) <= 30
        assert catalog.link(kind, vid="v1") == "/vendor/requests/v1"
