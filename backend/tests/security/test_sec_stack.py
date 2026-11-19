"""T18 API 응답 머리 · 미들웨어를 붙이는 순서 (security.md OP-03 · LG-05 · IN-01 · IN-02).

리드가 main.py에 붙일 순서(b7.md '리드에게')와 같은 작은 앱으로 본다:
SecurityHeaders → CatchAll → BodyLimit → OriginGuard → router
"""

import logging

import pytest
from fastapi import Response
from fastapi.exceptions import RequestValidationError
from fastapi.responses import StreamingResponse
from fastapi.testclient import TestClient
from pydantic import BaseModel
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.config import settings
from app.shared.errors import http_error_handler, validation_error_handler
from app.shared.request_guards import BodyLimit, CatchAll, OriginGuard, SecurityHeaders
from tests.security.sec_util import mini_app

API_DEFAULTS = {
    "x-content-type-options": "nosniff",
    "cache-control": "no-store",
    "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
    "x-frame-options": "SAMEORIGIN",
    "cross-origin-resource-policy": "same-origin",
    "referrer-policy": "no-referrer",
}


class In(BaseModel):
    text: str = ""


@pytest.fixture
def stack(monkeypatch):
    monkeypatch.setattr(settings, "allowed_origins", "http://localhost:3107")
    app = mini_app(monkeypatch, OriginGuard, BodyLimit, CatchAll, SecurityHeaders)
    app.add_exception_handler(RequestValidationError, validation_error_handler)
    app.add_exception_handler(StarletteHTTPException, http_error_handler)

    @app.post("/echo")
    async def echo(data: In) -> dict:
        return {"len": len(data.text)}

    @app.get("/file")
    async def file() -> Response:
        own = {"Cache-Control": "private, no-store", "Content-Security-Policy": "sandbox"}
        return Response(b"%PDF-1.4", media_type="application/pdf", headers=own)

    @app.get("/stream")
    async def stream() -> StreamingResponse:
        async def events():
            yield b"event: ready\ndata: {}\n\n"
            yield b": ping\n\n"

        return StreamingResponse(
            events(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache, no-transform"},
        )

    @app.get("/boom")
    async def boom() -> dict:
        value = "customer@mitjip.test 010-1234-5678"  # 오류 메시지에 섞인 입력값
        raise RuntimeError("내부 값 " + value)

    @app.get("/docs")
    async def docs() -> dict:
        return {"swagger": True}

    with TestClient(app) as c:
        yield c


def test_json_responses_get_the_api_headers(stack):
    r = stack.post("/echo", json={"text": "안녕"})
    assert r.status_code == 200
    for name, value in API_DEFAULTS.items():
        assert r.headers[name] == value
    assert stack.get("/docs").headers.get("content-security-policy") is None  # Swagger 화면만 뺀다


def test_route_headers_are_kept(stack):
    f = stack.get("/file")
    assert f.headers["cache-control"] == "private, no-store"
    assert f.headers["content-security-policy"] == "sandbox"
    assert f.headers["x-content-type-options"] == "nosniff"
    s = stack.get("/stream", headers={"sec-fetch-site": "same-origin"})
    assert s.headers["cache-control"] == "no-cache, no-transform"
    assert s.headers["content-type"].startswith("text/event-stream")
    # 머리만 더하고 본문은 그대로 흘려보낸다
    assert s.text == "event: ready\ndata: {}\n\n: ping\n\n"


def test_refusals_and_errors_also_get_headers_and_one_shape(stack, caplog):
    too_big = stack.post("/echo", content=b"x" * (1024 * 1024 + 1))
    bad_origin = stack.post("/echo", json={}, headers={"sec-fetch-site": "cross-site"})
    with caplog.at_level(logging.ERROR):
        boom = stack.get("/boom")
    for r, status, code in (
        (too_big, 413, "too_large"),
        (bad_origin, 403, "bad_origin"),
        (boom, 500, "server_error"),
    ):
        assert r.status_code == status and r.json()["error"]["code"] == code
        assert r.headers["cache-control"] == "no-store" and r.headers["x-frame-options"]
    assert "customer@mitjip.test" not in boom.text and "010-1234-5678" not in boom.text
    assert "RuntimeError" in caplog.text  # 로그에는 종류 · 위치만 남고
    assert "customer@mitjip.test" not in caplog.text and "010-1234-5678" not in caplog.text


def test_chunked_body_over_the_limit_is_413(stack):
    """길이 머리 없이 나눠 보내도 센다. (지금 main.py의 @app.middleware("http")는 이것을 400으로 바꾼다)"""

    def chunks():
        for _ in range(17):
            yield b" " * (64 * 1024)

    r = stack.post("/echo", content=chunks(), headers={"content-type": "application/json"})
    assert r.status_code == 413 and r.json()["error"]["code"] == "too_large"
