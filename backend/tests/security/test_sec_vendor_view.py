"""W8 · T03: 업체가 받는 응답에 고객 이름 · 휴대폰 · 이메일 · 단지 · 동 · 호가 없는지 (security.md AC-03 · PI-01 · PI-07).
집은 구 · 읍면동까지, 예산은 가요. 연락은 실측이 확정되면 채팅으로 해요(B3)."""

import json
import uuid

from tests.conftest import query
from tests.helpers import use
from tests.test_dates import ready
from tests.test_v3_visit_kit import (
    CUSTOMER_NAME,
    PHONE,
    add,
    answer,
    ask,
    choose,
    customer,
    day,
    vendor,
    visit_of,
)
from tests.test_visit_inbox import login

# 합성 값: 업체 응답 어디에도 나오면 안 된다
HOME = {"apt_name": "비밀단지아파트", "dong": "비밀동표", "ho": "비밀호표"}
SECRETS = (CUSTOMER_NAME, PHONE, "010-1234-5678", "home@mitjip.test", "비밀")
# 사람 · 집을 가리키는 칸 이름. name은 공정 단계 · 공휴일 이름에도 쓰여서 값(고객 이름)으로 본다
NO_KEYS = {"customer", "customer_name", "customer_phone", "phone", "email"}
NO_KEYS |= {"address", "apt_name", "dong", "ho"}
TABS = ("todo", "waiting", "sched", "jobs", "done")


def bad_keys(x, at: str = "") -> list[str]:
    """응답 안에서 NO_KEYS 칸이 있는 자리"""
    if isinstance(x, dict):
        here = [f"{at}.{k}" for k in x if k in NO_KEYS]
        return here + [p for k, v in x.items() for p in bad_keys(v, f"{at}.{k}")]
    if isinstance(x, list):
        return [p for i, v in enumerate(x) for p in bad_keys(v, f"{at}[{i}]")]
    return []


def clean(got: dict, secrets) -> str:
    text = json.dumps(got, ensure_ascii=False)
    for secret in secrets:
        assert secret not in text, secret
    assert bad_keys(got) == []
    return text


def booked_with_home(api) -> dict:
    """단지 · 동 · 호 · 읍면동 · 예산을 넣은 집 → 요청 → 업체 기간 답 → 바로 확정. 업체로 로그인한 채 끝난다."""
    vid = vendor(api, "maru@mitjip.test", "마루와벽")
    token, pid = customer(api)  # 김믿집 · 01012345678 · home@mitjip.test
    query(
        "update projects set apt_name = $1, dong = $2, ho = $3, emd = '상계동', budget_won = 5000000"
        " where id = $4",
        *HOME.values(),
        uuid.UUID(pid),
    )
    assert add(api, pid, vid).status_code == 201
    assert ask(api, pid, [vid]).status_code == 201
    visit = visit_of(pid, vid)
    login(api, "maru@mitjip.test")
    assert answer(api, visit).status_code == 200
    use(api, token)
    r = choose(api, pid, visit)
    assert r.status_code == 200 and r.json()["status"] == "booked", r.text
    login(api, "maru@mitjip.test")
    return {"pid": pid, "visit": visit}


def test_vendor_sees_no_customer_identity_in_the_v3_flow(api):
    f = booked_with_home(api)
    got: dict[str, object] = {}

    def get(path: str, **params):
        r = api.get(path, params=params)
        assert r.status_code == 200, (path, r.text)
        got[f"{path} {params}"] = r.json()
        return r.json()

    for tab in TABS:
        get("/vendor/visits", tab=tab)
    get("/vendor/visits/summary")
    detail = get(f"/vendor/visits/{f['visit']}")
    get(f"/vendor/visits/{f['visit']}/quote")
    get("/vendor/schedule", **{"from": day(0).isoformat(), "to": day(30).isoformat()})
    get("/notifications")
    (row,) = get("/threads")  # 확정되면 대화가 열린다
    assert row["thread_id"] == detail["thread_id"] and row["title"] == "상계동 고객"
    get(f"/threads/{row['thread_id']}")
    get(f"/threads/{row['thread_id']}/messages")

    text = clean(got, SECRETS)
    assert "노원구 상계동" in text  # 구 · 읍면동까지는 간다
    assert detail["budget_won"] == 5_000_000  # 예산도 간다 (D03 B)


def test_vendor_job_shows_no_contact_even_after_the_old_v2_share(api):
    _, _, did, va = ready(api)  # v2 요청: 연락처 동의 + 상계주공 101동 1203호를 보낸 업체가 확정됨
    query("update users set name = '비밀이름' where email = 'home@mitjip.test'")
    got = {}
    for path in (f"/vendor/jobs/{did}", f"/vendor/visits/{va}", "/vendor/visits?tab=jobs"):
        r = api.get(path)
        assert r.status_code == 200, (path, r.text)
        got[path] = r.json()
    assert got[f"/vendor/jobs/{did}"]["visit"]["share_contact"] is True  # 옛 동의는 남아 있어도
    contact = ("상계주공", "101동", "1203호")
    clean(got, ("비밀이름", PHONE, "010-1234-5678", "home@mitjip.test", *contact))
