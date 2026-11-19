"""보안 테스트 준비.

- conftest의 DB 준비가 Alembic을 돌릴 때 migrations/env.py의 fileConfig가 먼저 만들어진 app 로거를
  꺼 버린다(disable_existing_loggers 기본값). 로그에 개인정보가 없는지 · 열람 기록이 남는지 보려면 다시 켠다.
- Redis를 멈춘 시험이 남긴 프로세스 안 셈(ratelimit._local)은 시험마다 비운다.
"""

import logging

import pytest

from app.shared import ratelimit


@pytest.fixture(autouse=True)
def _app_loggers_on():
    names = [n for n in logging.root.manager.loggerDict if n == "app" or n.startswith("app.")]
    before = {n: logging.getLogger(n).disabled for n in names}
    for n in names:
        logging.getLogger(n).disabled = False
    yield
    for n, off in before.items():
        logging.getLogger(n).disabled = off


@pytest.fixture(autouse=True)
def _fresh_local_counts():
    ratelimit._local.clear()
    yield
    ratelimit._local.clear()
