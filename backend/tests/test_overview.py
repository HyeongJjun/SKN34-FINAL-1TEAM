"""내 공사 한눈에 · 목록 · 서류 · 공사 전 체크: 두 공정(목공은 끝남 · 도배는 다시 고름), 권한, 제약."""

from datetime import datetime

import asyncpg
import pytest

from app.calc.schedule import contact_until
from app.shared.clock import today_seoul
from tests.conftest import BACKEND, query
from tests.helpers import signup, use
from tests.test_final_plan import MOK, accept, proposal_of, two
from tests.test_project import body as project_body
from tests.test_visit_inbox import login
from tests.test_visit_vendors import NOWON_32

TODAY = today_seoul()


def finished_and_reselected(api):
    """목공은 공사까지 끝났고(고객 확인), 도배는 확정을 풀고 다시 고르는 중인 집"""
    customer, pid, dm, dd = two(api)
    xm = proposal_of(api, "barum@mitjip.test", dm, MOK)
    use(api, customer)
    assert accept(api, pid, dm, xm, 0).status_code == 200
    query(
        "update deals set start_date = current_date - 3, end_date = current_date"
        " where trade = 'mokgong'"
    )
    login(api, "barum@mitjip.test")
    assert api.post(f"/vendor/jobs/{dm}/done").status_code == 200
    use(api, customer)
    assert api.post(f"/projects/{pid}/deals/{dm}/check", json={"result": "done"}).status_code == 200
    assert api.post(f"/projects/{pid}/deals/{dd}/reselect").status_code == 200
    return customer, pid, dm, dd


def test_overview_of_two_trades(api):
    _customer, pid, _dm, _ = finished_and_reselected(api)
    o = api.get(f"/projects/{pid}/overview").json()
    assert (o["phase"], o["region"], o["sgg"]) == ("progress", "서울 노원구", "노원구")
    mok, dob = o["trades"]
    assert (mok["trade"], mok["phase"], mok["deal_status"], mok["todo"]["code"]) == (
        "mokgong",
        "done",
        "done",
        "done",
    )
    assert [st["state"] for st in mok["steps"]] == ["done"] * 6
    assert mok["steps"][4]["label"] == "업체 확정" and mok["vendor_name"] == "바름집수리"
    until = contact_until(TODAY)
    assert mok["todo"]["text"] == "공사가 끝났어요 · 하자가 보이면 바름집수리에 전화해요"
    assert (dob["trade"], dob["phase"], dob["current"], dob["todo"]["code"]) == (
        "dobae",
        "estimate",  # 다시 고르기로 닫힌 요청은 단계에서 빠진다
        3,
        "pick",
    )
    assert dob["todo"]["link"] == f"/projects/{pid}/vendors?trade=dobae"
    assert o["todo"]["code"] == "pick"  # 끝남보다 업체 고르기가 먼저
    assert o["next"] is None
    money = o["money"]
    assert [(m["trade"], m["source"]) for m in money["by_trade"]] == [
        ("mokgong", "deal"),
        ("dobae", "standard"),
    ]
    assert money["total"] == sum(m["total"] for m in money["by_trade"])
    assert money["all_confirmed"] is False and money["budget"]["status"] in (
        "within",
        "over",
        "open",
    )
    assert o["period"]["kind"] == "final"
    (c,) = o["contacts"]  # 목공만: 도배는 다시 골라 가려졌다
    assert (c["trade"], c["vendor_name"], c["contact_until"]) == (
        "mokgong",
        "바름집수리",
        until.isoformat(),
    )
    assert c["contact"]["phone"]
    assert o["checks"] == [
        {
            "key": "office_report",
            "label": "관리사무소에 공사 신고를 했어요",
            "done": False,
            "done_at": None,
        }
    ]


