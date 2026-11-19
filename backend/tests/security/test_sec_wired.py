"""W1: main.py에 붙은 입구 순서를 실제 앱으로 본다 (security.md IN-01 · IN-02 · RT-02 · OP-03 · OP-06 · T10 · T18).
바깥부터 SecurityHeaders → CatchAll → BodyLimit → OriginGuard → 기능 router."""

import importlib

from app.config import settings
from app.main import app

API_HEADERS = {
    "x-content-type-options": "nosniff",
    "cache-control": "no-store",
    "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
    "x-frame-options": "SAMEORIGIN",
    "cross-origin-resource-policy": "same-origin",
    "referrer-policy": "no-referrer",
}


def test_guards_are_wired_in_order():
    names = [m.cls.__name__ for m in app.user_middleware]
    assert names == ["SecurityHeaders", "CatchAll", "BodyLimit", "OriginGuard"]  # 바깥부터
    assert "BaseHTTPMiddleware" not in names  # 예전 check_origin(@app.middleware)은 빠졌다


def test_chunked_body_over_the_limit_is_413(api):
    def chunks():
        for _ in range(17):
            yield b" " * (64 * 1024)  # 1,088KB, 길이 머리 없이

    r = api.post("/auth/login", content=chunks(), headers={"content-type": "application/json"})
    assert r.status_code == 413 and r.json()["error"]["code"] == "too_large"


def test_browser_requests_from_other_sites_are_403(api):
    login = {"email": "a@b.cd", "password": "wrong-pass"}
    for site in ("cross-site", "same-site", "none"):
        r = api.post("/auth/login", json=login, headers={"sec-fetch-site": site})
        assert r.status_code == 403 and r.json()["error"]["code"] == "bad_origin", site
    ours = api.post("/auth/login", json=login, headers={"sec-fetch-site": "same-origin"})
    assert ours.status_code == 401  # 우리 화면이면 그다음(비밀번호 확인)으로 간다
    null = api.post("/auth/login", json=login, headers={"origin": "null"})
    assert null.status_code == 403


def test_stream_is_checked_before_login(api):
    api.cookies.clear()
    assert api.get("/stream", headers={"origin": "https://evil.example"}).status_code == 403
    assert api.get("/stream", headers={"sec-fetch-site": "cross-site"}).status_code == 403
    assert api.get("/stream", headers={"sec-fetch-site": "same-origin"}).status_code == 401


def test_every_json_answer_gets_the_api_headers(api):
    api.cookies.clear()
    answers = [
        api.get("/health/live"),  # 200
        api.get("/me"),  # 401
        api.get("/no-such-path"),  # 404
        api.post("/auth/signup", json={}),  # 422
        api.post("/auth/login", content=b"x" * (1024 * 1024 + 1)),  # 413
        api.post("/auth/login", json={}, headers={"origin": "https://evil.example"}),  # 403
    ]
    assert [r.status_code for r in answers] == [200, 401, 404, 422, 413, 403]
    for r in answers:
        for name, value in API_HEADERS.items():
            assert r.headers.get(name) == value, (r.status_code, name)


def test_api_docs_are_closed_outside_local_and_test(monkeypatch):
    from app import main

    assert main.app.docs_url == "/docs"  # 테스트 · 로컬은 열림(화면 타입 만들기)
    monkeypatch.setattr(settings, "app_env", "staging")
    try:
        staged = importlib.reload(main)
        assert staged.app.docs_url is None and staged.app.openapi_url is None
    finally:
        monkeypatch.undo()
        importlib.reload(main)
