"""0단계 계약: 새 경로 뼈대(501 not_ready) · 권한(401 · 403) · OpenAPI 모양 · 오류 코드 · 알림 목록 ·
thread.service 세 함수 · realtime.push 줄기 모양."""

import asyncio
import json
import re
import uuid

import pytest
import redis

from app.db import SessionLocal
from app.main import app
from app.notify import catalog
from app.shared import errors
from tests.conftest import REDIS_URL, query
from tests.helpers import make_admin, signup, upload, use
from tests.test_v3_schema_visit import base
from tests.test_vendor_profile import approved_vendor

X = str(uuid.uuid4())
HOME = {"sido": "seoul", "sgg": "노원구", "emd": "상계동", "area_m2": "69.4",
        "area_basis": "supply", "occupied": False, "grade": "basic"}  # fmt: skip
SLOT = {"day": "2026-12-15", "half": "am"}
# B1a의 v3 경로 (방법, 경로, 역할, 몸통): 역할 None = 로그인 없이, both = 고객 · 업체, any = 로그인한 누구나.
# 채팅 · 줄기 · 리뷰 · 신고 · 관리자 · 업체 멈춤 경로는 B1b가 자기 테스트로 본다(1단계에서 뺌).
ROUTES = [
    ("POST", "/guest/standard", None, HOME),
    ("GET", "/regions/seoul/노원구", None, None),
    ("GET", f"/projects/{X}/log", "customer", None),
    ("GET", f"/projects/{X}/plan.ics", "customer", None),
    ("GET", f"/projects/{X}/shortlist?trade=dobae", "customer", None),
    ("POST", f"/projects/{X}/shortlist", "customer", {"trade": "dobae", "vendor_id": X}),
    ("DELETE", f"/projects/{X}/shortlist/{X}?trade=dobae", "customer", None),
    ("GET", f"/projects/{X}/visits/draft?trade=dobae", "customer", None),
    ("GET", f"/projects/{X}/visits/{X}", "customer", None),
    ("POST", f"/projects/{X}/visits/{X}/pick", "customer", SLOT),
    ("POST", f"/projects/{X}/visits/{X}/proposal/pick", "customer", SLOT),
    ("POST", f"/projects/{X}/visits/{X}/repick", "customer", None),
    ("POST", f"/projects/{X}/visits/{X}/again", "customer", None),
    ("POST", f"/projects/{X}/visits/{X}/visited", "customer", {"result": "visited"}),
    ("POST", f"/projects/{X}/visits/{X}/changes", "customer", SLOT),
    ("POST", f"/projects/{X}/visits/{X}/changes/{X}/withdraw", "customer", None),
    ("POST", f"/projects/{X}/visits/{X}/changes/{X}/pick", "customer", SLOT),
    ("POST", f"/projects/{X}/visits/{X}/requote", "customer", None),
    ("GET", f"/projects/{X}/visits/{X}/ics", "customer", None),
    ("POST", f"/projects/{X}/visits/{X}/cancel", "customer", {"code": "changed"}),
    ("POST", f"/projects/{X}/deals/{X}/extras/{X}/answer", "customer", {"answer": "approve"}),
    ("POST", f"/vendor/visits/{X}/window", "vendor",
     {"start": "2026-12-10", "end": "2026-12-20", "excluded": [], "instant": True}),
    ("POST", f"/vendor/visits/{X}/accept", "vendor", None),
    ("POST", f"/vendor/visits/{X}/propose", "vendor", {"reason_code": "other_site", "slots": [SLOT]}),
    ("POST", f"/vendor/visits/{X}/changes/{X}/accept", "vendor", None),
    ("POST", f"/vendor/visits/{X}/changes/{X}/propose", "vendor", {"slots": [SLOT]}),
    ("GET", "/vendor/schedule?from=2026-12-01&to=2026-12-31", "vendor", None),
    ("GET", "/vendor/visits?tab=sched", "vendor", None),
    ("GET", f"/vendor/jobs/{X}/log", "vendor", None),
    ("POST", f"/vendor/jobs/{X}/done", "vendor", {"note": "벽지 남은 것 두고 가요"}),
    ("POST", f"/vendor/jobs/{X}/dates", "vendor", {"days": ["2027-01-04"], "crew": 2}),
    ("GET", "/vendor/review-links", "vendor", None),
    ("PUT", "/vendor/review-links", "vendor", {"links": [{"url": "https://blog.example.com"}]}),
    ("POST", "/vendor/prices/dobae/confirm", "vendor",
     {"base_version": 0, "lines": [{"key": "putty", "mode": "price", "unit_price": 20000}]}),
    ("POST", f"/admin/vendors/{X}/links/0", "admin", {"status": "shown"}),
]  # fmt: skip
# 아직 뼈대(501 not_ready)인 경로. 동작하게 되면 여기서 빼고 contract.md 11장 '동작함'에 적는다
NOT_READY: set[tuple[str, str]] = set()


