"""v3 제약 (data-model.md 8장): 기본 정보 · 업체 · 단가 줄 · 외부 링크 · 견적서 칩 · 파일 종류 · jobs ·
채팅 · 리뷰 · 신고 · 추가 금액 판 · 공사 날 목록 · 파일 열람 기록. 그리고 0025 · 0030 채우기 · 되돌리기."""

import uuid
from datetime import date, timedelta

import asyncpg
import pytest

from tests.conftest import query
from tests.helpers import use
from tests.test_extras import extra, scheduled
from tests.test_v3_schema_visit import base, migrate, raises
from tests.test_visit_inbox import login
from tests.test_visit_request import home
from tests.test_visit_vendors import priced

Check = asyncpg.exceptions.CheckViolationError
Unique = asyncpg.exceptions.UniqueViolationError
FILE = (
    "insert into files (id, owner_id, kind, storage_key, filename, content_type, size, sha256)"
    " values ($1, $2, $3, $4, 'a.jpg', 'image/jpeg', 10, repeat('0', 64))"
)


def a_file(owner: uuid.UUID, kind: str = "review_photo") -> uuid.UUID:
    fid = uuid.uuid4()
    query(FILE, fid, owner, kind, f"k/{fid}")
    return fid


def test_project_v3_columns(api):
    _, p = home(api)
    pid = uuid.UUID(p["id"])
    assert query("select source from projects")[0]["source"] == "v2"  # 옛 길로 만든 공사
    query("update projects set budget_won = 3000000, emd = '상계동', source = 'guest'")
    raises(Check, "update projects set budget_won = 3005000")  # 만 원 단위
    raises(Check, "update projects set budget_won = 50000")
    raises(Check, "update projects set budget_won = 20000000000")
    raises(Check, "update projects set source = 'app'")
    key = uuid.uuid4()
    query("update projects set client_key = $1", key)
    _, p2 = home(api, "home2@mitjip.test")
    query(
        "update projects set client_key = $1 where id = $2", key, uuid.UUID(p2["id"])
    )  # 다른 사람
    owner = query("select owner_id from projects where id = $1", pid)[0]["owner_id"]
    raises(
        Unique, "update projects set owner_id = $1, client_key = $2 where id <> $3", owner, key, pid
    )
    # 공종 범위 · 면
    raises(Check, "update project_trades set scope = 'half'")
    raises(Check, "update project_trades set faces = '{wall}'")  # 전체는 벽 + 천장
    query("update project_trades set scope = 'partial', faces = '{wall}'")
    raises(Check, "update project_trades set faces = '{wall,floor}'")
    raises(Check, "update project_trades set faces = '{}'")
    # 공간 종류: 한 공사에 같은 종류 하나
    spaces = [r["id"] for r in query("select id from project_spaces where project_id = $1", pid)]
    raises(Check, "update project_spaces set kind = 'garage'")
    query("update project_spaces set kind = 'living' where id = $1", spaces[0])
    if len(spaces) > 1:
        raises(Unique, "update project_spaces set kind = 'living' where id = $1", spaces[1])


def test_standard_quote_scope_share_ver(api):
    base(api)  # 실측 요청이 표준견적서를 만든다
    assert query("select scope, faces, share_ver from standard_quotes")[0]["scope"] == "full"
    raises(Check, "update standard_quotes set scope = 'partial'")  # 공간 몫 표 판 없음
    query(
        "update standard_quotes set scope = 'partial', share_ver = 'share-2026.1', faces = '{wall}'"
    )
    raises(Check, "update standard_quotes set scope = 'full'")  # 전체인데 판이 남음
    raises(Check, "update standard_quotes set faces = '{roof}'")


def test_vendor_v3_columns(api):
    _, a, _, _ = base(api)
    row = query(
        "select tax_kind, visit_capacity, instant_default from vendors where user_id = $1", a
    )
    assert (row[0]["visit_capacity"], row[0]["instant_default"]) == (2, False)  # L03 기본 2
    query("update vendors set tax_kind = 'simplified'")  # L02
    raises(Check, "update vendors set tax_kind = 'small'")
    raises(Check, "update vendors set visit_capacity = 0")
    raises(Check, "update vendors set visit_capacity = 4")
    raises(Check, "update vendors set suspended_at = now()")  # 범위 없이
    raises(Check, "update vendors set suspend_scope = 'new'")  # 때 없이
    query("update vendors set suspended_at = now(), suspend_scope = 'all' where user_id = $1", a)
    raises(Check, "update vendors set suspend_scope = 'some' where user_id = $1", a)
    query(
        "update vendors set status = 'rejected', review_code = 'info_mismatch', approved_at = null"
        " where user_id = $1",
        a,
    )  # A04 거절 사유
    raises(Check, "update vendors set review_code = 'info_mismatch', status = 'needs_info'")


