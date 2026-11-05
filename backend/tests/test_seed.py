"""로컬 시험 계정 (app/seed.py)"""

import asyncio

import pytest

from app import seed
from tests.conftest import query
from tests.helpers import PASSWORD


def test_seed_makes_four_accounts_once_and_they_can_log_in(api):
    first = asyncio.run(seed.seed(PASSWORD))
    assert [made for _, made in first] == [True, True, True, True]
    again = asyncio.run(seed.seed(PASSWORD))
    assert [made for _, made in again] == [False, False, False, False]

    roles = {}
    for email, *_ in seed.ACCOUNTS:
        api.cookies.clear()
        r = api.post("/auth/login", json={"email": email, "password": PASSWORD})
        assert r.status_code == 200
        me = api.get("/me").json()
        roles[email] = (me["role"], me["vendor_status"])
    assert roles == {
        "admin@mitjip.local": ("admin", None),
        "customer@mitjip.local": ("customer", None),
        "vendor@mitjip.local": ("vendor", "approved"),
        "vendor-pending@mitjip.local": ("vendor", "pending"),
    }
    assert query("select count(*) n from files where kind = 'license'")[0]["n"] == 2


def test_seed_refuses_outside_local(monkeypatch):
    monkeypatch.setattr(seed.settings, "app_env", "production")
    with pytest.raises(SystemExit):
        seed.main([])
    seed.main(["--auto"])  # docker compose up 때는 멈추지 않고 넘어간다
    assert query("select count(*) n from users")[0]["n"] == 0


def test_auto_seed_skips_without_password(monkeypatch, capsys):
    monkeypatch.setattr(seed.settings, "app_env", "local")
    monkeypatch.delenv("SEED_PASSWORD", raising=False)
    seed.main(["--auto"])
    assert "SEED_PASSWORD" in capsys.readouterr().out
    assert query("select count(*) n from users")[0]["n"] == 0


def test_auto_seed_makes_accounts_with_password(monkeypatch):
    monkeypatch.setattr(seed.settings, "app_env", "local")
    monkeypatch.setenv("SEED_PASSWORD", PASSWORD)
    seed.main(["--auto"])
    assert query("select count(*) n from users")[0]["n"] == 4


def _seed_vendor():
    return query(
        "select v.biz_name, v.contact_method,"
        " (select count(*) from vendor_trades t where t.vendor_id = v.user_id) trades,"
        " (select count(*) from vendor_areas a where a.vendor_id = v.user_id) areas"
        " from vendors v join users u on u.id = v.user_id where u.email = 'vendor@mitjip.local'"
    )[0]


def test_seed_vendor_shows_in_vendor_list(api):
    from tests.test_project import body as project_body
    from tests.test_visit_vendors import NOWON_32

    asyncio.run(seed.seed(PASSWORD))
    v = _seed_vendor()
    assert (v["biz_name"], v["contact_method"], v["trades"], v["areas"]) == (
        "시험인테리어",
        "phone",
        2,
        25,  # 서울 모든 구
    )
    api.cookies.clear()
    api.post("/auth/login", json={"email": "customer@mitjip.local", "password": PASSWORD})
    assert api.get("/me").json()["phone"] == seed.CUSTOMER_PHONE
    r = api.post("/projects", json=project_body(**NOWON_32))
    assert r.status_code == 201, r.text
    got = api.get(f"/projects/{r.json()['id']}/vendors", params={"trade": "dobae"}).json()
    assert [x["biz_name"] for x in got["vendors"]] == ["시험인테리어"]  # 승인 대기 업체는 안 나온다


def test_seed_fills_old_empty_accounts(api):
    asyncio.run(seed.seed(PASSWORD))
    # 예전 시험 계정처럼 업체 정보 · 지역 · 고객 휴대폰이 비어 있으면
    query(
        "update vendors set biz_name = null, owner_name = null, biz_no = null, phone = null,"
        " contact_method = null, call_start = null, call_end = null"
        " where user_id = (select id from users where email = 'vendor@mitjip.local')"
    )
    query(
        "delete from vendor_areas"
        " where vendor_id = (select id from users where email = 'vendor@mitjip.local')"
    )
    query("update users set phone = null where email = 'customer@mitjip.local'")
    again = asyncio.run(seed.seed(PASSWORD))
    assert [made for _, made in again] == [False, False, False, False]
    v = _seed_vendor()
    assert (v["biz_name"], v["contact_method"], v["trades"], v["areas"]) == (
        "시험인테리어",
        "phone",
        2,
        25,
    )
    phone = query("select phone from users where email = 'customer@mitjip.local'")[0]["phone"]
    assert phone == seed.CUSTOMER_PHONE
