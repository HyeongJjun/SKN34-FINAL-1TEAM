"""실측 견적서 임시 저장 · 보내기: 덮어쓰기, 칸 검사, 계산 엔진 금액, 파일, 상태 · 동시 409, 권한, 알림, 제약."""

import asyncio
import uuid
from datetime import timedelta

import asyncpg
import pytest

from app.auth.models import User
from app.calc.common import from_entered
from app.db import SessionLocal
from app.shared.clock import today_seoul
from app.shared.errors import AppError
from app.visit import service
from tests.conftest import query
from tests.helpers import JPEG, PDF, no_surprises, upload, use, vendor_signup
from tests.test_files import xlsx_bytes
from tests.test_project import body as project_body
from tests.test_visit_inbox import login, visit_of
from tests.test_visit_request import SHARE, home, listed, send
from tests.test_visit_vendors import NOWON_32

TODAY = today_seoul()
FULL = {
    "entered_amount": 3_080_000,
    "vat_mode": "excluded",
    "measured_on": (TODAY - timedelta(days=1)).isoformat(),
    "days": 3,
    "valid_until": (TODAY + timedelta(days=14)).isoformat(),
}
SENT_NO_MODE = (
    "update vendor_quotes set vat_mode = null, supply = null, vat = null, total = null,"
    " sent_at = now()"
)
DRAFT_ROW = (
    "insert into vendor_quotes (id, visit_id, code, version)"
    " select gen_random_uuid(), visit_id, 'Q-2611-9999', {version} from vendor_quotes"
)


def url(vid: str) -> str:
    return f"/vendor/visits/{vid}/quote"


def doc(api, name: str = "마루와벽_실측견적.pdf") -> str:
    r = upload(api, kind="quote_doc", content=PDF, name=name)
    assert r.status_code == 201, r.text
    return r.json()["id"]


def ready(api, email: str = "maru@mitjip.test", name: str = "마루와벽", **profile):
    """승인 업체 + 고객 요청 하나. (고객 토큰, 프로젝트, 요청 id). 끝나면 업체로 로그인해 있다."""
    vid = listed(api, email, name, **profile)
    customer, p = home(api)
    assert send(api, p["id"], [vid], share_contact_ids=[vid], **SHARE).status_code == 201
    login(api, email)
    return customer, p, visit_of(vid)


def test_save_overwrite_then_send(api):
    customer, p, v = ready(api)
    board = api.get(url(v)).json()
    assert board["draft"] is None and board["sent"] == [] and board["visit_status"] == "requested"
    assert board["vat_modes"] == ["included", "excluded", "exempt"]
    assert (board["files_max"], board["days_max"], board["tax_kind"]) == (10, 120, "general")
    f1, f2 = doc(api), doc(api, "고친 견적.pdf")

    first = api.put(
        url(v), json={"file_ids": [f1], "entered_amount": 3_388_000, "vat_mode": "included"}
    )
    assert first.status_code == 200, first.text
    d1 = first.json()["draft"]
    assert d1["code"].startswith(f"Q-{TODAY:%y%m}-") and d1["version"] == 1
    assert (d1["supply"], d1["vat"], d1["total"]) == (3_080_000, 308_000, 3_388_000)

    second = api.put(url(v), json={"file_ids": [f2, f1], **FULL}).json()["draft"]  # 통째로 덮어쓰기
    assert second["id"] == d1["id"] and second["code"] == d1["code"]
    assert [f["file_id"] for f in second["files"]] == [f2, f1]
    assert (second["supply"], second["vat"], second["total"]) == (3_080_000, 308_000, 3_388_000)
    assert second["updated_at"] > d1["updated_at"]
    assert query("select count(*) n from vendor_quotes")[0]["n"] == 1

    sent = api.post(f"{url(v)}/send")
    assert sent.status_code == 200, sent.text
    out = sent.json()
    assert out["draft"] is None and out["visit_status"] == "quoted"
    (q,) = out["sent"]
    assert q["sent_at"] and q["version"] == 1 and q["total"] == 3_388_000
    (row,) = query("select status, quote_ver from visits")
    assert (row["status"], row["quote_ver"]) == ("quoted", 1)
    events = query("select from_status, to_status from visit_events where to_status = 'quoted'")
    assert [(e["from_status"], e["to_status"]) for e in events] == [("requested", "quoted")]
    again = api.post(f"{url(v)}/send")
    assert again.status_code == 409 and again.json()["error"]["code"] == "already_sent"

    me = query("select id from users where email = 'home@mitjip.test'")[0]["id"]
    notes = query(
        "select body, link, project_id, dedup_key from notifications where user_id = $1", me
    )
    assert [dict(n) for n in notes] == [
        {
            "body": "마루와벽이 실측 견적서를 보냈어요 · 도배",
            "link": f"/projects/{p['id']}/quotes?trade=dobae",
            "project_id": uuid.UUID(p["id"]),
            "dedup_key": f"quote:{q['id']}",
        }
    ]

    waiting = api.get("/vendor/visits", params={"tab": "waiting"}).json()["items"]
    assert [(x["id"], x["waiting_days"]) for x in waiting] == [(v, 0)]
    query("update visit_events set at = now() - interval '2 days' where to_status = 'quoted'")
    query("update visit_events set at = now() - interval '5 days' where to_status = 'requested'")
    waiting = api.get("/vendor/visits", params={"tab": "waiting"}).json()["items"]
    assert waiting[0]["waiting_days"] == 2  # 견적서를 보낸 날부터 센다
    assert api.get("/vendor/visits/summary").json()["recent"]["quoted"] == 1

    use(api, customer)
    (mine,) = api.get(f"/projects/{p['id']}/visits").json()["visits"]
    assert mine["status"] == "quoted" and mine["quote"] == {
        "id": q["id"],
        "code": q["code"],
        "version": 1,
        "total": 3_388_000,
        "days": 3,
        "valid_until": FULL["valid_until"],
        "sent_at": q["sent_at"],
    }
    assert mine["contact_visible"] is True  # 견적서 옴: 연락처는 그대로 보인다


