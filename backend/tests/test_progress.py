"""공사 진행 사진: 공사 첫날부터 · 고객 알림 한 번 · 같은 키 한 번 · 사진 보기 권한 · 상태 · 사진 규칙."""

import uuid

from tests.conftest import query
from tests.helpers import signup, use
from tests.test_extras import extra, notes, photo, ready_other, scheduled
from tests.test_visit_inbox import login


def started(did: str) -> None:
    """공사 첫날이 오늘이 되게 (시험에서만 날짜를 당긴다)"""
    query(
        "update deals set start_date = current_date, end_date = current_date + 2,"
        " work_days = array[current_date, current_date + 1, current_date + 2] where id = $1",
        uuid.UUID(did),
    )


def post(api, did: str, files: list[str], **over):
    return api.post(f"/vendor/jobs/{did}/progress", json={"file_ids": files, **over})


def test_progress_after_start_notifies_once(api):
    customer, pid, did = scheduled(api)
    f = photo(api)
    r = post(api, did, [f], note="거실 초배 끝")
    assert r.status_code == 409 and r.json()["error"]["code"] == "too_early"  # 아직 공사 전
    started(did)
    key = str(uuid.uuid4())
    r = post(api, did, [f], note="거실 초배 끝", client_key=key)
    assert r.status_code == 201, r.text
    (p,) = r.json()["progress"]
    assert p["note"] == "거실 초배 끝" and p["photos"] == [f]
    again = post(api, did, [f], note="거실 초배 끝", client_key=key)
    assert again.status_code == 200 and len(again.json()["progress"]) == 1  # 같은 키는 한 번
    assert notes("work_progress") == [
        {
            "body": "마루와벽이 공사 진행 사진을 올렸어요 · 거실 초배 끝",
            "link": f"/projects/{pid}/assistant",
            "dedup_key": f"progress:{p['id']}",
        }
    ]
    assert api.get(f"/vendor/jobs/{did}/photos/{f}").status_code == 200

    use(api, customer)
    (t,) = api.get(f"/projects/{pid}/schedule").json()["trades"]
    assert [x["id"] for x in t["deal"]["progress"]] == [p["id"]]
    assert api.get(f"/projects/{pid}/deals/{did}/photos/{f}").status_code == 200
    signup(api, "other@mitjip.test")
    assert api.get(f"/projects/{pid}/deals/{did}/photos/{f}").status_code == 404  # 남의 집


def test_progress_rules(api):
    customer, _, did = scheduled(api)
    started(did)
    f = photo(api)
    assert post(api, did, []).status_code == 422  # 사진 없이
    assert post(api, did, [f, f]).status_code == 422  # 같은 사진 두 번
    assert post(api, did, [f], note="  ").status_code == 422
    assert post(api, did, [str(uuid.uuid4())]).status_code == 422  # 내가 올린 사진이 아님
    assert post(api, did, [f]).status_code == 201
    r = post(api, did, [f])
    assert r.status_code == 409 and r.json()["error"]["code"] == "already"  # 붙인 사진 다시
    use(api, customer)
    assert post(api, did, [f]).status_code == 403  # 고객은 못 올림
    login(api, "maru@mitjip.test")
    query(
        "update deals set status = 'checking', work_done_on = current_date, done_posted_at = now()"
        " where id = $1",
        uuid.UUID(did),
    )
    r = post(api, did, [photo(api, "b.jpg")])
    assert r.status_code == 409 and r.json()["error"]["code"] == "invalid_state"  # 끝냈다고 올린 뒤


def test_photo_not_shared_with_extra(api):
    _, _, did = scheduled(api)
    started(did)
    a, b = photo(api, "a.jpg"), photo(api, "b.jpg")
    assert post(api, did, [a]).status_code == 201
    r = extra(api, did, 10_000, file_ids=[a])  # 진행 기록 사진 → 추가 금액
    assert r.status_code == 409 and r.json()["error"]["code"] == "file_used", r.text
    assert extra(api, did, 10_000, file_ids=[b]).status_code == 201
    r = post(api, did, [b])  # 추가 금액 사진 → 진행 기록
    assert r.status_code == 409 and r.json()["error"]["code"] == "already", r.text


def test_progress_other_vendor_and_reselected(api):
    _, _, did = scheduled(api)
    started(did)
    login(api, "gyeol@mitjip.test")
    assert post(api, did, [photo(api)]).status_code == 404  # 남의 공사
    login(api, "maru@mitjip.test")
    query("update deals set status = 'reselected' where id = $1", uuid.UUID(did))
    r = post(api, did, [photo(api)])
    assert r.status_code == 409 and r.json()["error"]["code"] == "invalid_state"


def test_progress_max(api):
    _, _, did = scheduled(api)
    started(did)
    query(
        "insert into deal_progress (id, deal_id, day)"
        " select gen_random_uuid(), $1, current_date from generate_series(1, 30)",
        uuid.UUID(did),
    )
    r = post(api, did, [photo(api)])
    assert r.status_code == 422 and r.json()["error"]["fields"][0]["loc"][-1] == "file_ids", r.text


def test_progress_photo_only_from_its_deal(api):
    _, _, did = scheduled(api)
    started(did)
    f = photo(api)
    assert post(api, did, [f]).status_code == 201
    _, _, did2, _ = ready_other(api)  # 다른 업체(마루와벽둘)의 공사
    login(api, "maru2@mitjip.test")
    assert api.get(f"/vendor/jobs/{did2}/photos/{f}").status_code == 404
    login(api, "maru@mitjip.test")
    assert api.get(f"/vendor/jobs/{uuid.uuid4()}/photos/{f}").status_code == 404
