"""시연 데이터 (app/demo.py): 단계마다 프로젝트 하나 · 다시 돌리면 계정은 그대로 · 운영에서는 멈춤."""

import asyncio

import pytest

from app import demo
from app.shared.clock import today_seoul
from tests.conftest import query
from tests.helpers import PASSWORD, make_admin


def test_demo_makes_one_project_per_stage(api):
    make_admin(api)
    made = asyncio.run(demo.build(PASSWORD, today_seoul()))
    api.cookies.clear()
    r = api.post("/auth/login", json={"email": demo.CUSTOMER[0], "password": PASSWORD})
    assert r.status_code == 200, r.text
    todo = {x["code"]: x["todo"]["code"] for x in api.get("/projects").json()}
    assert todo == {code: stage for stage, code in made.items()}
    assert list(made) == list(demo.LABEL)

    asyncio.run(demo.build(PASSWORD, today_seoul()))  # 계정은 그대로, 프로젝트만 한 벌 더
    assert len(api.get("/projects").json()) == 10
    assert query("select count(*) n from users where email like 'demo%'")[0]["n"] == 4
    assert query("select count(*) n from vendors where status = 'approved'")[0]["n"] == 3
    sets = query("select count(*) n from vendor_price_sets where status = 'confirmed'")
    assert sets[0]["n"] == 3


def test_demo_needs_an_admin():
    with pytest.raises(RuntimeError):
        asyncio.run(demo.build(PASSWORD, today_seoul()))
    assert query("select count(*) n from users")[0]["n"] == 0


def test_demo_refuses_production(monkeypatch):
    monkeypatch.setattr(demo.settings, "app_env", "production")
    monkeypatch.setenv("DEMO_PASSWORD", PASSWORD)
    with pytest.raises(SystemExit):
        demo.main()
    assert query("select count(*) n from users")[0]["n"] == 0