def test_send_needs_file_amount_and_vat_mode(api):
    _, _, v = ready(api)
    r = api.post(f"{url(v)}/send")
    assert r.status_code == 422 and r.json()["error"]["code"] == "missing"
    assert [f["loc"][0] for f in r.json()["error"]["fields"]] == [
        "files",
        "entered_amount",
        "vat_mode",
    ]
    api.put(url(v), json={"file_ids": [doc(api)], "entered_amount": 1000})
    r = api.post(f"{url(v)}/send")
    assert [f["loc"][0] for f in r.json()["error"]["fields"]] == ["vat_mode"]
    api.put(url(v), json={"entered_amount": 1000, "vat_mode": "exempt"})
    r = api.post(f"{url(v)}/send")
    assert [f["loc"][0] for f in r.json()["error"]["fields"]] == ["files"]
    assert r.json()["error"]["message"] == "견적서 파일을 하나 이상 올려 주세요."
    old = {
        **FULL,
        "measured_on": (TODAY - timedelta(days=10)).isoformat(),
        "valid_until": (TODAY - timedelta(days=1)).isoformat(),
    }
    assert api.put(url(v), json={"file_ids": [doc(api)], **old}).status_code == 200
    expired = api.post(f"{url(v)}/send")
    assert expired.status_code == 422 and expired.json()["error"]["code"] == "valid_until"

    def put(**over) -> tuple[int, str]:
        r = api.put(url(v), json={**FULL, **over})
        return r.status_code, r.json().get("error", {}).get("code", "")

    assert put(measured_on=(TODAY + timedelta(days=1)).isoformat()) == (422, "measured_on")
    assert put(valid_until=(TODAY - timedelta(days=2)).isoformat()) == (422, "valid_until")
    assert put(days=0)[0] == 422 and put(days=121)[0] == 422
    assert put(entered_amount=-1)[0] == 422 and put(vat_mode="cash")[0] == 422
    assert query("select status from visits")[0]["status"] == "requested"


def test_dates_and_days_are_optional(api):
    _, p, v = ready(api)
    body = {"file_ids": [doc(api)], "entered_amount": 3_388_000, "vat_mode": "included"}
    assert api.put(url(v), json=body).status_code == 200
    r = api.post(f"{url(v)}/send")  # 실측한 날 · 공사 기간 · 유효기간 없이 보낸다
    assert r.status_code == 200, r.text
    (q,) = r.json()["sent"]
    assert (q["measured_on"], q["days"], q["valid_until"]) == (None, None, None)
    assert q["total"] == 3_388_000
    login(api, "home@mitjip.test")
    (mine,) = api.get(f"/projects/{p['id']}/visits").json()["visits"]
    assert mine["quote"]["days"] is None and mine["quote"]["valid_until"] is None