def call(api, method: str, path: str, body):
    return api.request(method, path, json=body) if body is not None else api.request(method, path)


def tokens(api) -> dict[str, str]:
    t = {"customer": signup(api, "c@mitjip.test"), "vendor": approved_vendor(api, "v@mitjip.test")}
    t["admin"] = make_admin(api)
    return t


def test_new_routes_answer_not_ready_for_their_role(api):
    t = tokens(api)
    many = {"both": ["customer", "vendor"], "any": ["customer", "vendor", "admin"]}
    for method, path, role, body in ROUTES:
        if (method, path) not in NOT_READY:
            continue
        for who in many.get(role, [role]):
            if who is None:
                api.cookies.clear()
            else:
                use(api, t[who])
            r = call(api, method, path, body)
            assert r.status_code == 501, (method, path, who, r.status_code, r.text)
            assert r.json() == {"error": {"code": "not_ready", "message": "아직 준비 중이에요."}}


def test_new_routes_need_login_and_the_right_role(api):
    t = tokens(api)
    for method, path, role, body in ROUTES:
        if role is None:
            continue
        api.cookies.clear()
        r = call(api, method, path, body)
        assert r.status_code == 401, (method, path, r.status_code)
        assert r.json()["error"]["code"] == "login_required"
        if role == "any":
            continue
        other = {"customer": "vendor", "vendor": "customer", "admin": "customer", "both": "admin"}
        use(api, t[other[role]])
        r = call(api, method, path, body)
        assert r.status_code == 403, (method, path, r.status_code)


def test_old_bodies_still_go_the_old_way(api):
    """옛 몸통은 지금 service가 받는다(뼈대가 막지 않음): 몸통 없는 단가 확인 · 이유 없는 취소"""
    approved_vendor(api, "v@mitjip.test")
    r = api.post("/vendor/prices/dobae/confirm")
    assert r.status_code == 409 and r.json()["error"]["code"] == "invalid_state"  # 저장한 단가 없음


def test_openapi_has_v3_shapes():
    spec = app.openapi()
    paths = spec["paths"]
    for method, path, _role, _body in ROUTES:
        bare = path.split("?")[0]
        assert any(
            method.lower() in ops and re.fullmatch(re.sub(r"\{[^}]+\}", "[^/]+", p), bare)
            for p, ops in paths.items()
        ), (method, path)
    names = spec["components"]["schemas"]
    for name in (
        "HomeInfoIn", "HomeInfoOut", "GuestStandardOut", "VendorCardOut", "ShortlistOut",
        "BoardRowOut", "VisitPickOut", "PickOut", "WindowIn", "VendorScheduleOut", "ThreadRowOut",
        "ThreadOut", "MessageOut", "MessageIn", "StreamEventsDoc", "StreamStateOut",
        "ReviewPageOut", "VendorReviewsOut", "ReportIn", "ReportDetailOut", "MemberPageOut",
        "EstimateV3Out", "PricesV3Out", "ConfirmPricesIn", "ReviewLinkOut", "RatingOut",
        "LogItemOut", "AnswerIn", "DoneIn", "VisitNextOut",
    ):  # fmt: skip
        assert name in names, name
    assert not [n for n in names if "__" in n]  # 같은 이름 다른 모양이 없다
    assert "from" in names["MessageOut"]["properties"]  # 보낸 쪽 칸 이름은 from
    guest = paths["/guest/standard"]["post"]["requestBody"]["content"]["application/json"]
    assert guest["schema"]["$ref"].endswith("/HomeInfoIn")  # 1단계 POST /projects와 같은 칸
    heads = [x["name"] for x in paths["/projects"]["post"]["parameters"] if x["in"] == "header"]
    assert heads == ["Idempotency-Key"]
    assert "text/event-stream" in paths["/stream"]["get"]["responses"]["200"]["content"]


