"""v3 공사 끝 (V13 · C38 · D24): 남길 말 · 사진(done_photo) · 끝낸 날 · 올린 때, 자동 끝 기한 일 ·
DealOut v3 칸(auto_done_at · review_open · review_id · done_photos · thread_id), 사진 내주기 권한,
한 공사 화면 실측 뒤 5칸 · 업체 요약, 내 공사 목록 동 · 업체 요약."""

import uuid
from datetime import datetime, timedelta

from app.calc import deadline
from app.shared.clock import today_seoul
from tests.conftest import query
from tests.helpers import JPEG, signup, upload, use
from tests.test_dates import days, propose, ready
from tests.test_deal import confirm, setup
from tests.test_extras import scheduled
from tests.test_visit_inbox import login

TODAY = today_seoul()


def worked() -> None:
    """공사 날짜를 지난 사흘 ~ 오늘로 (서울 날짜, DB 시간대와 상관없이)"""
    query("update deals set start_date = $1, end_date = $2", TODAY - timedelta(days=3), TODAY)


def done_photo(api, name: str = "living.jpg") -> str:
    r = upload(api, kind="done_photo", content=JPEG, name=name)
    assert r.status_code == 201, r.text
    return r.json()["id"]


def test_done_with_note_photos_and_day_then_customer_sees_it(api):
    customer, pid, did = scheduled(api)
    worked()
    a, b = done_photo(api, "a.jpg"), done_photo(api, "b.jpg")
    wrong = upload(api, kind="work_photo", content=JPEG).json()["id"]
    url = f"/vendor/jobs/{did}/done"
    future = (TODAY + timedelta(days=1)).isoformat()
    r = api.post(url, json={"done_on": future})
    assert r.status_code == 422 and r.json()["error"]["fields"][0]["loc"] == ["done_on"]
    early = (TODAY - timedelta(days=4)).isoformat()  # 공사 시작 전
    assert api.post(url, json={"done_on": early}).status_code == 422
    r = api.post(url, json={"photo_file_ids": [wrong]})
    assert r.status_code == 422 and r.json()["error"]["fields"][0]["loc"] == ["photo_file_ids"]
    assert query("select status from deals")[0]["status"] == "scheduled"  # 아무것도 안 바뀜

    body = {
        "done_on": (TODAY - timedelta(days=1)).isoformat(),
        "note": "  남은 벽지 1롤은 다용도실에 두었어요 ",
        "photo_file_ids": [a, b],
    }
    r = api.post(url, json=body)
    assert r.status_code == 200, r.text
    job = r.json()
    assert (job["status"], job["work_done_on"], job["done_note"]) == (
        "checking",
        body["done_on"],
        "남은 벽지 1롤은 다용도실에 두었어요",
    )
    assert job["done_photos"] == [a, b]
    posted = datetime.fromisoformat(job["done_posted_at"])
    assert datetime.fromisoformat(job["auto_done_at"]) == deadline.auto_done_at(posted)
    (ev,) = query("select from_status, to_status, code from deal_events where code = 'done_posted'")
    assert (ev["from_status"], ev["to_status"]) == ("scheduled", "checking")
    assert api.post(url, json=body).status_code == 409  # 이미 올렸다
    assert api.get(f"/vendor/jobs/{did}/photos/{a}").status_code == 200

    use(api, customer)
    (d,) = api.get(f"/projects/{pid}/deals").json()
    assert d["done_photos"] == [a, b] and d["done_note"] == job["done_note"]
    assert (d["review_open"], d["review_id"]) == (False, None)
    # C38 '…에 한 번 알려 드려요'의 알림 날
    assert datetime.fromisoformat(d["done_remind_at"]) == deadline.done_remind_at(posted)
    photo = api.get(f"/projects/{pid}/deals/{did}/photos/{a}")
    assert photo.status_code == 200 and photo.headers["content-type"].startswith("image/")
    assert api.get(f"/projects/{pid}/deals/{did}/photos/{wrong}").status_code == 404  # 안 붙은 사진

    r = api.post(f"/projects/{pid}/deals/{did}/check", json={"result": "fixing", "note": "문틀"})
    assert r.status_code == 200 and r.json()["auto_done_at"] is None
    assert r.json()["done_remind_at"] is None  # 남은 일이면 알림 날도 없음
    cancelled = query(
        "select kind, status from jobs where kind in ('deal_done_remind', 'deal_auto_done')"
    )
    assert {(j["kind"], j["status"]) for j in cancelled} == {
        ("deal_done_remind", "cancelled"),
        ("deal_auto_done", "cancelled"),
    }
    login(api, "maru@mitjip.test")
    c = done_photo(api, "c.jpg")
    again = api.post(url, json={"photo_file_ids": [a, c]})  # 남은 일 뒤 다시: 붙은 사진은 그대로
    assert again.status_code == 200, again.text
    assert again.json()["done_photos"] == [a, b, c]
    assert again.json()["done_note"] == job["done_note"]  # 남길 말을 비우면 앞 글 그대로
    pending = query("select kind from jobs where status = 'pending' order by kind")
    assert [j["kind"] for j in pending] == ["deal_auto_done", "deal_done_remind"]

    use(api, customer)
    r = api.post(f"/projects/{pid}/deals/{did}/check", json={"result": "done"})
    assert r.status_code == 200 and r.json()["review_open"] is True
    deal = query("select id, vendor_id, project_id from deals")[0]
    rid = uuid.uuid4()
    query(  # 리뷰는 B1b가 쓴다: 표에 한 줄을 넣어 '쓴 리뷰'를 읽는지 본다
        "insert into reviews (id, deal_id, vendor_id, project_id, rating, context_label)"
        " values ($1, $2, $3, $4, 5, '노원구 아파트 · 실크')",
        rid,
        deal["id"],
        deal["vendor_id"],
        deal["project_id"],
    )
    (d,) = api.get(f"/projects/{pid}/deals").json()
    assert (d["review_open"], d["review_id"]) == (False, str(rid))