def test_amounts_come_from_calc(api):
    _, _, v = ready(api)
    for amount, mode in (
        (3_388_000, "included"),
        (3_080_000, "excluded"),
        (3_080_000, "exempt"),
        (1_000_001, "included"),
    ):
        d = api.put(url(v), json={"entered_amount": amount, "vat_mode": mode}).json()["draft"]
        m = from_entered(amount, mode)
        assert (d["supply"], d["vat"], d["total"]) == (m.supply, m.vat, m.total), mode
    no_mode = api.put(url(v), json={"entered_amount": 5000}).json()["draft"]
    assert no_mode["total"] is None  # 부가세 방식을 고르기 전에는 계산하지 않는다


def test_exempt_vendor_only_exempt(api):
    _, _, v = ready(api, tax_kind="exempt")
    assert api.get(url(v)).json()["vat_modes"] == ["exempt"]
    bad = api.put(url(v), json={"entered_amount": 3_080_000, "vat_mode": "included"})
    assert bad.status_code == 422 and bad.json()["error"]["code"] == "vat_mode"
    ok = api.put(url(v), json={"entered_amount": 3_080_000, "vat_mode": "exempt"}).json()["draft"]
    assert (ok["vat"], ok["total"]) == (0, 3_080_000)


def test_file_rules(api):
    _, p, v = ready(api)
    sheet = upload(api, kind="quote_doc", content=xlsx_bytes(), name="견적.xlsx")
    assert sheet.status_code == 201  # 엑셀도 된다
    assert upload(api, kind="quote_doc", content=b"hello", name="견적.hwp").status_code == 415
    mine = [doc(api, f"{i}.pdf") for i in range(11)]
    assert api.put(url(v), json={"file_ids": mine}).status_code == 422  # 10개까지
    assert api.put(url(v), json={"file_ids": [mine[0], mine[0]]}).status_code == 422
    photo = upload(api, kind="portfolio", content=JPEG).json()["id"]
    price = upload(api, kind="price_doc", content=PDF, name="단가표.pdf").json()["id"]
    for fid in (photo, price):  # 종류가 다른 내 파일
        assert api.put(url(v), json={"file_ids": [fid]}).json()["error"]["code"] == "file"
    assert api.put(url(v), json={"file_ids": mine[:10]}).status_code == 200

    other = listed(api, "other@mitjip.test", "다른도배")
    theirs = doc(api, "남의 견적.pdf")
    login(api, "maru@mitjip.test")
    assert (
        api.put(url(v), json={"file_ids": [theirs]}).json()["error"]["code"] == "file"
    )  # 남의 파일
    login(api, "home@mitjip.test")
    p2 = api.post("/projects", json=project_body(**NOWON_32)).json()["id"]
    maru = query("select id from users where email = 'maru@mitjip.test'")[0]["id"]
    assert send(api, p2, [str(maru)]).status_code == 201
    v2 = str(query("select id from visits where project_id = $1", uuid.UUID(p2))[0]["id"])
    login(api, "maru@mitjip.test")
    used = api.put(url(v2), json={"file_ids": [mine[0]]})  # 다른 요청 견적서에 붙인 파일
    assert used.status_code == 409 and used.json()["error"]["code"] == "file_used"
    assert other and p


def test_state_rules_and_two_sends_at_once(api):
    customer, p, v = ready(api)
    api.put(url(v), json={"file_ids": [doc(api)], **FULL})
    maru = query("select id from users where email = 'maru@mitjip.test'")[0]["id"]

    async def go():
        async with SessionLocal() as s:
            vendor = await s.get(User, maru)
            return await service.send_quote(s, vendor, uuid.UUID(v), TODAY)

    async def both():
        return await asyncio.gather(go(), go(), return_exceptions=True)

    results = no_surprises(asyncio.run(both()))
    errors = [r for r in results if isinstance(r, AppError)]
    assert len(errors) == 1 and errors[0].status == 409
    assert query("select count(*) n from vendor_quotes where sent_at is not null")[0]["n"] == 1
    assert len(query("select id from notifications where kind = 'quote_sent'")) == 1  # 알림 한 번

    nxt = api.put(url(v), json={"file_ids": [doc(api, "고침.pdf")], **FULL})  # 다음 버전 임시 저장
    assert nxt.status_code == 200 and nxt.json()["draft"]["version"] == 2
    assert nxt.json()["draft"]["code"] == nxt.json()["sent"][0]["code"]  # 같은 번호에 버전만 올린다

    b = listed(api, "b@mitjip.test", "나")
    use(api, customer)
    vb = send(api, p["id"], [b]).json()["created"][0]["id"]
    assert api.post(f"/projects/{p['id']}/visits/{vb}/cancel").status_code == 200
    login(api, "b@mitjip.test")
    r = api.put(url(vb), json=FULL)
    assert (
        r.status_code == 409
        and r.json()["error"]["message"] == "고객이 실측 요청을 취소해서 보낼 수 없어요."
    )
    assert api.post(f"{url(vb)}/send").status_code == 409