def test_price_rows_ver_and_line_mode(api):
    priced(api, "maru@mitjip.test", "마루와벽")
    assert {r["rows_ver"] for r in query("select rows_ver from vendor_price_sets")} == {"dobae_v2"}
    raises(Check, "update vendor_price_sets set rows_ver = 'mokgong_v1'")  # 도배 묶음
    raises(Check, "update vendor_price_sets set rows_ver = 'dobae_v9'")
    query("update vendor_price_sets set rows_ver = 'dobae_v3'")
    assert {r["mode"] for r in query("select mode from vendor_price_lines")} <= {
        "price",
        "included",
    }
    key = query("select key from vendor_price_lines where mode = 'price' limit 1")[0]["key"]
    raises(Check, "update vendor_price_lines set unit_price = null where key = $1", key)
    raises(Check, "update vendor_price_lines set mode = 'included' where key = $1", key)
    raises(Check, "update vendor_price_lines set mode = 'always'")
    query(
        "update vendor_price_lines set mode = 'excluded', unit_price = null, included_in = null"
        " where key = $1",
        key,
    )  # 빼기
    raises(Check, "update vendor_price_lines set unit_price = 1000 where key = $1", key)


def test_0025_fills_included_mode_and_down_drops_excluded(api):
    priced(api, "maru@mitjip.test", "마루와벽")
    keys = [r["key"] for r in query("select key from vendor_price_lines order by key")]
    query(
        "update vendor_price_lines set mode = 'included', unit_price = null, included_in = $1"
        " where key = $2",
        keys[0],
        keys[1],
    )
    query(
        "update vendor_price_lines set mode = 'excluded', unit_price = null, included_in = null"
        " where key = $1",
        keys[2],
    )
    query("update vendors set tax_kind = 'simplified'")
    try:
        migrate("0024_v3_project")
        assert len(query("select key from vendor_price_lines where key = $1", keys[2])) == 0
        assert query("select tax_kind from vendors")[0]["tax_kind"] == "general"
    finally:
        migrate("head")
    got = {r["key"]: r["mode"] for r in query("select key, mode from vendor_price_lines")}
    assert got[keys[1]] == "included" and got[keys[0]] == "price"  # included_in이 있던 줄을 채움


def test_review_links_and_quote_chips(api):
    _, a, _, vid = base(api)
    link = "insert into vendor_review_links (vendor_id, sort, url) values ($1, $2, $3)"
    query(link, a, 0, "https://blog.example.com/a")
    raises(Check, link, a, 1, "http://blog.example.com/a")  # https만
    raises(Check, link, a, 3, "https://blog.example.com/a")  # 3개까지
    raises(Unique, link, a, 0, "https://blog.example.com/b")
    raises(Check, "update vendor_review_links set status = 'shown'")  # 확인한 때 없음
    query("update vendor_review_links set status = 'shown', checked_at = now()")
    raises(Check, "update vendor_review_links set status = 'checking'")
    # 실측 견적서 '포함됐나요?' 칩: 업체 임시 저장 → 보기 → DB
    login(api, "a@mitjip.test")
    body = {"incl_removal": True, "incl_waste": False, "paper_spec": " LX 베스띠 · 폭 106cm ",
            "warranty_months": 12}  # fmt: skip
    r = api.put(f"/vendor/visits/{vid}/quote", json=body)
    assert r.status_code == 200, r.text
    d = r.json()["draft"]
    assert (d["incl_removal"], d["incl_waste"], d["paper_spec"], d["warranty_months"]) == (
        True, False, "LX 베스띠 · 폭 106cm", 12,
    )  # fmt: skip
    assert api.put(f"/vendor/visits/{vid}/quote", json={"warranty_months": 121}).status_code == 422
    raises(Check, "update vendor_quotes set warranty_months = 121")
    raises(Check, "update vendor_quotes set paper_spec = '  '")


def test_file_kinds_v3(api):
    home(api)
    owner = query("select owner_id from projects")[0]["owner_id"]
    for kind in ("chat_photo", "review_photo", "done_photo"):
        a_file(owner, kind)
    with pytest.raises(Check):
        a_file(owner, "selfie")


