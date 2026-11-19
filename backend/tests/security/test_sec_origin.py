"""T10 Origin · Sec-Fetch-Site (security.md IN-02 · RT-02, security-04 규칙 2). OriginGuard만 붙인 작은 앱."""

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocket, WebSocketDisconnect

from app.config import settings
from app.shared.request_guards import OriginGuard
from tests.security.sec_util import mini_app

OURS = "http://localhost:3107"


@pytest.fixture
def guarded(monkeypatch):
    monkeypatch.setattr(settings, "allowed_origins", f"{OURS},http://127.0.0.1:3107")
    app = mini_app(monkeypatch, OriginGuard)

    @app.post("/do")
    @app.put("/do")
    @app.patch("/do")
    @app.delete("/do")
    async def do() -> dict:
        return {"ok": True}

    @app.get("/read")
    async def read() -> dict:
        return {"ok": True}

    @app.get("/stream")
    async def stream() -> dict:
        return {"ok": True}

    @app.websocket("/ws")
    async def ws(socket: WebSocket) -> None:
        await socket.accept()
        await socket.send_text("hi")
        await socket.close()

    with TestClient(app) as c:
        yield c


@pytest.mark.parametrize(
    ("headers", "status"),
    [
        ({"origin": OURS}, 200),
        ({"origin": "https://evil.example"}, 403),
        ({"origin": "null"}, 403),  # 샌드박스 틀 · 파일에서 온 요청
        ({"origin": ""}, 403),
        ({"origin": f"{OURS}.evil.example"}, 403),
        ({"origin": "http://localhost:3108"}, 403),  # 포트가 다르면 다른 출처
        ({"sec-fetch-site": "same-origin"}, 200),
        ({"sec-fetch-site": "cross-site"}, 403),
        ({"sec-fetch-site": "same-site"}, 403),  # 같은 사이트의 다른 하위 주소도 막는다
        ({"sec-fetch-site": "none"}, 403),
        ({"referer": f"{OURS}/projects/1"}, 200),  # 오래된 브라우저: Origin이 없으면 Referer
        ({"referer": "https://evil.example/x"}, 403),
        ({"referer": "not a url"}, 403),
        ({}, 200),  # 브라우저가 아닌 요청(curl · 서버끼리)
        ({"origin": "https://evil.example", "sec-fetch-site": "same-origin"}, 403),
    ],
)
def test_state_changes_need_our_origin(guarded, headers, status):
    r = guarded.post("/do", headers=headers)
    assert r.status_code == status
    if status == 403:
        assert r.json()["error"]["code"] == "bad_origin"


@pytest.mark.parametrize("method", ["put", "patch", "delete"])
def test_every_unsafe_method_is_checked(guarded, method):
    assert (
        getattr(guarded, method)("/do", headers={"origin": "https://evil.example"}).status_code
        == 403
    )
    assert getattr(guarded, method)("/do", headers={"origin": OURS}).status_code == 200


def test_plain_reads_are_not_blocked(guarded):
    assert guarded.get("/read", headers={"origin": "https://evil.example"}).status_code == 200
    assert guarded.get("/read", headers={"sec-fetch-site": "cross-site"}).status_code == 200


def test_stream_connection_checks_where_it_came_from(guarded):
    """SSE(EventSource)는 같은 출처면 Origin 없이 Sec-Fetch-Site: same-origin을 보낸다."""
    assert guarded.get("/stream", headers={"sec-fetch-site": "same-origin"}).status_code == 200
    assert guarded.get("/stream", headers={"sec-fetch-site": "cross-site"}).status_code == 403
    assert guarded.get("/stream", headers={"origin": "https://evil.example"}).status_code == 403
    assert guarded.get("/stream", headers={"origin": OURS}).status_code == 200


def test_websocket_from_another_site_is_refused(guarded):
    evil = {"origin": "https://evil.example"}
    with pytest.raises(WebSocketDisconnect) as e, guarded.websocket_connect("/ws", headers=evil):
        pass
    assert e.value.code == 1008
    with guarded.websocket_connect("/ws", headers={"origin": OURS}) as socket:
        assert socket.receive_text() == "hi"
