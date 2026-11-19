"""T11 세션 쿠키 · T17 오류와 로그에 입력값이 없는지 · 가입 때 휴대폰은 선택
(security.md AU-04 · AU-11 · LG-03 · LG-05 · PI-07)."""

import logging

from fastapi import Response

from app.auth.deps import set_session_cookie
from app.config import settings
from app.shared import ratelimit
from tests.conftest import query
from tests.helpers import PASSWORD, signup
from tests.security.sec_util import DownRedis


def _cookie_parts(header: str) -> set[str]:
    return {p.strip().lower() for p in header.split(";")}


def test_session_cookie_is_httponly_lax_and_long_enough(api):
    api.cookies.clear()
    r = api.post(
        "/auth/signup",
        json={
            "name": "고객",
            "email": "c@mitjip.test",
            "password": PASSWORD,
            "phone": "01012345678",
        },
    )
    raw = r.headers["set-cookie"]
    name, token = raw.split(";")[0].split("=", 1)
    assert name == settings.session_cookie
    assert len(token) >= 43  # 32바이트(256비트) 무작위
    parts = _cookie_parts(raw)
    assert {"httponly", "path=/", "samesite=lax", f"max-age={14 * 86400}"} <= parts
    assert "secure" not in parts  # 로컬 http에서는 Secure를 붙이지 않는다


def test_https_cookie_is_secure_and_host_only(monkeypatch):
    monkeypatch.setattr(settings, "app_env", "staging")
    res = Response()
    set_session_cookie(res, "t" * 43)
    raw = res.headers["set-cookie"]
    assert raw.startswith("__Host-mj_sid=")
    parts = _cookie_parts(raw)
    assert {"secure", "httponly", "path=/", "samesite=lax"} <= parts
    assert not any(p.startswith("domain=") for p in parts)  # __Host-는 Domain 없이


def test_validation_errors_do_not_echo_what_was_sent(api, caplog):
    secret, phone, email = "my-secret-pass-9876", "010-98", "private.person@mitjip.test"
    # 우리 코드의 로그만 본다(SQL 로그는 운영에서 꺼져 있다)
    with caplog.at_level(logging.DEBUG, logger="app"):
        r = api.post(
            "/auth/signup",
            json={"name": "고객", "email": email, "password": secret, "phone": phone},
        )
    assert r.status_code == 422 and r.json()["error"]["code"] == "invalid"
    assert r.json()["error"]["fields"][0]["loc"] == ["phone"]
    for value in (secret, phone, email):
        assert value not in r.text
        assert value not in caplog.text


def test_failed_login_leaves_no_email_or_password_in_logs(api, caplog, monkeypatch):
    signup(api, "who@mitjip.test")
    api.cookies.clear()
    monkeypatch.setattr(ratelimit, "redis", DownRedis())  # 요청 제한이 경고 로그를 남기게
    with caplog.at_level(logging.DEBUG, logger="app"):
        r = api.post("/auth/login", json={"email": "who@mitjip.test", "password": "guess-1234"})
    assert r.status_code == 401
    assert r.json()["error"]["message"] == "이메일이나 비밀번호가 맞지 않아요."
    assert "프로세스 안에서 셌어요" in caplog.text  # 로그는 잡히는데
    assert "who@mitjip.test" not in caplog.text and "guess-1234" not in caplog.text


def test_unknown_and_wrong_password_look_the_same(api):
    signup(api, "real@mitjip.test")
    api.cookies.clear()
    wrong = api.post("/auth/login", json={"email": "real@mitjip.test", "password": "nope-1234"})
    nobody = api.post("/auth/login", json={"email": "ghost@mitjip.test", "password": "nope-1234"})
    assert wrong.status_code == nobody.status_code == 401
    assert wrong.json() == nobody.json()  # 계정이 있는지 응답으로 알 수 없다


def test_signup_without_a_phone_stores_no_number(api):
    """9판 C05 '휴대폰 (선택)': 안 넣거나 비우면 번호를 저장하지 않는다 (적게 모으기)"""
    for n, extra in enumerate(({}, {"phone": None}, {"phone": ""}, {"phone": "  "})):
        api.cookies.clear()
        email = f"nophone{n}@mitjip.test"
        body = {"name": "고객", "email": email, "password": PASSWORD, **extra}
        r = api.post("/auth/signup", json=body)
        assert r.status_code == 201 and r.json()["phone"] is None, (extra, r.text)
        assert api.get("/me").json()["phone"] is None
        assert query("select phone from users where email = $1", email)[0]["phone"] is None


def test_a_phone_given_at_signup_is_still_checked(api):
    ok = {"name": "고객", "email": "p@mitjip.test", "password": PASSWORD, "phone": "010-1234-5678"}
    r = api.post("/auth/signup", json=ok)
    assert r.status_code == 201 and r.json()["phone"] == "01012345678"  # 숫자만 저장
    api.cookies.clear()
    bad = api.post("/auth/signup", json={**ok, "email": "q@mitjip.test", "phone": "02-123-4567"})
    assert bad.status_code == 422 and bad.json()["error"]["fields"][0]["loc"] == ["phone"]