def test_error_codes_and_not_ready():
    assert errors.CODES["not_ready"][0] == 501
    for code, (status, message) in errors.CODES.items():
        assert status in (401, 403, 404, 409, 413, 422, 429, 501), code
        assert message.endswith(("요.", "세요.")), code  # 해요체
    e = errors.not_ready()
    assert (e.status, e.code) == (501, "not_ready")
    for code in ("stale", "already", "slots_full", "slot_taken", "expired", "locked",
                 "read_only", "paper_unsupported", "no_estimate", "blocked_retry"):  # fmt: skip
        assert errors.CODES[code][0] == 409, code


def test_notification_catalog():
    used_now = {
        "visit_requested", "visit_declined", "visit_cancelled", "visit_closed", "quote_sent",
        "quote_resent", "deal_confirmed", "deal_reselected", "dates_proposed", "dates_requested",
        "dates_accepted", "extra_added", "extra_acked", "work_done", "work_checked",
        "vendor_approve", "vendor_needs_info", "vendor_reject",
    }  # fmt: skip
    assert used_now <= set(catalog.KINDS)
    assert all(len(k) <= 30 for k in catalog.KINDS)  # notifications.kind 30자
    assert catalog.link("visit_offered", pid="p1", vid="v1") == "/projects/p1/visits/v1"
    assert catalog.link("visit_change_requested", tid="t1") == "/chat/t1"
    with pytest.raises(KeyError):
        catalog.link("visit_offered", pid="p1")


def test_thread_service_open_post_system_read_only(api):
    from app.thread import service as thread

    pid, a, _, vid = base(api)
    customer = query("select owner_id from projects")[0]["owner_id"]

    async def go():
        async with SessionLocal() as s:
            kw = {
                "project_id": pid,
                "vendor_id": a,
                "customer_id": customer,
                "visit_id": vid,
                "customer_label": "상계동 고객",
                "vendor_label": "가",
                "area_label": "노원구 상계동 69.4㎡",
            }
            tid = await thread.open(s, **kw)
            assert await thread.open(s, **kw) == tid  # (공사, 업체)마다 하나
            one = await thread.post_system(s, tid, code="visit_booked", ref_id=vid)
            two = await thread.post_system(s, tid, code="change_requested")
            with pytest.raises(ValueError):
                await thread.post_system(s, tid, code="hello")
            first = await thread.set_read_only(s, project_id=pid, vendor_id=a, reason="cancelled")
            again = await thread.set_read_only(s, thread_id=tid, reason="declined")
            reopened = await thread.open(s, **kw)  # 다시 확정되면 다시 열린다
            blocked = await thread.set_read_only(s, thread_id=tid, reason="blocked")
            await thread.open(s, **kw)  # 차단은 그대로
            found = await thread.find(s, pid, a)
            await s.commit()
            return tid, one, two, first, again, reopened, blocked, found

    tid, one, two, first, again, reopened, blocked, found = asyncio.run(go())
    assert (one, two) == (1, 2) and first == tid and again is None
    assert reopened == tid and blocked == tid and found == tid
    row = query("select status, ro_reason, last_seq from threads")[0]
    assert (row["status"], row["ro_reason"], row["last_seq"]) == ("read_only", "blocked", 2)
    msgs = query("select seq, sender_role, kind, system_code from thread_messages order by seq")
    assert [(m["seq"], m["system_code"]) for m in msgs] == [
        (1, "visit_booked"),
        (2, "change_requested"),
    ]
    assert {(m["sender_role"], m["kind"]) for m in msgs} == {("system", "system")}


