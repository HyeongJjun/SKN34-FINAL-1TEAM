"""리뷰 · 답글 (B1b, dev-07 · I4 · L08 · b7.md W6): 끝난 공사만 · 한 번 · 업체 알림 · 별점 · 숨김 빠짐 ·
업체 화면에 쓴 사람 이름 없음 · 답글 처음 201 + 고객 알림 · 고치기 '수정됨' · 사진 권한 · 탈퇴한 고객 · 하루 한도."""

import uuid
from datetime import UTC, date, datetime

from tests.conftest import query
from tests.helpers import JPEG, PASSWORD, make_admin, signup, upload, use
from tests.test_v3_thread_api import (
    CUSTOMER_NAME,
    VISIT,
    Pair,
    no_customer_pii,
    open_thread,
    pair,
    project_for,
    user_id,
)
from tests.test_vendor_profile import approved_vendor

QUOTE = (
    "insert into vendor_quotes (id, visit_id, code, version, sent_at, entered_amount, vat_mode,"
    " supply, vat, total) values ($1, $2, $3, 1, now(), 3000000, 'excluded', 3000000, 300000,"
    " 3300000)"
)
DEAL = (
    "insert into deals (id, project_id, trade, vendor_id, vendor_name, visit_id, quote_id, status,"
    " dates_due_at, start_date, end_date, work_done_on) values ($1, $2, 'dobae', $3, $4, $5, $6,"
    " $7, now(), $8, $9, $10)"
)
LINK = (
    "insert into vendor_review_links (vendor_id, sort, label, url, status, checked_at)"
    " values ($1, $2, $3, $4, $5, $6)"
)


def deal_for(p: Pair, status: str = "done", grade: str | None = "basic") -> uuid.UUID:
    """그 실측으로 확정한 공사 (status: scheduled · done …)"""
    query("update visits set status = 'chosen' where id = $1", p.visit)
    qid, did = uuid.uuid4(), uuid.uuid4()
    query(QUOTE, qid, p.visit, f"Q-2611-{qid.int % 10**6:06d}")
    started = status != "confirmed"
    done = status in ("checking", "fixing", "done")
    query(
        DEAL, did, p.pid, p.vid, "마루와벽", p.visit, qid, status,
        date(2027, 1, 4) if started else None, date(2027, 1, 5) if started else None,
        date(2027, 1, 5) if done else None,
    )  # fmt: skip
    query(
        "insert into project_trades (project_id, trade, grade) values ($1, 'dobae', $2)",
        p.pid,
        grade,
    )
    return did


def write(api, p: Pair, did, **body):
    return api.post(
        f"/projects/{p.pid}/deals/{did}/review",
        json={"rating": 5, "tags": ["tidy", "seam"], **body},
    )


def second_customer(api, p: Pair, email: str = "c2@mitjip.test", emd: str = "수유동") -> tuple:
    """같은 업체에서 공사를 끝낸 다른 고객 (다른 공사 · 다른 실측)"""
    token = signup(api, email, name="박서연")
    cid = user_id(email)
    q = Pair(
        token, p.vendor, cid, p.vid, project_for(cid, emd), uuid.uuid4(), p.tid, email, p.v_email
    )
    query(VISIT, q.visit, q.pid, q.vid, "마루와벽", "booked", date(2026, 12, 16), "pm")
    q.tid = open_thread(q.pid, q.vid, q.cid, q.visit, customer_label=f"{emd} 고객")
    return q, deal_for(q, grade="economy")


def test_write_only_after_done_once_and_vendor_is_told(api):
    p = pair(api)
    did = deal_for(p, status="scheduled")
    use(api, p.customer)
    r = write(api, p, did)
    assert r.status_code == 403 and r.json()["error"]["code"] == "forbidden"
    query("update deals set status = 'done', work_done_on = end_date where id = $1", did)
    r = write(api, p, did, body="작은방 곰팡이까지 봐 주셔서 좋았어요.")
    assert r.status_code == 201, r.text
    got = r.json()
    assert got["tags"] == ["seam", "tidy"] and got["rating"] == 5  # 칩은 정한 순서
    assert got["author_label"] == "김○○" and got["context_label"] == "노원구 아파트 · 실크"
    assert (got["photos"], got["edited"], got["reply"]) == ([], False, None)
    again = write(api, p, did)
    assert again.status_code == 409 and again.json()["error"]["code"] == "already"
    (note,) = query(
        "select user_id, link, body, dedup_key from notifications where kind = 'review_written'"
    )
    assert note["user_id"] == p.vid and note["link"] == "/vendor/reviews"
    assert note["body"] == "새 리뷰가 달렸어요"  # 본문에 고객 이름 · 글을 넣지 않는다
    # 남의 공사 · 엉뚱한 확정 · 업체는 못 쓴다
    other = signup(api, "other@mitjip.test")
    use(api, other)
    assert write(api, p, did).status_code == 404
    use(api, p.customer)
    assert (
        api.post(f"/projects/{p.pid}/deals/{uuid.uuid4()}/review", json={"rating": 5}).status_code
        == 404
    )
    use(api, p.vendor)
    assert write(api, p, did).status_code == 403
    assert query("select count(*) n from reviews")[0]["n"] == 1


