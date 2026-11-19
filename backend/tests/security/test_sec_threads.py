"""W4 · W5 · W6: 채팅 · 줄기 · 리뷰 · 신고에서 보안 쪽 성질만 더 본다 (security.md AC-01 · IN-01 · RT-02 · RT-03 · T01 · T10 · T12).
기능 시험(같은 키 두 번 · 분당 30 · 6번째 줄기 · 끝난 공사만 리뷰 …)은 B1b 테스트(test_v3_thread_api · test_v3_realtime_stream ·
test_v3_review_api · test_v3_report_api)에 있어요. 여기서는 '없는 것과 남의 것이 같은 404인지' · '로그인 전에 막히는지' ·
'실제 줄기도 출처를 보는지'를 봐요."""

import json
import uuid

from app.realtime import service as rt
from tests.helpers import signup, use
from tests.test_v3_realtime_stream import Reader
from tests.test_v3_review_api import deal_for, write
from tests.test_v3_thread_api import pair, send
from tests.test_vendor_profile import approved_vendor


def same_404(theirs, missing) -> None:
    assert theirs.status_code == missing.status_code == 404, (theirs.text, missing.text)
    assert theirs.json() == missing.json()  # 있는지조차 알 수 없다


def test_someone_elses_thread_looks_like_a_missing_thread(api):
    p = pair(api)
    send(api, p.tid, "실측 전에 연락 주세요")  # 업체로 로그인한 채 끝난 pair → 글 하나
    nobody = uuid.uuid4()
    for token in (signup(api, "other@mitjip.test"), approved_vendor(api, "x@mitjip.test")):
        use(api, token)
        same_404(api.get(f"/threads/{p.tid}"), api.get(f"/threads/{nobody}"))
        same_404(api.get(f"/threads/{p.tid}/messages"), api.get(f"/threads/{nobody}/messages"))
        same_404(send(api, p.tid), send(api, nobody))
        same_404(
            api.post(
                "/reports", json={"kind": "chat", "thread_id": str(p.tid), "reason_code": "abuse"}
            ),
            api.post(
                "/reports", json={"kind": "chat", "thread_id": str(nobody), "reason_code": "abuse"}
            ),
        )


def test_chat_body_limit_is_checked_before_login(api):
    p = pair(api)
    api.cookies.clear()
    big = json.dumps({"client_key": str(uuid.uuid4()), "kind": "text", "body": "a" * 9000})
    r = api.post(
        f"/threads/{p.tid}/messages", content=big, headers={"content-type": "application/json"}
    )
    assert r.status_code == 413 and r.json()["error"]["code"] == "too_large"  # 401보다 먼저


def test_someone_elses_review_looks_like_a_missing_review(api):
    p = pair(api)
    did = deal_for(p)
    use(api, p.customer)
    rid = write(api, p, did).json()["id"]
    nobody = str(uuid.uuid4())
    signup(api, "other@mitjip.test")
    same_404(
        api.patch(f"/reviews/{rid}", json={"rating": 1}),
        api.patch(f"/reviews/{nobody}", json={"rating": 1}),
    )
    same_404(api.delete(f"/reviews/{rid}"), api.delete(f"/reviews/{nobody}"))
    approved_vendor(api, "x@mitjip.test")  # 리뷰를 받지 않은 다른 업체
    reply = {"body": "남의 리뷰에 답글"}
    same_404(
        api.put(f"/vendor/reviews/{rid}/reply", json=reply),
        api.put(f"/vendor/reviews/{nobody}/reply", json=reply),
    )


def test_real_stream_refuses_other_sites_even_when_logged_in(api, monkeypatch):
    monkeypatch.setattr(rt, "PING_SECONDS", 0.2)
    monkeypatch.setattr(rt, "MAX_SECONDS", 5.0)
    p = pair(api)
    use(api, p.customer)
    evil = api.get("/stream", headers={"origin": "https://evil.example"})
    assert evil.status_code == 403 and evil.json()["error"]["code"] == "bad_origin"
    assert api.get("/stream", headers={"sec-fetch-site": "cross-site"}).status_code == 403
    with api.stream("GET", "/stream", headers={"sec-fetch-site": "same-origin"}) as r:
        assert r.status_code == 200 and r.headers["content-type"].startswith("text/event-stream")
        assert r.headers["cache-control"] == "no-cache, no-transform"  # 줄기 머리는 그대로
        assert r.headers["x-content-type-options"] == "nosniff"  # 보안 머리는 붙고
        assert Reader(r).next()["event"] == "ready"  # 본문은 막히지 않고 흐른다
