"""관리자 업체 멈춤 · 외부 리뷰 링크 확인 칸 바꾸기 (D26 · A01 · A02, vendor.service 공개 함수).

report.service가 자기 트랜잭션 안에서 부른다: 조건부 UPDATE만 하고 commit하지 않는다. 처리 기록 · 알림 ·
대화 닫기는 report 몫. 경로 POST /admin/vendors/{id}/suspend · /unsuspend는 report router 하나만 맡는다."""

import asyncio
import uuid
from datetime import UTC, datetime, timedelta

import pytest

from app.db import SessionLocal
from app.main import app
from app.vendor import service
from app.vendor.router import router as vendor_router
from tests.conftest import query
from tests.helpers import make_admin, use
from tests.test_vendor_profile import approved_vendor, vendor_id

T1 = datetime(2026, 11, 19, 1, 0, tzinfo=UTC)
T2 = T1 + timedelta(hours=3)
BLOG = {"label": "블로그", "url": "https://blog.example.com/maru"}
PLACE = {"label": None, "url": "https://place.example.com/123"}


def run(fn, *args, commit: bool = True, **kw):
    """한 세션에서 부르고 commit(또는 되돌리기)한다 — 부르는 쪽 트랜잭션처럼"""

    async def go():
        async with SessionLocal() as s:
            out = await fn(s, *args, **kw)
            await (s.commit() if commit else s.rollback())
            return out

    return asyncio.run(go())


def state(vid) -> tuple:
    row = query("select suspended_at, suspend_scope from vendors where user_id = $1", vid)[0]
    return row["suspended_at"], row["suspend_scope"]


def test_suspend_widens_only_and_unsuspend_once(api):
    approved_vendor(api)
    vid = vendor_id()
    assert run(service.suspend, vid, "new", T1, commit=False) == (T1, "new")
    assert state(vid) == (None, None)  # commit은 부르는 쪽: 되돌리면 그대로
    assert run(service.suspend, vid, "new", T1) == (T1, "new")
    assert state(vid) == (T1, "new")
    assert run(service.suspend, vid, "new", T2) is None  # 이미 같음
    assert run(service.suspend, vid, "all", T2) == (T1, "all")  # 넓히기: 멈춘 때는 처음 그대로
    assert run(service.suspend, vid, "all", T2) is None
    assert run(service.suspend, vid, "new", T2) is None  # 좁히기는 안 됨
    assert state(vid) == (T1, "all")

    admin = make_admin(api)
    use(api, admin)
    got = api.get(f"/admin/vendors/{vid}").json()  # A01 자세히에 멈춤 칸
    assert (got["suspend_scope"], got["suspended_at"] is not None) == ("all", True)

    assert run(service.unsuspend, vid) is True
    assert state(vid) == (None, None)
    assert run(service.unsuspend, vid) is False  # 이미 풀림
    assert api.get(f"/admin/vendors/{vid}").json()["suspend_scope"] is None

    nobody = uuid.uuid4()
    assert run(service.suspend, nobody, "new", T1) is None
    assert run(service.unsuspend, nobody) is False
    with pytest.raises(ValueError):
        run(service.suspend, vid, "some", T1)


def test_review_link_status_by_admin(api):
    token = approved_vendor(api)
    vid = vendor_id()
    assert api.put("/vendor/review-links", json={"links": [BLOG, PLACE]}).status_code == 200
    make_admin(api)
    admin_id = query("select id from users where role = 'admin'")[0]["id"]

    def check(sort, status, **kw):
        return run(service.set_review_link_status, vid, sort, status, by=admin_id, at=T1, **kw)

    shown = check(0, "shown")
    assert (shown.sort, shown.url, shown.status, shown.checked_at) == (0, BLOG["url"], "shown", T1)
    row = query("select status, checked_by, note from vendor_review_links where sort = 0")[0]
    assert (row["status"], row["checked_by"], row["note"]) == ("shown", admin_id, None)
    assert check(0, "shown") is None  # 이미 그 상태
    assert [x.url for x in run(service.shown_review_links, [vid])[vid]] == [BLOG["url"]]

    hidden = check(0, "hidden", note="광고 글이에요")
    assert (hidden.status, hidden.note) == ("hidden", "광고 글이에요")
    again = check(0, "shown", note="  ")  # 메모를 안 주면(빈 글도) 그대로
    assert (again.status, again.note) == ("shown", "광고 글이에요")

    assert check(1, "shown", url="https://place.example.com/old") is None  # 본 주소와 다름
    assert query("select status from vendor_review_links where sort = 1")[0]["status"] == "checking"
    assert check(1, "shown", url=PLACE["url"]).status == "shown"
    assert check(2, "shown") is None  # 없는 링크
    assert run(service.set_review_link_status, uuid.uuid4(), 0, "shown", by=admin_id, at=T1) is None
    with pytest.raises(ValueError):
        check(0, "checking")

    use(api, token)  # 업체가 주소를 고치면 다시 '확인 중' (관리자가 보인 상태가 남지 않음)
    moved = {**BLOG, "url": "https://blog.example.com/new"}
    saved = api.put("/vendor/review-links", json={"links": [moved, PLACE]}).json()
    assert [x["status"] for x in saved] == ["checking", "shown"]


def test_suspend_routes_belong_to_report_only(api):
    paths = [r.path for r in vendor_router.routes]
    assert not [p for p in paths if p.endswith(("/suspend", "/unsuspend"))]
    assert not [p for p in paths if "/links/" in p]  # 링크 확인도 report router (1단계 마무리)
    spec = app.openapi()["paths"]
    for tail in ("suspend", "unsuspend"):
        op = spec[f"/admin/vendors/{{vendor_id}}/{tail}"]["post"]
        assert op["operationId"].startswith(f"admin_{tail}_vendor")  # report router 함수
    make_admin(api)
    r = api.post(f"/admin/vendors/{uuid.uuid4()}/suspend", json={"scope": "new", "note": "확인"})
    assert r.status_code == 404  # 0단계 뼈대(501)가 아니라 report가 답한다
    r = api.post(f"/admin/vendors/{uuid.uuid4()}/links/0", json={"status": "shown"})
    assert r.status_code == 404  # 뼈대(501)가 아니라 report가 답한다