def test_realtime_push_writes_ids_only(monkeypatch):
    from redis.asyncio import Redis

    from app import queue
    from app.realtime import service as realtime

    user = uuid.uuid4()

    async def go():
        r = Redis.from_url(REDIS_URL)
        monkeypatch.setattr(queue, "redis", r)
        try:
            n = await realtime.push([user, None, user], "msg", {"thread_id": X, "seq": 3})
            s = await realtime.push_state([user], "visit", uuid.UUID(X), project_id=None)
            zero = await realtime.push([], "notif", {"unread": 1})
            with pytest.raises(ValueError):
                await realtime.push([user], "chat", {})
            return n, s, zero
        finally:
            await r.aclose()

    assert asyncio.run(go()) == (1, 1, 0)
    key = realtime.stream_key(user)
    assert key == f"mj:test:ev:{user}"
    sync = redis.Redis.from_url(REDIS_URL)
    items = sync.xrange(key)
    assert [(i[1][b"e"], json.loads(i[1][b"d"])) for i in items] == [
        (b"msg", {"thread_id": X, "seq": 3}),
        (b"state", {"kind": "visit", "project_id": None, "id": X}),
    ]
    assert 0 < sync.ttl(key) <= realtime.TTL_SECONDS


# ---- 입구 순서 (main.py, b7.md 3장 · 4장 W1 · W2): SecurityHeaders → CatchAll → BodyLimit → OriginGuard ----


def test_chunked_big_body_is_413_not_400(api):
    def chunks():
        for _ in range(17):  # 1,088KB를 나눠 보냄 (JSON 한도 1MB). 옛 check_origin은 400으로 바꿨다
            yield b" " * (64 * 1024)

    r = api.post("/auth/login", content=chunks(), headers={"content-type": "application/json"})
    assert r.status_code == 413 and r.json()["error"]["code"] == "too_large"


def test_origin_guard_checks_fetch_site_and_stream(api):
    r = api.post("/auth/login", json={}, headers={"sec-fetch-site": "cross-site"})
    assert r.status_code == 403 and r.json()["error"]["code"] == "bad_origin"
    wrong = {"email": "a@b.cd", "password": "x"}
    same = {"sec-fetch-site": "same-origin"}
    assert api.post("/auth/login", json=wrong, headers=same).status_code == 401
    api.cookies.clear()  # 줄기는 로그인 확인보다 출처 확인이 먼저
    assert api.get("/stream", headers={"origin": "https://evil.example"}).status_code == 403
    assert api.get("/stream", headers=same).status_code == 401


def test_security_headers_on_api_and_file_headers_kept(api):
    r = api.get("/health/live")
    assert r.headers["cache-control"] == "no-store"
    assert r.headers["content-security-policy"] == "default-src 'none'; frame-ancestors 'none'"
    assert r.headers["x-frame-options"] == "SAMEORIGIN"
    assert r.headers["cross-origin-resource-policy"] == "same-origin"
    signup(api)
    f = api.get(f"/files/{upload(api).json()['id']}")
    assert f.headers["cache-control"] == "private, no-store"  # 파일 경로가 정한 값은 그대로
    assert "sandbox" in f.headers["content-security-policy"]


def test_guest_routes_count_ip_limit(api):
    api.cookies.clear()
    for _ in range(20):  # 분당 20번까지는 계산까지 간다
        assert api.post("/guest/standard", json=HOME).status_code == 200
    r = api.post("/guest/standard", json=HOME)
    assert r.status_code == 429 and r.json()["error"]["code"] == "too_many_attempts"
    assert int(r.headers["retry-after"]) >= 1
