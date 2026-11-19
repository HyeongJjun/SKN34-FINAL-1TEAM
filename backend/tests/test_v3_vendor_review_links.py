"""업체 외부 리뷰 링크 (GET · PUT /vendor/review-links, V18 · A01): https만 · 3개까지, 통째로 저장,
바뀐 링크는 '확인 중'(관리자 확인 전에는 고객에게 안 보임), 그대로인 링크는 상태 그대로."""

import asyncio

from app.db import SessionLocal
from app.vendor import service
from tests.conftest import query
from tests.helpers import make_admin, signup, use, vendor_signup
from tests.test_vendor_profile import approved_vendor, vendor_id

URL = "/vendor/review-links"
BLOG = {"label": "네이버 블로그", "url": "https://blog.example.com/maru"}
PLACE = {"label": None, "url": "https://place.example.com/123"}


def shown(vid) -> list:
    async def go():
        async with SessionLocal() as s:
            return await service.shown_review_links(s, [vid])

    return asyncio.run(go())[vid]


def test_save_whole_list_and_keep_checked_status(api):
    token = approved_vendor(api)
    vid = vendor_id()
    assert api.get(URL).json() == []
    r = api.put(URL, json={"links": [BLOG, PLACE]})
    assert r.status_code == 200, r.text
    assert [(x["sort"], x["url"], x["status"]) for x in r.json()] == [
        (0, BLOG["url"], "checking"),
        (1, PLACE["url"], "checking"),
    ]
    assert shown(vid) == []  # 확인 전에는 고객에게 안 보여요
    query(
        "update vendor_review_links set status = 'shown', checked_at = now() where sort = 0"
    )  # 관리자가 확인했다고 치고
    same = api.put(URL, json={"links": [BLOG, PLACE]}).json()
    assert [x["status"] for x in same] == ["shown", "checking"]  # 그대로인 링크는 상태 그대로
    assert [x.url for x in shown(vid)] == [BLOG["url"]]

    moved = api.put(URL, json={"links": [{**BLOG, "url": "https://blog.example.com/new"}]}).json()
    assert [(x["url"], x["status"]) for x in moved] == [
        ("https://blog.example.com/new", "checking")
    ]
    (row,) = query("select status, checked_at from vendor_review_links")
    assert (row["status"], row["checked_at"]) == ("checking", None)
    assert api.put(URL, json={"links": []}).json() == []
    assert query("select count(*) n from vendor_review_links")[0]["n"] == 0

    admin = make_admin(api)
    use(api, token)
    api.put(URL, json={"links": [BLOG]})
    use(api, admin)
    detail = api.get(f"/admin/vendors/{vid}").json()
    assert [(x["url"], x["status"], x["note"]) for x in detail["review_links"]] == [
        (BLOG["url"], "checking", None)
    ]


def test_links_are_checked(api):
    approved_vendor(api)

    def bad(links) -> list:
        r = api.put(URL, json={"links": links})
        assert r.status_code == 422, r.text
        return [f["loc"] for f in r.json()["error"]["fields"]]

    assert bad([{"url": "http://blog.example.com"}]) == [["links", "0", "url"]]  # https만
    assert bad([{"url": "javascript:alert(1)"}]) == [["links", "0", "url"]]
    assert bad([BLOG, PLACE, {"url": "https://a.example.com"}, {"url": "https://b.example.com"}])
    assert bad([BLOG, {**BLOG, "label": "같은 주소"}]) == [["links", "1", "url"]]
    assert bad([{"url": "https://" + "a" * 300}])
    assert query("select count(*) n from vendor_review_links")[0]["n"] == 0


def test_only_approved_vendor(api):
    signup(api)
    assert api.get(URL).status_code == 403
    assert vendor_signup(api, email="wait@mitjip.test").status_code == 201  # 심사 중
    r = api.put(URL, json={"links": [BLOG]})
    assert r.status_code == 403 and r.json()["error"]["code"] == "vendor_not_approved"
    api.cookies.clear()
    assert api.get(URL).status_code == 401