def test_file_views_keep_rows_without_fk():
    # 0032 열람 기록: 역할은 세 가지만, 파일 · 사람이 없어도(FK 없음) 줄이 남고 본 때는 DB가 채운다
    view = (
        "insert into file_views (id, file_id, owner_id, viewer_id, viewer_role, kind) values"
        " (gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), $1, 'license')"
    )
    query(view, "admin")
    query(view, "vendor")
    raises(Check, view, "guest")
    assert [r["at"] is not None for r in query("select at from file_views")] == [True, True]
    idx = query("select indexdef from pg_indexes where indexname = 'ix_file_views_owner_at'")
    assert "(owner_id, at)" in idx[0]["indexdef"]


def test_jobs_constraints():
    job = (
        "insert into jobs (id, kind, ref_id, run_at, dedup_key) values"
        " (gen_random_uuid(), $1, gen_random_uuid(), now(), $2)"
    )
    query(job, "visit_reply_due", "k1")
    raises(Unique, job, "visit_pick_due", "k1")  # 같은 일 두 번
    raises(Check, job, "visit_lunch", "k2")
    raises(Check, "update jobs set status = 'running'")  # 잠금 없이
    query("update jobs set status = 'running', locked_until = now() + interval '2 minutes'")
    raises(Check, "update jobs set status = 'done'")  # 잠금이 남음 · 끝낸 때 없음
    query("update jobs set status = 'done', locked_until = null, done_at = now()")
    raises(Check, "update jobs set status = 'pending'")  # 끝낸 때가 남음
    raises(Check, "update jobs set attempts = 11")
    raises(Check, "update jobs set last_error = ' '")


def test_thread_tables(api):
    _, a, _, vid = base(api)
    pid = query("select project_id from visits")[0]["project_id"]
    customer = query("select owner_id from projects")[0]["owner_id"]
    th = (
        "insert into threads (id, project_id, vendor_id, customer_id, visit_id, customer_label,"
        " vendor_label, area_label) values ($1, $2, $3, $4, $5, '상계동 고객', '가', '노원구 상계동')"
    )
    tid = uuid.uuid4()
    query(th, tid, pid, a, customer, vid)
    raises(Unique, th, uuid.uuid4(), pid, a, customer, vid)  # (공사, 업체)마다 하나
    raises(Check, "update threads set status = 'read_only'")  # 사유 없이
    raises(Check, "update threads set ro_reason = 'blocked'")  # 열린 대화에 사유
    query("update threads set status = 'read_only', ro_reason = 'cancelled'")
    raises(Check, "update threads set ro_reason = 'bored'")
    raises(Check, "update threads set last_seq = -1")
    msg = (
        "insert into thread_messages (id, thread_id, seq, sender_role, sender_id, kind, body,"
        " system_code, client_key) values (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8)"
    )
    key = uuid.uuid4()
    query(msg, tid, 1, "customer", customer, "text", "101동 1203호예요", None, key)
    raises(Unique, msg, tid, 1, "vendor", a, "text", "네", None, None)  # seq 빈틈 · 겹침 없음
    raises(Unique, msg, tid, 2, "customer", customer, "text", "다시", None, key)  # 같은 글 두 번
    query(msg, tid, 2, "vendor", a, "text", "네", None, key)  # 다른 사람은 같은 키여도 된다
    raises(Check, msg, tid, 3, "customer", customer, "system", None, "visit_booked", None)
    raises(Check, msg, tid, 3, "system", None, "system", None, None, None)  # 카드 코드 없음
    raises(Check, msg, tid, 3, "customer", customer, "text", None, None, None)  # 빈 글
    raises(Check, msg, tid, 3, "customer", customer, "text", "  ", None, None)
    raises(Check, msg, tid, 0, "customer", customer, "text", "글", None, None)
    query(msg, tid, 3, "system", None, "system", None, "visit_booked", None)
    raises(Check, "update thread_messages set warn = 'scam'")
    query("update thread_messages set body = null, redacted_at = now() where seq = 1")  # 보관 정리
    rd = "insert into thread_reads (thread_id, user_id, last_read_seq) values ($1, $2, $3)"
    query(rd, tid, customer, 3)
    raises(Unique, rd, tid, customer, 3)
    raises(Check, "update thread_reads set last_read_seq = -1")


