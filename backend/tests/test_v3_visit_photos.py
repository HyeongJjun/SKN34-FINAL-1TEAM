"""v3 요청 사진 (B3 · B2a, visit_photos 0034): 고객 본인 공간 사진(kind photo)만 10장까지 · 이름표 ·
담은 업체마다 같은 사진 · 그 요청을 받은 업체만 보기(다른 요청 404 · 역할 403 · 로그인 없음 401) ·
옛 칸(photo_file_ids)도 받기 · v2 길에는 안 붙임 · 업체 응답에 고객 이름 · 연락처 칸 없음."""

import uuid

from tests.conftest import query
from tests.helpers import JPEG, signup, upload, use
from tests.test_v3_visit_kit import add, ask, customer, vendor, visit_of
from tests.test_visit_inbox import login


def code(r) -> tuple[int, str]:
    return r.status_code, r.json().get("error", {}).get("code", "")


def photo(api, name: str = "living.jpg", kind: str = "photo") -> str:
    r = upload(api, kind=kind, content=JPEG, name=name)
    assert r.status_code == 201, r.text
    return r.json()["id"]


def test_photos_go_with_the_request_and_only_to_its_vendors(api):
    a = vendor(api, "maru@mitjip.test", "마루와벽")
    b = vendor(api, "gyeol@mitjip.test", "결도배")
    token, pid = customer(api)
    p1, p2 = photo(api, "living.jpg"), photo(api, "room.jpg")
    assert add(api, pid, a).status_code == 201 and add(api, pid, b).status_code == 201
    r = ask(api, pid, [a, b], photos=[{"file_id": p1, "label": " 거실 벽 "}, {"file_id": p2}])
    assert r.status_code == 201, r.text
    va, vb = visit_of(pid, a), visit_of(pid, b)
    rows = query("select visit_id, file_id, sort, label from visit_photos order by visit_id, sort")
    assert {str(x["visit_id"]) for x in rows} == {va, vb} and len(rows) == 4  # 업체마다 같은 사진
    head = api.get(f"/projects/{pid}/visits", params={"trade": "dobae"}).json()["head"]
    assert (head["photos"], head["photo_labels"]) == ([p1, p2], ["거실 벽", None])

    login(api, "maru@mitjip.test")
    det = api.get(f"/vendor/visits/{va}").json()
    assert (det["photos"], det["photo_labels"]) == ([p1, p2], ["거실 벽", None])
    assert "customer" not in det and det["area_label"] == "노원구 · 공급 105.8㎡"  # B3 · F7
    got = api.get(f"/vendor/visits/{va}/photos/{p1}")
    assert got.status_code == 200 and got.headers["content-type"] == "image/jpeg"
    assert got.headers["cache-control"] == "private, no-store"  # 파일 경로와 같은 머리
    assert api.get(f"/vendor/visits/{vb}/photos/{p1}").status_code == 404  # 다른 업체가 받은 요청
    assert api.get(f"/vendor/visits/{va}/photos/{uuid.uuid4()}").status_code == 404
    login(api, "gyeol@mitjip.test")
    assert api.get(f"/vendor/visits/{vb}/photos/{p2}").status_code == 200
    assert api.get(f"/vendor/visits/{va}/photos/{p2}").status_code == 404
    use(api, token)
    assert api.get(f"/vendor/visits/{va}/photos/{p1}").status_code == 403  # 고객이 업체 길
    api.cookies.clear()
    assert api.get(f"/vendor/visits/{va}/photos/{p1}").status_code == 401


def test_photo_rules(api):
    a = vendor(api, "maru@mitjip.test", "마루와벽")
    token, pid = customer(api)
    assert add(api, pid, a).status_code == 201
    mine, plan = photo(api), photo(api, "plan.jpg", kind="plan")
    signup(api, "other@mitjip.test")
    theirs = photo(api, "x.jpg")
    use(api, token)
    many = [{"file_id": str(uuid.uuid4())} for _ in range(11)]
    assert ask(api, pid, [a], photos=many).status_code == 422  # 10장까지
    assert ask(api, pid, [a], photos=[{"file_id": mine}] * 2).status_code == 422  # 같은 사진 두 번
    assert ask(api, pid, [a], photos=[{"file_id": mine, "label": "가" * 21}]).status_code == 422
    both = ask(api, pid, [a], photo_file_ids=[mine], photos=[{"file_id": mine}])
    assert both.status_code == 422  # 옛 칸 · 새 칸 하나만
    assert code(ask(api, pid, [a], photos=[{"file_id": plan}])) == (422, "invalid")  # 공간 사진만
    assert code(ask(api, pid, [a], photos=[{"file_id": theirs}])) == (422, "invalid")  # 남의 사진
    old = {"trade": "dobae", "vendor_ids": [a], "photos": [{"file_id": mine}]}
    assert code(api.post(f"/projects/{pid}/visits", json=old)) == (422, "invalid")  # v2 길에는 없음
    assert query("select count(*) as n from visits")[0]["n"] == 0
    r = ask(api, pid, [a], photo_file_ids=[mine])  # 옛 칸도 받는다
    assert r.status_code == 201, r.text
    assert [str(x["file_id"]) for x in query("select file_id from visit_photos")] == [mine]
