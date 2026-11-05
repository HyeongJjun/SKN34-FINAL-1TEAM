"""다시 올릴 때 보낸 견적서 파일 그대로 쓰기: 같은 요청의 버전끼리만, 다른 요청은 409, migration."""

import asyncio
import uuid

import asyncpg
import pytest

from app.auth.models import User
from app.db import SessionLocal
from app.quote.schemas import QuoteDraftIn
from app.shared.clock import today_seoul
from app.shared.errors import AppError
from app.visit import service
from tests.conftest import BACKEND, query
from tests.helpers import no_surprises, use
from tests.test_project import body as project_body
from tests.test_quote_compare import quote, three
from tests.test_vendor_quote import FULL, doc, url
from tests.test_visit_inbox import login
from tests.test_visit_request import send
from tests.test_visit_vendors import NOWON_32

TODAY = today_seoul()


def links(file_id: str) -> list[int]:
    """그 파일이 붙은 견적서 버전 번호"""
    rows = query(
        "select q.version from vendor_quote_files f join vendor_quotes q on q.id = f.quote_id"
        " where f.file_id = $1 order by q.version",
        uuid.UUID(file_id),
    )
    return [r["version"] for r in rows]


def second_visit(api) -> str:
    """같은 고객의 다른 집에서 마루와벽에 요청한 실측. 끝나면 마루와벽으로 로그인해 있다."""
    login(api, "home@mitjip.test")
    p2 = api.post("/projects", json=project_body(**NOWON_32)).json()["id"]
    maru = query("select id from users where email = 'maru@mitjip.test'")[0]["id"]
    assert send(api, p2, [str(maru)]).status_code == 201
    login(api, "maru@mitjip.test")
    return str(query("select id from visits where project_id = $1", uuid.UUID(p2))[0]["id"])


def test_resend_with_the_sent_file(api):
    customer, p, va, _, _ = three(api)
    login(api, "maru@mitjip.test")
    v1 = quote(api, va, 3_080_000, name="처음.pdf")["sent"][0]
    f1 = v1["files"][0]["file_id"]

    r = api.put(url(va), json={**FULL, "entered_amount": 3_110_000, "file_ids": [f1]})
    assert r.status_code == 200, r.text
    assert [f["file_id"] for f in r.json()["draft"]["files"]] == [f1]
    sent = api.post(f"{url(va)}/send")
    assert sent.status_code == 200, sent.text
    v2 = sent.json()["sent"][0]
    assert (v2["version"], [f["file_id"] for f in v2["files"]]) == (2, [f1])
    assert links(f1) == [1, 2]
    assert api.get(f"{url(va)}/files/{f1}").status_code == 200

    use(api, customer)
    cmp = api.get(f"/projects/{p['id']}/quotes", params={"trade": "dobae"}).json()
    row = next(x for x in cmp["vendors"] if x["visit_id"] == va)
    assert row["latest"]["version"] == 2 and row["latest"]["files"][0]["file_id"] == f1
    assert [h["version"] for h in row["history"]] == [1] and row["history"][0]["file_count"] == 1
    assert "files" not in row["changed"]
    base = f"/projects/{p['id']}/quotes"
    for q in (v1, v2):  # 두 버전 모두에서 같은 파일이 열린다
        ok = api.get(f"{base}/{q['id']}/files/{f1}")
        assert ok.status_code == 200 and ok.headers["content-type"] == "application/pdf"


def test_dropping_from_draft_keeps_the_sent_link(api):
    customer, p, va, _, _ = three(api)
    login(api, "maru@mitjip.test")
    v1 = quote(api, va, 3_080_000, name="처음.pdf")["sent"][0]
    f1 = v1["files"][0]["file_id"]
    assert api.put(url(va), json={**FULL, "file_ids": [f1]}).status_code == 200
    assert links(f1) == [1, 2]
    new = doc(api, "고침.pdf")
    r = api.put(url(va), json={**FULL, "file_ids": [new]})  # 임시 저장에서 v1 파일을 뺀다
    assert [f["file_id"] for f in r.json()["draft"]["files"]] == [new]
    assert links(f1) == [1]  # 보낸 버전 연결은 그대로
    assert api.put(url(va), json=FULL).json()["draft"]["files"] == []
    assert query("select count(*) n from files where id = $1", uuid.UUID(f1))[0]["n"] == 1
    use(api, customer)
    assert api.get(f"/projects/{p['id']}/quotes/{v1['id']}/files/{f1}").status_code == 200


def test_file_of_another_visit_is_still_409(api):
    _, _, va, _, _ = three(api)
    login(api, "maru@mitjip.test")
    f1 = quote(api, va, 3_080_000)["sent"][0]["files"][0]["file_id"]
    other = second_visit(api)
    used = api.put(url(other), json={**FULL, "file_ids": [f1]})  # 보낸 버전에 붙은 파일
    assert used.status_code == 409 and used.json()["error"]["code"] == "file_used"
    assert links(f1) == [1]


def test_two_visits_cannot_take_one_file_at_once(api):
    _, _, va, _, _ = three(api)
    login(api, "maru@mitjip.test")
    other = second_visit(api)
    f = uuid.UUID(doc(api, "같이.pdf"))
    maru = query("select id from users where email = 'maru@mitjip.test'")[0]["id"]

    async def go(vid: str):
        async with SessionLocal() as s:
            vendor = await s.get(User, maru)
            data = QuoteDraftIn(file_ids=[f])
            return await service.save_quote(s, vendor, uuid.UUID(vid), data, TODAY)

    async def both():
        return await asyncio.gather(go(va), go(other), return_exceptions=True)

    results = no_surprises(asyncio.run(both()))
    errors = [r for r in results if isinstance(r, AppError)]
    assert len(errors) == 1 and (errors[0].status, errors[0].code) == (409, "file_used")
    assert len(links(str(f))) == 1


def test_share_migration_down_and_up(api):
    from alembic import command
    from alembic.config import Config

    _, _, va, _, _ = three(api)
    login(api, "maru@mitjip.test")
    f1 = quote(api, va, 3_080_000)["sent"][0]["files"][0]["file_id"]
    assert api.put(url(va), json={**FULL, "file_ids": [f1]}).status_code == 200
    assert api.post(f"{url(va)}/send").status_code == 200
    assert api.put(url(va), json={**FULL, "file_ids": [f1]}).status_code == 200  # v3 임시 저장
    assert links(f1) == [1, 2, 3]
    cfg = Config(str(BACKEND / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND / "migrations"))
    try:
        command.downgrade(cfg, "0013_v2_deal")
        assert links(f1) == [1]  # 가장 처음 버전만 남는다
        with pytest.raises(asyncpg.exceptions.UniqueViolationError):  # file UQ가 돌아왔다
            query(
                "insert into vendor_quote_files (quote_id, file_id, sort)"
                " select q.id, $1, 1 from vendor_quotes q where q.version = 2",
                uuid.UUID(f1),
            )
    finally:
        command.upgrade(cfg, "head")
    assert query("select count(*) n from vendor_quotes")[0]["n"] == 3
    assert api.put(url(va), json={**FULL, "file_ids": [f1]}).status_code == 200
    assert links(f1) == [1, 3]