def test_done_photos_only_for_that_deal_people(api):
    customer, pid, did = scheduled(api)
    worked()
    many = api.post(  # 사진 한도는 몸통 검사 (10장)
        f"/vendor/jobs/{did}/done", json={"photo_file_ids": [str(uuid.uuid4()) for _ in range(11)]}
    )
    assert many.status_code == 422
    a = done_photo(api)
    assert api.post(f"/vendor/jobs/{did}/done", json={"photo_file_ids": [a]}).status_code == 200
    signup(api, "other@mitjip.test")
    assert api.get(f"/projects/{pid}/deals/{did}/photos/{a}").status_code == 404  # 남의 집
    login(api, "gyeol@mitjip.test")
    assert api.get(f"/vendor/jobs/{did}/photos/{a}").status_code == 404  # 다른 업체
    use(api, customer)
    assert api.get(f"/vendor/jobs/{did}/photos/{a}").status_code == 403  # 고객이 업체 길


def test_overview_after_steps_and_vendor_summaries(api):
    customer, pid, va, vb, vc = setup(api)
    o = api.get(f"/projects/{pid}/overview").json()
    assert [s["key"] for s in o["after_steps"]] == ["quote", "confirm", "dates", "work", "check"]
    assert [s["label"] for s in o["after_steps"]] == [
        "견적서 비교",
        "업체 확정",
        "공사 날짜",
        "공사",
        "끝 확인",
    ]
    assert [s["state"] for s in o["after_steps"]] == ["now", "todo", "todo", "todo", "todo"]
    by = {v["visit_id"]: v for v in o["vendors"]}
    assert set(by) == {va, vb, vc}
    assert (by[va]["status"], by[va]["next"]["kind"], by[va]["next"]["who"]) == (
        "quoted",
        "confirm",
        "customer",
    )
    assert by[va]["total"] == 3_388_000 and by[vc]["total"] is None
    assert (by[vc]["next"]["kind"], by[vc]["next"]["who"]) == ("reply", "vendor")

    did = confirm(api, pid, va).json()["deal"]["id"]
    o = api.get(f"/projects/{pid}/overview").json()
    assert [s["state"] for s in o["after_steps"]] == ["done", "done", "now", "todo", "todo"]
    by = {v["visit_id"]: v for v in o["vendors"]}
    assert (by[va]["status"], by[vb]["status"], by[vb]["next"]["kind"]) == (
        "chosen",
        "closed",
        "none",
    )
    login(api, "maru@mitjip.test")
    x = propose(api, did, *days(14)).json()["proposal"]["id"]
    use(api, customer)
    api.post(f"/projects/{pid}/deals/{did}/dates/{x}/accept", json={"seen_version": 0})
    o = api.get(f"/projects/{pid}/overview").json()
    assert [s["state"] for s in o["after_steps"]] == ["done", "done", "done", "now", "todo"]