def test_reports_and_admin_actions(api):
    _, a, _, _ = base(api)
    customer = query("select owner_id from projects")[0]["owner_id"]
    rep = (
        "insert into reports (id, kind, reporter_id, vendor_id, message_id, link_sort, reason_code)"
        " values (gen_random_uuid(), $1, $2, $3, $4, $5, $6)"
    )
    query(rep, "vendor", customer, a, None, None, "offsite")
    query(rep, "link", customer, a, None, 1, "not_vendor")
    raises(Check, rep, "link", customer, a, None, 1, "offsite")  # 종류 × 이유
    raises(Check, rep, "chat", customer, a, None, None, "wrong_place")
    raises(Check, rep, "link", customer, a, None, None, "other")  # 링크 번호 없음
    raises(Check, rep, "vendor", customer, a, None, 0, "other")  # 링크가 아닌데 번호
    raises(Check, rep, "link", customer, a, None, 3, "other")
    raises(Check, "update reports set action = 'warn'")  # 열린 신고에 조치
    raises(Check, "update reports set status = 'resolved', action = 'warn'")  # 처리한 때 없음
    query("update reports set status = 'resolved', action = 'warn', resolved_at = now()")
    raises(Check, "update reports set action = 'ban'")
    act = (
        "insert into admin_actions (id, action, target_user_id) values (gen_random_uuid(), $1, $2)"
    )
    query(act, "warn_vendor", a)
    raises(Check, act, "delete_vendor", a)


def test_reports_same_message_once_while_open(api):
    _, a, _, _ = base(api)
    customer = query("select owner_id from projects")[0]["owner_id"]
    pid = query("select project_id from visits")[0]["project_id"]
    tid, mid = uuid.uuid4(), uuid.uuid4()
    query(
        "insert into threads (id, project_id, vendor_id, customer_id, customer_label,"
        " vendor_label, area_label) values ($1, $2, $3, $4, 'x', 'y', 'z')",
        tid, pid, a, customer,
    )  # fmt: skip
    query(
        "insert into thread_messages (id, thread_id, seq, sender_role, sender_id, kind, body)"
        " values ($1, $2, 1, 'vendor', $3, 'text', '계좌로 주세요')",
        mid, tid, a,
    )  # fmt: skip
    rep = (
        "insert into reports (id, kind, reporter_id, thread_id, message_id, reason_code, evidence)"
        " values (gen_random_uuid(), 'chat', $1, $2, $3, 'offsite', '계좌로 주세요')"
    )
    query(rep, customer, tid, mid)
    raises(Unique, rep, customer, tid, mid)  # 같은 글 두 번 신고
    query("update reports set status = 'dismissed', action = 'none', resolved_at = now()")
    query(rep, customer, tid, mid)  # 처리한 뒤에는 다시 신고할 수 있다