def test_my_projects_list(api):
    _customer, pid, _, _ = finished_and_reselected(api)
    fresh = api.post("/projects", json=project_body(**NOWON_32)).json()["id"]
    rows = api.get("/projects").json()
    assert [r["id"] for r in rows] == [fresh, pid]  # 바뀐 날 최근 순
    new, old = rows
    assert (new["phase"], new["current"], new["todo"]["code"]) == ("estimate", 3, "pick")
    assert (old["phase"], old["current"], old["todo"]["code"]) == ("progress", 3, "pick")
    assert old["grades"] == {"dobae": "basic", "mokgong": None}
    assert old["code"].startswith("MJ-")
    assert datetime.fromisoformat(old["updated_at"]) > datetime.fromisoformat(old["created_at"])
    login(api, "barum@mitjip.test")
    assert api.get("/projects").status_code == 403


def test_docs(api):
    _customer, pid, _dm, _dd = finished_and_reselected(api)
    d = api.get(f"/projects/{pid}/docs").json()
    assert {(x["trade"], x["version"], x["latest"]) for x in d["standard"]} == {
        ("dobae", 1, True),
        ("mokgong", 1, True),
    }
    assert d["standard_total"] == sum(x["total"] for x in d["standard"])
    assert {(x["kind"], x["version"]) for x in d["plans"]} == {("expected", 1), ("final", 1)}
    by = {x["vendor_name"]: x for x in d["quotes"]}
    assert (by["바름집수리"]["closed"], by["바름집수리"]["versions"][0]["confirmed"]) == (
        False,
        True,
    )
    assert (by["마루와벽"]["closed"], by["마루와벽"]["close_reason"]) == (True, "reselected")
    assert by["마루와벽"]["versions"][0]["confirmed"] is False  # 다시 고른 확정은 기록으로만
    link = by["바름집수리"]["versions"][0]["file_links"][0]
    assert link.startswith(f"/api/projects/{pid}/quotes/")
    assert api.get(link.removeprefix("/api")).status_code == 200
    assert [x["trade"] for x in d["extras"]] == ["mokgong"]
    signup(api, "other@mitjip.test")
    assert api.get(f"/projects/{pid}/docs").status_code == 404
    assert api.get(f"/projects/{pid}/overview").status_code == 404


def test_checks_on_and_off(api):
    customer, pid, _, _ = two(api)
    use(api, customer)
    url = f"/projects/{pid}/checks/office_report"
    r = api.put(url, json={"done": True})
    assert r.status_code == 200 and r.json()[0]["done"] is True and r.json()[0]["done_at"]
    assert api.put(url, json={"done": True}).status_code == 200  # 두 번 켜도 한 줄
    assert query("select count(*) n from project_checks")[0]["n"] == 1
    assert api.put(url, json={"done": False}).json()[0]["done"] is False
    assert query("select count(*) n from project_checks")[0]["n"] == 0
    assert api.put(f"/projects/{pid}/checks/elevator", json={"done": True}).status_code == 422
    login(api, "maru@mitjip.test")
    assert api.put(url, json={"done": True}).status_code == 403  # 업체
    signup(api, "other@mitjip.test")
    assert api.put(url, json={"done": True}).status_code == 404  # 남의 집
    with pytest.raises(asyncpg.exceptions.CheckViolationError):
        query("insert into project_checks (project_id, key) select id, 'elevator' from projects")


def test_checks_migration_down_and_up(api):
    from alembic import command
    from alembic.config import Config

    customer, pid, _, _ = two(api)
    use(api, customer)
    assert api.put(f"/projects/{pid}/checks/office_report", json={"done": True}).status_code == 200
    cfg = Config(str(BACKEND / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND / "migrations"))
    try:
        command.downgrade(cfg, "0017_v2_extra")
        names = {
            r["tablename"]
            for r in query("select tablename from pg_tables where schemaname = 'public'")
        }
        assert "project_checks" not in names
    finally:
        command.upgrade(cfg, "head")
    assert api.put(f"/projects/{pid}/checks/office_report", json={"done": True}).status_code == 200