def test_declined_and_permissions(api):
    _, p, v = ready(api)
    listed(api, "other@mitjip.test", "다른도배")
    for call in (
        lambda: api.get(url(v)),
        lambda: api.put(url(v), json=FULL),
        lambda: api.post(f"{url(v)}/send"),
    ):
        assert call().status_code == 404  # 다른 업체
    login(api, "home@mitjip.test")
    assert api.get(url(v)).status_code == 403  # 고객
    vendor_signup(api, email="waiting@mitjip.test")
    r = api.get(url(v))
    assert r.status_code == 403 and r.json()["error"]["code"] == "vendor_not_approved"
    login(api, "maru@mitjip.test")
    assert api.post(f"/vendor/visits/{v}/decline", json={"code": "full"}).status_code == 200
    assert api.put(url(v), json=FULL).status_code == 409
    assert api.post(f"{url(v)}/send").status_code == 409
    assert p


@pytest.mark.parametrize(
    ("sql", "error"),
    [
        ("update vendor_quotes set vat_mode = 'cash'", "check"),
        ("update vendor_quotes set entered_amount = -1", "check"),
        ("update vendor_quotes set supply = 1, vat = 1, total = 3", "check"),
        ("update vendor_quotes set entered_amount = null", "check"),  # 금액 없이 합계
        (
            "update vendor_quotes set vat_mode = 'exempt', vat = 10, supply = 100, total = 110",
            "check",
        ),
        ("update vendor_quotes set days = 0", "check"),
        ("update vendor_quotes set days = 121", "check"),
        ("update vendor_quotes set valid_until = measured_on - 1", "check"),
        (SENT_NO_MODE, "check"),  # 부가세 방식 · 합계가 빠진 채 보냄
        ("update vendor_quotes set code = 'X-1'", "check"),
        ("update vendor_quotes set version = 0", "check"),
        (DRAFT_ROW.format(version=2), "unique"),  # 임시 저장 둘
        ("update vendor_quotes set sent_at = now(); " + DRAFT_ROW.format(version=1), "unique"),
        ("update vendor_quote_files set sort = 10", "check"),
    ],
)
def test_db_constraints(api, sql, error):
    _, _, v = ready(api)
    assert api.put(url(v), json={"file_ids": [doc(api)], **FULL}).status_code == 200
    wanted = {
        "check": asyncpg.exceptions.CheckViolationError,
        "unique": asyncpg.exceptions.UniqueViolationError,
    }[error]
    with pytest.raises(wanted):
        for part in sql.split("; "):
            query(part)


SHARE_FILE = (
    "insert into vendor_quote_files (quote_id, file_id, sort)"
    " select d.id, f.file_id, 5 from vendor_quotes d, vendor_quote_files f"
    " where d.sent_at is null and f.quote_id <> d.id"
)


def test_file_shared_across_versions_in_db(api):
    """0014부터 같은 파일을 다음 버전에 다시 붙일 수 있다. 한 버전에 두 번은 PK가 막는다."""
    _, _, v = ready(api)
    api.put(url(v), json={"file_ids": [doc(api)], **FULL})
    api.post(f"{url(v)}/send")
    api.put(url(v), json={"file_ids": [doc(api, "b.pdf")]})  # 다음 버전 임시 저장
    query(SHARE_FILE)
    assert query("select count(distinct file_id) n from vendor_quote_files")[0]["n"] == 2
    with pytest.raises(asyncpg.exceptions.UniqueViolationError):
        query(SHARE_FILE)
