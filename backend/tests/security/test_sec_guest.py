"""W2 · W3: 로그인 없는 표준견적서 계산 (security-02 · dev-03, security.md IN-03 · PI-05 · T09 · T20).
IP 한도 분당 20(Redis가 멈춰도) · 본문 4KB · 답을 저장 · 쿠키 · 로그 · 오류 글에 남기지 않음."""

import logging

from app.shared import ratelimit
from tests.security.sec_util import DownRedis
from tests.test_v3_guest_standard import HOME, URL


def test_guest_calculation_is_limited_to_20_a_minute_per_ip(api):
    api.cookies.clear()
    for _ in range(20):
        assert api.post(URL, json=HOME).status_code == 200
    r = api.post(URL, json=HOME)
    assert r.status_code == 429 and r.json()["error"]["code"] == "too_many_attempts"
    assert int(r.headers["retry-after"]) >= 1


def test_guest_limit_holds_when_redis_is_down(api, monkeypatch):
    api.cookies.clear()
    monkeypatch.setattr(ratelimit, "redis", DownRedis())
    codes = [api.post(URL, json=HOME).status_code for _ in range(21)]
    assert codes[:20] == [200] * 20 and codes[20] == 429  # 프로세스 안에서 같은 한도로 센다


def test_guest_body_over_4kb_is_refused_before_reading(api):
    api.cookies.clear()
    padded = {**HOME, "note": "가" * 2000}  # 4KB를 넘는 몸통 (모르는 칸이라도 크기부터 본다)
    r = api.post(URL, json=padded)
    assert r.status_code == 413 and r.json()["error"]["code"] == "too_large"


def test_guest_answers_leave_no_trace(api, caplog):
    api.cookies.clear()
    secret = {"name": "김비밀", "phone": "010-9876-5432", "email": "who@mitjip.test"}
    with caplog.at_level(logging.DEBUG, logger="app"):
        bad = api.post(URL, json={**HOME, **secret})  # 이름 · 번호 같은 칸은 받지 않는다
        ok = api.post(URL, json=HOME)
    assert bad.status_code == 422 and ok.status_code == 200
    for value in secret.values():
        assert value not in bad.text and value not in caplog.text
    assert "상계동" not in caplog.text  # 넣은 동네도 로그에 쓰지 않는다
    for r in (bad, ok):
        assert "set-cookie" not in r.headers  # 손님에게 쿠키를 주지 않는다
        assert "no-store" in r.headers["cache-control"]
