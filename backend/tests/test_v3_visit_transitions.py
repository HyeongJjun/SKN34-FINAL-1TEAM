"""v3 실측 요청 상태 전이 표 (data-model 5장 visits): 표에 없는 전이는 모두 409이고 상태가 그대로다.
지난 상태(declined · expired · cancelled · no_show · closed)에서는 어디로도 못 나간다(한 번 더 요청은 새 행).
허용 전이가 실제로 하는 일은 test_v3_visit_flow · _changes · _jobs가 보고, 여기서는 상태마다 직접 지나가
보는 것(취소 · 못 받아요 · 실측 받았어요 · 안 왔어요)도 함께 본다."""

import uuid

from app.config import settings
from tests.conftest import query
from tests.helpers import use
from tests.test_v3_visit_kit import d, day, requested, status
from tests.test_visit_inbox import login

STATES = (
    "requested",
    "offered",
    "picked",
    "proposed",
    "booked",
    "visited",
    "quoted",
    "chosen",
    "declined",
    "expired",
    "cancelled",
    "no_show",
    "closed",
)
CANCELLABLE = {"requested", "offered", "picked", "proposed", "booked", "visited"}
SLOT = {"day": d(6), "half": "am"}
WINDOW = {"start": d(5), "end": d(12), "excluded": [], "instant": True}
PROPOSE = {"reason_code": "other_site", "slots": [{"day": d(7), "half": "pm"}]}
V = "/vendor/visits/{v}"
C = "/projects/{p}/visits/{v}"
# (이름, 누가, 경로, 몸통, 나갈 수 있는 상태)
ACTIONS = (
    ("window", "vendor", V + "/window", WINDOW, {"requested"}),
    ("accept", "vendor", V + "/accept", None, {"picked"}),
    ("propose", "vendor", V + "/propose", PROPOSE, {"picked"}),
    (
        "decline",
        "vendor",
        V + "/decline",
        {"code": "full"},
        {"requested", "picked"},
    ),  # picked: 현장 사정
    ("pick", "customer", C + "/pick", SLOT, {"offered"}),
    ("proposal_pick", "customer", C + "/proposal/pick", SLOT, {"proposed"}),
    ("repick", "customer", C + "/repick", None, {"proposed"}),
    ("cancel", "customer", C + "/cancel", {"code": "changed"}, CANCELLABLE),
    ("visited", "customer", C + "/visited", {"result": "visited"}, {"booked"}),
    ("change", "customer", C + "/changes", SLOT, {"booked"}),
    ("requote", "customer", C + "/requote", None, {"quoted"}),
    ("again", "customer", C + "/again", None, {"expired", "cancelled"}),
)


def force(visit: str, st: str) -> None:
    """요청을 그 상태로 바꾼다 (상태별 CHECK 칸을 같이 채운다)"""
    past = day(-1) if st in ("booked", "visited") else None  # 실측 시각 지남
    query(
        "update visits set status = $2, decline_code = $3, expired_reason = $4, cancel_code = $5,"
        " close_reason = $6, booked_day = $7, booked_half = $8, quote_ver = $9,"
        " cancel_note = null, decline_note = null, visited_at = null, requote_at = null"
        " where id = $1",
        uuid.UUID(visit),
        st,
        "full" if st == "declined" else None,
        "reply" if st == "expired" else None,
        "other" if st == "cancelled" else None,
        "reselected" if st == "closed" else None,
        past,
        "am" if past else None,
        1 if st in ("quoted", "chosen") else None,
    )


def test_every_transition_not_in_the_table_is_409(api):
    f = requested(api)
    login(api, f["email"])
    tokens = {"customer": f["token"], "vendor": api.cookies.get(settings.session_cookie)}
    checked = 0
    for st in STATES:
        force(f["visit"], st)
        for name, who, path, body, allowed in ACTIONS:
            if st in allowed:
                continue
            use(api, tokens[who])
            url = path.format(p=f["pid"], v=f["visit"])
            r = api.post(url, json=body) if body is not None else api.post(url)
            assert r.status_code == 409, (st, name, r.status_code, r.text)
            assert status(f["visit"]) == st, (st, name)
            checked += 1
    assert checked == len(STATES) * len(ACTIONS) - sum(len(a[4]) for a in ACTIONS)
    assert query("select count(*) n from visits")[0]["n"] == 1  # 새 요청도 생기지 않았다


def test_allowed_moves_from_each_state(api):
    f = requested(api)
    login(api, f["email"])
    vendor = api.cookies.get(settings.session_cookie)
    use(api, f["token"])
    cancel = C.format(p=f["pid"], v=f["visit"]) + "/cancel"
    for st in sorted(CANCELLABLE):  # 요청함 ~ 실측 받음 → 취소 (C30)
        force(f["visit"], st)
        r = api.post(cancel, json={"code": "changed"})
        assert r.status_code == 200 and status(f["visit"]) == "cancelled", (st, r.text)
    for result, to in (("visited", "visited"), ("no_show", "no_show")):  # 실측 시각 지난 뒤
        force(f["visit"], "booked")
        r = api.post(C.format(p=f["pid"], v=f["visit"]) + "/visited", json={"result": result})
        assert r.status_code == 200 and status(f["visit"]) == to, (result, r.text)
    force(f["visit"], "requested")
    use(api, vendor)
    r = api.post(V.format(v=f["visit"]) + "/decline", json={"code": "out_of_area"})
    assert r.status_code == 200 and status(f["visit"]) == "declined"
    ev = query(
        "select from_status, to_status from visit_events where visit_id = $1 and from_status is not null",
        uuid.UUID(f["visit"]),
    )
    pairs = {(e["from_status"], e["to_status"]) for e in ev}
    assert {(st, "cancelled") for st in CANCELLABLE} <= pairs
    assert {("booked", "visited"), ("booked", "no_show"), ("requested", "declined")} <= pairs