def test_my_projects_v3_emd_and_live_vendor_steps(api):
    _customer, pid, va, vb, vc = setup(api)
    query("update projects set emd = '상계동'")
    query(
        "update visits set reply_due_at = now() + interval '30 hours' where id = $1", uuid.UUID(vc)
    )
    (row,) = api.get("/projects").json()
    assert row["emd"] == "상계동"
    steps = {v["visit_id"]: v for v in row["vendors"]}
    assert set(steps) == {va, vb, vc}  # 살아 있는 요청만
    due = datetime.fromisoformat(steps[vc]["next"]["due_at"])
    assert steps[vc]["next"]["kind"] == "reply" and due > datetime.now().astimezone()
    assert (steps[vc]["next"]["overdue"], steps[vc]["next"]["soon"]) == (False, False)
    query(
        "update visits set reply_due_at = now() + interval '3 hours' where id = $1", uuid.UUID(vc)
    )
    soon = {v["visit_id"]: v for v in api.get("/projects").json()[0]["vendors"]}[vc]["next"]
    assert (soon["overdue"], soon["soon"]) == (False, True)  # 12시간 안 (calc.deadline.is_soon)
    query("update visits set reply_due_at = now() - interval '1 hour' where id = $1", uuid.UUID(vc))
    late = {v["visit_id"]: v for v in api.get("/projects").json()[0]["vendors"]}[vc]["next"]
    assert late["overdue"] is True
    confirm(api, pid, va)
    steps = {v["visit_id"] for v in api.get("/projects").json()[0]["vendors"]}
    assert steps == {va}  # 확정 뒤 닫힌 요청은 빠진다
    login(api, "maru@mitjip.test")
    assert api.get("/projects").status_code == 403


def test_ready_deal_has_thread_and_v3_fields_in_job(api):
    _, _, did, _ = ready(api)
    job = api.get(f"/vendor/jobs/{did}").json()
    assert (job["work_days"], job["done_photos"], job["auto_done_at"], job["thread_id"]) == (
        [],
        [],
        None,
        None,  # v2로 만든 요청은 채팅이 없다
    )
    assert (job["day_no"], job["grand_total"]) == (
        None,
        job["quote"]["total"],
    )  # 공사 전 · 추가 없음
    assert "customer" not in job["visit"]  # B3: 연락처는 채팅으로


def test_job_day_no_counts_picked_work_days(api):
    """B3: 오늘이 공사 몇째 날인지 (공사 날 목록 기준, 사이에 쉬는 날은 세지 않음)"""
    _, _, did = scheduled(api)
    first, last = TODAY - timedelta(days=2), TODAY + timedelta(days=1)
    query(
        "update deals set start_date = $1, end_date = $2, work_days = $3",
        first,
        last,
        [first, TODAY, last],
    )
    assert api.get(f"/vendor/jobs/{did}").json()["day_no"] == 2
    query("update deals set work_days = $1", [first, last])  # 오늘은 고른 날 사이 쉬는 날
    assert api.get(f"/vendor/jobs/{did}").json()["day_no"] is None
