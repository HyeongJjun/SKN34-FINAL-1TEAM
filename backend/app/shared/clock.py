"""서울 기준 오늘 날짜를 한 곳에서 읽는다. 계산 · 검사 함수에는 이 값을 인자로 넘긴다 (AGENTS.md 3장).
시연 데이터를 넣을 때만 moved_to로 '지금'을 옮긴다. 로컬 개발 · 시험(APP_ENV local · test) 밖에서는 막힌다."""

from collections.abc import Iterator
from contextlib import contextmanager
from contextvars import ContextVar
from datetime import UTC, date, datetime, timedelta, timezone

SEOUL = timezone(timedelta(hours=9), "Asia/Seoul")  # 한국은 서머타임이 없다
MOVABLE_ENVS = ("local", "test")
_shift: ContextVar[timedelta | None] = ContextVar("clock_shift", default=None)


def now_utc() -> datetime:
    now = datetime.now(UTC)
    shift = _shift.get()
    return now if shift is None else now + shift


def today_seoul() -> date:
    return now_utc().astimezone(SEOUL).date()


def moved() -> bool:
    """moved_to 문맥 안인지"""
    return _shift.get() is not None


@contextmanager
def moved_to(at: datetime) -> Iterator[None]:
    """이 문맥 안의 now_utc · today_seoul이 at에서 시작해 흐른다(시연 데이터 넣기 전용).
    APP_ENV가 local · test가 아니면 RuntimeError: 운영 · staging에서는 시계를 옮기지 못한다."""
    from app.config import settings  # calc도 이 모듈의 SEOUL을 읽어서 설정은 쓸 때만 부른다

    if settings.app_env not in MOVABLE_ENVS:
        raise RuntimeError("시계 옮기기는 로컬 개발 · 시험에서만 써요.")
    if at.tzinfo is None:
        raise ValueError("at에는 시간대가 있어야 해요")
    token = _shift.set(at - datetime.now(UTC))
    try:
        yield
    finally:
        _shift.reset(token)