def test_customer_page_rating_sort_links_and_hidden(api):
    p = pair(api)
    did = deal_for(p)
    use(api, p.customer)
    first = write(api, p, did, rating=5, tags=["seam", "tidy"]).json()
    q, did2 = second_customer(api, p)
    use(api, q.customer)
    second = write(api, q, did2, rating=3, tags=["kind"], body="시작이 1시간 늦었어요.").json()
    assert second["context_label"] == "노원구 아파트 · 합지"
    query(
        LINK, p.vid, 0, "블로그 후기", "https://blog.example.com/maru", "shown", datetime.now(UTC)
    )
    query(LINK, p.vid, 1, "확인 중", "https://place.example.com/maru", "checking", None)
    use(api, p.customer)
    url = f"/projects/{p.pid}/vendors/{p.vid}/reviews"
    page = api.get(url).json()
    assert [x["id"] for x in page["items"]] == [second["id"], first["id"]]  # 최신순
    assert page["rating"] == {
        "avg": "4.0",
        "count": 2,
        "done_count": 2,
        "tags": {"seam": 1, "on_time": 0, "kind": 1, "tidy": 1},
    }
    assert [x["author_label"] for x in page["items"]] == ["박○○", "김○○"]
    assert page["links"] == [
        {
            "sort": 0,
            "label": "블로그 후기",
            "url": "https://blog.example.com/maru",
            "status": "shown",
        }
    ]
    low = api.get(url, params={"sort": "low"}).json()
    assert [x["rating"] for x in low["items"]] == [3, 5] and low["next_before"] is None
    one = api.get(url, params={"limit": 1}).json()
    assert len(one["items"]) == 1 and one["next_before"] is not None
    rest = api.get(url, params={"limit": 1, "before": one["next_before"]}).json()
    assert [x["id"] for x in rest["items"]] == [first["id"]]
    # 관리자가 숨기면 고객 화면 · 별점에서 빠진다 (업체에게는 '숨김'으로)
    admin = make_admin(api)
    use(api, admin)
    r = api.post(
        f"/admin/reviews/{second['id']}/hide", json={"code": "unrelated", "note": "공사와 상관없음"}
    )
    assert r.status_code == 200 and r.json() == {
        "id": second["id"],
        "status": "hidden",
        "hidden_code": "unrelated",
    }
    assert (
        api.post(f"/admin/reviews/{second['id']}/hide", json={"code": "abuse"}).status_code == 409
    )
    use(api, p.customer)
    page = api.get(url).json()
    assert [x["id"] for x in page["items"]] == [first["id"]] and page["rating"]["count"] == 1
    assert page["rating"]["avg"] == "5.0"
    use(api, p.vendor)
    mine = api.get("/vendor/reviews").json()
    assert {x["id"]: x["hidden"] for x in mine["items"]} == {first["id"]: False, second["id"]: True}
    use(api, admin)
    assert api.post(f"/admin/reviews/{second['id']}/show").json()["status"] == "shown"
    assert api.post(f"/admin/reviews/{second['id']}/show").status_code == 409
    assert api.post(f"/admin/reviews/{uuid.uuid4()}/show").status_code == 404
    acts = query("select action, review_id, note from admin_actions order by at")
    assert [(a["action"], a["note"]) for a in acts] == [
        ("hide_review", "공사와 상관없음"),
        ("show_review", None),
    ]
    # 그 공사의 고객만 · 승인된 업체만
    other = signup(api, "other@mitjip.test")
    use(api, other)
    assert api.get(url).status_code == 404
    use(api, p.customer)
    assert api.get(f"/projects/{p.pid}/vendors/{uuid.uuid4()}/reviews").status_code == 404


def test_vendor_list_reply_once_and_customer_is_told(api):
    p = pair(api)
    did = deal_for(p)
    use(api, p.customer)
    rid = write(api, p, did).json()["id"]
    use(api, p.vendor)
    mine = api.get("/vendor/reviews")
    assert mine.json()["waiting"] == 1
    (row,) = mine.json()["items"]
    assert row["author_label"] == "고객" and row["waiting_reply"] is True  # 업체에는 이름이 없다
    assert row["deal_id"] == str(did) and row["hidden"] is False
    no_customer_pii(mine.text, p)
    assert len(api.get("/vendor/reviews", params={"filter": "waiting"}).json()["items"]) == 1
    r = api.put(f"/vendor/reviews/{rid}/reply", json={"body": "감사합니다. 다음에도 잘 할게요."})
    assert r.status_code == 201 and r.json()["edited_at"] is None
    (note,) = query("select user_id, link from notifications where kind = 'review_replied'")
    assert note["user_id"] == p.cid and note["link"] == f"/projects/{p.pid}/review"
    r = api.put(f"/vendor/reviews/{rid}/reply", json={"body": "고친 답글이에요."})
    assert r.status_code == 200 and r.json()["edited_at"] is not None
    assert query("select count(*) n from notifications where kind = 'review_replied'")[0]["n"] == 1
    mine = api.get("/vendor/reviews").json()
    assert mine["waiting"] == 0 and mine["items"][0]["reply"]["body"] == "고친 답글이에요."
    assert api.get("/vendor/reviews", params={"filter": "waiting"}).json()["items"] == []
    use(api, p.customer)
    page = api.get(f"/projects/{p.pid}/vendors/{p.vid}/reviews").json()
    assert page["items"][0]["reply"]["body"] == "고친 답글이에요."
    other = approved_vendor(api, "v2@mitjip.test")
    use(api, other)
    assert api.put(f"/vendor/reviews/{rid}/reply", json={"body": "남의 리뷰"}).status_code == 404
    assert api.get("/vendor/reviews").json()["items"] == []


