"""시연용 시계 옮기기 (app/shared/clock.moved_to, B6): 로컬 · 시험에서만 '지금'이 옮겨지고,
staging · production에서는 막힌다."""

from datetime import UTC, datetime, timedelta

import pytest

from app.config import settings
from app.shared import clock


def test_moved_to_moves_now_and_today_then_comes_back():
    at = datetime(2026, 3, 2, 23, 30, tzinfo=UTC)  # 서울은 3월 3일 아침
    with clock.moved_to(at):
        assert clock.moved()
        assert abs(clock.now_utc() - at) < timedelta(seconds=5)
        assert clock.today_seoul().isoformat() == "2026-03-03"
    assert not clock.moved()
    assert abs(clock.now_utc() - datetime.now(UTC)) < timedelta(seconds=5)


@pytest.mark.parametrize("env", ["staging", "production"])
def test_moved_to_refuses_outside_local_and_test(monkeypatch, env):
    monkeypatch.setattr(settings, "app_env", env)
    with pytest.raises(RuntimeError), clock.moved_to(datetime(2026, 1, 1, tzinfo=UTC)):
        pass
    assert not clock.moved()
    assert abs(clock.now_utc() - datetime.now(UTC)) < timedelta(seconds=5)


def test_moved_to_needs_timezone():
    with pytest.raises(ValueError), clock.moved_to(datetime(2026, 1, 1)):
        pass
    assert not clock.moved()
