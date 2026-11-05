"""화면 알림: 내 것만 보고 읽고, 같은 일로 두 번 쓰지 않는다."""

import asyncio
import uuid

from app.db import SessionLocal
from app.notify import service
from tests.conftest import query
from tests.helpers import signup, use


def _user_id(email: str) -> uuid.UUID:
    (row,) = query("select id from users where email = $1", email)
    return row["id"]


def _add(user_id: uuid.UUID, key: str, body: str = "업체가 견적서를 보냈어요") -> None:
    async def run():
        async with SessionLocal() as s:
            await service.add(
                s, user_id=user_id, kind="quote_sent", body=body, link="/my", dedup_key=key
            )
            await s.commit()

    asyncio.run(run())


def test_list_unread_and_dedup(api):
    signup(api)
    me = _user_id("customer@mitjip.test")
    _add(me, "q:1")
    _add(me, "q:1", "다시 써도 한 번만")
    _add(me, "q:2")
    page = api.get("/notifications").json()
    assert page["unread"] == 2 and len(page["items"]) == 2
    assert api.get("/notifications/unread").json() == {"unread": 2}

    nid = page["items"][0]["id"]
    assert api.post(f"/notifications/{nid}/read").status_code == 204
    assert api.get("/notifications/unread").json() == {"unread": 1}
    assert api.post("/notifications/read-all").status_code == 204
    assert api.get("/notifications").json()["unread"] == 0


def test_cannot_read_someone_elses(api):
    other = signup(api, "other@mitjip.test")
    _add(_user_id("other@mitjip.test"), "x")
    nid = api.get("/notifications").json()["items"][0]["id"]
    signup(api)
    assert api.post(f"/notifications/{nid}/read").status_code == 404
    assert api.get("/notifications").json()["items"] == []
    use(api, other)
    assert api.get("/notifications").json()["unread"] == 1


def test_needs_login(api):
    api.cookies.clear()
    assert api.get("/notifications").status_code == 401