def test_edit_delete_and_photo_permissions(api):
    p = pair(api)
    did = deal_for(p)
    use(api, p.customer)
    fid = upload(api, kind="review_photo", content=JPEG, name="room.jpg").json()["id"]
    space = upload(api, kind="photo").json()["id"]
    r = write(api, p, did, photo_file_ids=[space])  # 리뷰 사진만
    assert r.status_code == 422 and r.json()["error"]["code"] == "invalid"
    got = write(api, p, did, photo_file_ids=[fid]).json()
    rid = got["id"]
    assert got["photos"] == [fid]
    photo = f"/reviews/{rid}/photos/{fid}"
    assert api.get(photo).status_code == 200  # 쓴 사람
    use(api, p.vendor)
    assert api.get(photo).status_code == 200  # 그 업체
    other_vendor = approved_vendor(api, "v2@mitjip.test")
    use(api, other_vendor)
    assert api.get(photo).status_code == 404  # 다른 업체
    browsing = signup(api, "browse@mitjip.test")
    use(api, browsing)
    assert api.get(photo).status_code == 200  # 보이는 리뷰는 로그인한 고객 누구나
    assert (
        api.get(f"/reviews/{rid}/photos/{space}").status_code == 404
    )  # 그 리뷰의 사진이 아니면 404
    admin = make_admin(api)
    use(api, admin)
    api.post(f"/admin/reviews/{rid}/hide", json={"code": "privacy"})
    assert api.get(photo).status_code == 200  # 관리자
    use(api, browsing)
    assert api.get(photo).status_code == 404  # 숨긴 리뷰는 쓴 사람 · 업체 · 관리자만
    use(api, p.customer)
    assert api.get(photo).status_code == 200
    # 고치기: 보낸 칸만, '수정됨'
    r = api.patch(f"/reviews/{rid}", json={"rating": 4, "tags": ["on_time"]})
    assert r.status_code == 200, r.text
    edited = r.json()
    assert (edited["rating"], edited["tags"], edited["edited"]) == (4, ["on_time"], True)
    assert edited["body"] is None and edited["photos"] == [fid]  # 안 보낸 칸은 그대로
    assert api.patch(f"/reviews/{rid}", json={"photo_file_ids": []}).json()["photos"] == []
    assert api.patch(f"/reviews/{rid}", json={"body": "  "}).status_code == 422
    use(api, browsing)
    assert api.patch(f"/reviews/{rid}", json={"rating": 1}).status_code == 404
    assert api.delete(f"/reviews/{rid}").status_code == 404
    use(api, p.customer)
    assert api.delete(f"/reviews/{rid}").status_code == 204
    assert api.delete(f"/reviews/{rid}").status_code == 404
    assert query("select count(*) n from reviews")[0]["n"] == 0
    assert write(api, p, did).status_code == 201  # 지운 뒤에는 다시 쓸 수 있다


def test_withdrawn_author_keeps_review_and_daily_limit(api):
    p = pair(api)
    did = deal_for(p)
    use(api, p.customer)
    rid = write(api, p, did).json()["id"]
    assert api.post("/me/withdraw", json={"password": PASSWORD}).status_code == 204
    left = query("select author_id, project_id, deal_id, vendor_id from reviews")
    assert len(left) == 1 and left[0]["author_id"] is None and left[0]["vendor_id"] == p.vid
    use(api, p.vendor)
    (row,) = api.get("/vendor/reviews").json()["items"]
    assert row["id"] == rid and row["author_label"] == "탈퇴한 고객"  # L08
    assert api.put(f"/vendor/reviews/{rid}/reply", json={"body": "감사합니다"}).status_code == 201
    assert query("select count(*) n from notifications where kind = 'review_replied'")[0]["n"] == 0
    q, _ = second_customer(api, p)
    use(api, q.customer)
    page = api.get(f"/projects/{q.pid}/vendors/{p.vid}/reviews").json()
    assert page["items"][0]["author_label"] == "탈퇴한 고객"
    assert CUSTOMER_NAME not in str(page)
    # 하루 5번 (B7 POLICY review): 실패한 요청도 센다
    for _ in range(5):
        assert write(api, q, uuid.uuid4()).status_code == 404
    r = write(api, q, uuid.uuid4())
    assert r.status_code == 429 and r.json()["error"]["code"] == "too_many_attempts"
