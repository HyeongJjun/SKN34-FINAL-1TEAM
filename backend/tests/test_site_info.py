"""현장 정보(주차 · 엘리베이터 · 출입 방법)와 공사 전 준비 체크를 업체가 보는 것: 권한, 입력 한도, 출입 방법이 보이는 때."""

import asyncpg
import pytest

from tests.conftest import query
from tests.helpers import signup, use
from tests.test_final_plan import two
from tests.test_v3_visit_kit import booked, requested
from tests.test_visit_inbox import login

SITE = {"parking": "yes", "elevator": "no", "entry_note": "정문 경비실에 말하고 들어와요"}


def test_site_set_get_and_clear(api):
    f = requested(api)
    url = f"/projects/{f['pid']}/site"
    assert api.get(url).json() == {"parking": None, "elevator": None, "entry_note": None}
    assert api.put(url, json=SITE).json() == SITE
    assert api.get(url).json() == SITE
    # 통째로 바꾼다: 비운 칸은 지워지고, 빈칸만 있는 글은 없는 것으로
    r = api.put(url, json={"parking": "no", "entry_note": "   "})
    assert r.json() == {"parking": "no", "elevator": None, "entry_note": None}


def test_site_rejects_bad_values_and_secrets(api):
    f = requested(api)
    url = f"/projects/{f['pid']}/site"
    assert api.put(url, json={"parking": "maybe"}).status_code == 422
    assert api.put(url, json={"entry_note": "가" * 101}).status_code == 422
    # 비밀번호 · 전화번호 · 긴 숫자는 받지 않는다(채팅으로 알리게)
    bads = (
        "공동현관 비밀번호 눌러요",
        "현관 1234 누르고 와요",
        "010-1234-5678로 전화",
        "101동 203호 앞으로 오세요",
        "3동 앞",
        "101동에서 기다려요",
        "203호예요",
    )
    for bad in bads:
        r = api.put(url, json={"entry_note": bad})
        assert r.status_code == 422 and r.json()["error"]["fields"][0]["loc"] == ["entry_note"]
    assert api.get(url).json()["entry_note"] is None  # 아무것도 저장되지 않았다
    # 동 · 호가 아닌 말(동쪽 · 호출)은 받는다
    ok = api.put(
        url, json={"entry_note": "2동쪽 문 말고 정문으로, 1호기 엘리베이터, 도착하면 경비실 호출"}
    )
    assert ok.status_code == 200, ok.text
    with pytest.raises(asyncpg.exceptions.CheckViolationError):
        query("update projects set parking = 'abc'")


def test_site_only_owner(api):
    f = requested(api)
    url = f"/projects/{f['pid']}/site"
    login(api, f["email"])
    assert api.get(url).status_code == 403 and api.put(url, json=SITE).status_code == 403  # 업체
    signup(api, "other@mitjip.test")
    assert api.get(url).status_code == 404 and api.put(url, json=SITE).status_code == 404  # 남의 집


def test_vendor_sees_note_only_after_booked(api):
    # 요청만 온 때: 주차 · 엘리베이터는 보이고 출입 방법은 안 보인다
    f = requested(api)
    assert api.put(f"/projects/{f['pid']}/site", json=SITE).status_code == 200
    login(api, f["email"])
    site = api.get(f"/vendor/visits/{f['visit']}").json()["site"]
    assert site == {"parking": "yes", "elevator": "no", "entry_note": None}


def test_vendor_sees_note_when_booked_and_none_when_empty(api):
    f = booked(api)
    login(api, f["email"])
    assert api.get(f"/vendor/visits/{f['visit']}").json()["site"] is None  # 아무것도 안 적음
    use(api, f["token"])
    assert api.put(f"/projects/{f['pid']}/site", json=SITE).status_code == 200
    login(api, f["email"])
    assert api.get(f"/vendor/visits/{f['visit']}").json()["site"] == SITE  # 실측 확정 뒤


def test_prep_checks_shown_to_vendor(api):
    customer, pid, _dm, dd = two(api)
    use(api, customer)
    keys = [
        c["key"]
        for c in api.put(f"/projects/{pid}/checks/furniture_moved", json={"done": True}).json()
    ]
    assert keys == ["office_report", "furniture_moved", "fragile_away", "neighbors_told"]
    assert api.put(f"/projects/{pid}/checks/unknown", json={"done": True}).status_code == 422
    login(api, "maru@mitjip.test")
    checks = {c["key"]: c["done"] for c in api.get(f"/vendor/jobs/{dd}").json()["checks"]}
    assert checks == {
        "office_report": False,
        "furniture_moved": True,
        "fragile_away": False,
        "neighbors_told": False,
    }
    # 업체는 보기만: 켜고 끌 수 없다
    assert (
        api.put(f"/projects/{pid}/checks/furniture_moved", json={"done": False}).status_code == 403
    )


def test_vendor_loses_note_when_visit_cancelled(api):
    f = booked(api)
    assert api.put(f"/projects/{f['pid']}/site", json=SITE).status_code == 200
    r = api.post(f"/projects/{f['pid']}/visits/{f['visit']}/cancel", json={"code": "changed"})
    assert r.status_code == 200, r.text
    login(api, f["email"])
    site = api.get(f"/vendor/visits/{f['visit']}").json()["site"]
    assert site == {
        "parking": "yes",
        "elevator": "no",
        "entry_note": None,
    }  # 취소되면 출입 방법은 다시 가린다