def test_work_extras_reviews_deal_files(api):
    customer, pid, did = scheduled(api)  # 업체(마루와벽)로 로그인해 있다
    did_u = uuid.UUID(did)
    assert extra(api, did, 150_000).status_code == 201
    x = query("select id, group_id, version, ack from extra_charges")[0]
    assert (x["group_id"], x["version"], x["ack"]) == (x["id"], 1, "pending")  # 첫 판
    use(api, customer)
    base_url = f"/projects/{pid}/deals/{did}/extras/{x['id']}"
    r = api.post(f"{base_url}/ack", json={"ack": "ok"})
    assert r.status_code == 200, r.text
    item = r.json()["items"][0]
    assert (item["ack"], item["answer"], item["version"]) == ("ok", "approved", 1)  # 옛 · 새 값
    assert query("select ack from extra_charges")[0]["ack"] == "approved"
    raises(Check, "update extra_charges set ack = 'ok'")  # 옛 값은 없다
    copy = (
        "insert into extra_charges (id, deal_id, title, reason, vat_mode, entered_amount, supply,"
        " vat, total, group_id, version, client_key) select gen_random_uuid(), deal_id, title,"
        " reason, vat_mode, entered_amount, supply, vat, total, group_id, $1, $2 from extra_charges"
        " where version = 1"
    )
    raises(Unique, copy, 1, None)  # 같은 판 번호
    raises(Unique, copy, 2, None)  # 최신 판은 하나 (앞 판이 아직 최신)
    query("update extra_charges set superseded_at = now()")
    key = uuid.uuid4()
    query(copy, 2, key)  # 고친 새 판
    raises(Check, "update extra_charges set version = 0 where version = 2")
    raises(Unique, "update extra_charges set client_key = $1 where version = 1", key)  # 같은 키
    # 0030 되돌리기 → 다시 올리기: approved → ok → approved, group_id = id
    try:
        migrate("0029_v3_review_report")
        assert {r["ack"] for r in query("select ack from extra_charges")} <= {"ok", "pending"}
    finally:
        migrate("head")
    rows = query("select id, group_id, ack, version from extra_charges order by created_at")
    assert all(r["group_id"] == r["id"] and r["version"] == 1 for r in rows)
    assert rows[0]["ack"] == "approved"
    # 공사 날 목록 · 공사 끝 글 · 사진 · 리뷰 하나
    long = [date(2027, 1, 1) + timedelta(days=n) for n in range(121)]
    raises(Check, "update deals set work_days = $1", long)
    query("update deals set work_days = $1", long[:3])
    raises(Check, "update deals set work_days = '{}'")
    raises(Check, "update deals set done_note = ' '")
    raises(Check, "update date_proposals set days = '{}'")
    vendor = query("select vendor_id from deals")[0]["vendor_id"]
    f1 = a_file(vendor, "done_photo")
    df = "insert into deal_files (deal_id, file_id, sort) values ($1, $2, $3)"
    query(df, did_u, f1, 0)
    raises(Unique, df, did_u, f1, 1)
    raises(Check, df, did_u, a_file(vendor, "done_photo"), 10)
    rv = (
        "insert into reviews (id, deal_id, vendor_id, rating, tags, context_label)"
        " values ($1, $2, $3, $4, $5, '노원구 아파트 · 실크')"
    )
    rid = uuid.uuid4()
    query(rv, rid, did_u, vendor, 5, ["seam", "tidy"])
    raises(Unique, rv, uuid.uuid4(), did_u, vendor, 4, [])  # 공사마다 한 번
    raises(Check, rv, uuid.uuid4(), None, vendor, 6, [])
    raises(Check, rv, uuid.uuid4(), None, vendor, 5, ["cheap"])
    raises(Check, "update reviews set status = 'hidden'")  # 사유 없이
    query("update reviews set status = 'hidden', hidden_code = 'privacy'")
    raises(Check, "update reviews set status = 'shown'")  # 사유가 남음
    reply = "insert into review_replies (review_id, vendor_id, body) values ($1, $2, $3)"
    raises(Check, reply, rid, vendor, " ")
    query(reply, rid, vendor, "감사합니다")
    raises(Unique, reply, rid, vendor, "또")  # 리뷰마다 답글 하나
    photo = "insert into review_photos (review_id, file_id, sort) values ($1, $2, $3)"
    owner = query("select owner_id from projects")[0]["owner_id"]
    raises(Check, photo, rid, a_file(owner), 5)
    # 탈퇴해도 리뷰는 남는다 (공사 · 작성자 SET NULL, L08)
    query("update reviews set author_id = $1", owner)
    query("delete from users where id = $1", owner)
    left = query("select deal_id, author_id, project_id from reviews")
    assert len(left) == 1 and left[0]["author_id"] is None and left[0]["deal_id"] is None


def test_profile_and_portfolio_v3_fields_are_saved(api):
    from tests.helpers import JPEG, upload
    from tests.test_vendor_profile import URL, approved_vendor, portfolio
    from tests.test_vendor_profile import body as profile_body

    approved_vendor(api)
    r = api.put(
        URL, json=profile_body(tax_kind="simplified", instant_default=True, visit_capacity=3)
    )
    assert r.status_code == 200, r.text
    got = r.json()
    assert (got["tax_kind"], got["instant_default"], got["visit_capacity"]) == (
        "simplified",
        True,
        3,
    )
    again = api.put(URL, json=profile_body(updated_at=got["updated_at"]))  # 옛 화면: 칸을 안 보냄
    assert again.status_code == 200, again.text
    assert (again.json()["instant_default"], again.json()["visit_capacity"]) == (True, 3)  # 그대로
    assert api.put(URL, json=profile_body(visit_capacity=4)).status_code == 422
    fid = upload(api, kind="portfolio", content=JPEG, name="room.jpg").json()["id"]
    p = portfolio(api, fid, area_m2="69.4", paper="basic")
    assert p.status_code == 201, p.text
    assert (p.json()["area_m2"], p.json()["paper"]) == ("69.4", "basic")
    assert portfolio(api, fid, paper="vinyl").status_code == 422
