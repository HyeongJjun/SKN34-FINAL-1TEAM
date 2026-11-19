"""업체 작업함 v3 줄 (V03 · V08 · D04, N4 C) · 고객 쪽 업체별 '다음 할 일'(C42 · C43).

- visit 상태 · 기한은 visit models를 읽기 조인으로 읽어 계산 엔진(calc.deadline)으로 센다. 화면의
  '지남'은 worker가 늦어도 맞다. 요청 한 건은 탭 하나에만 들어가고, 요약 수는 탭 줄 수와 같다.
- 업체에 가는 정보: 구 · 동 · 면적 · 집 상태 · 범위 · 벽지 · 예산 · 희망 기간(D03 B · D04 A).
  고객 이름 · 휴대폰 · 동 · 호는 넣지 않는다(architecture 10장). 집 정보도 그 칸만 읽는다.
- 상태를 바꾸지 않는다(읽기만). 탭 · 정렬 · 요약은 schedule.service가 이 줄로 만든다.
"""

import uuid
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Any

from sqlalchemy import and_, exists, func, not_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.calc import deadline, visit_view
from app.calc.schedule import days_since
from app.project.models import Project, ProjectTrade
from app.quote import service as quote_service
from app.quote.models import StandardQuote
from app.shared.regions import region_label
from app.visit.models import (
    ENDED,
    LIVE,
    Visit,
    VisitChange,
    VisitEvent,
    VisitHold,
    VisitProposal,
    VisitWindow,
)
from app.visit.schemas import StateTagOut, VendorNextOut, VisitNextOut

LATE_KEEP_DAYS = 7  # 답 기한이 지난 요청을 '할 일'에 '! 답 기한 지남'으로 두는 날 (그 뒤에는 끝남)
TRADE = {"dobae": "도배", "mokgong": "목공"}
SCOPE = {"full": "전체", "partial": "부분"}
HOUSE = {"apt": "아파트"}
HALF = {"am": "오전", "pm": "오후"}
WEEKDAY = "월화수목금토일"
# 작업함에 보이는 요청 (확정한 요청은 '공사' 탭에서 업체 확정 줄로 보인다)
OPEN_VISITS = tuple(st for st in LIVE if st != "chosen")
DONE_LABEL = {
    "declined": "못 받음",
    "cancelled": "고객이 취소",
    "no_show": "실측 안 옴",
}
EXPIRED_LABEL = {"reply": "답 기한 지남", "pick": "고객이 날짜를 고르지 않음"}
CLOSED_LABEL = {
    "other_chosen": "다른 업체로 정함",
    "reselected": "다시 고르기로 닫힘",
    "vendor_stopped": "업체 기능 멈춤으로 닫힘",
}


@dataclass
class Facts:
    """줄 하나를 만드는 데 필요한 것 (모두 읽기). p는 업체에 가도 되는 집 칸만 담은 행이다."""

    v: Visit
    p: Any
    scope: str | None
    std: StandardQuote | None
    window: VisitWindow | None
    hold: VisitHold | None
    proposal: VisitProposal | None  # 열린 다른 날 제안 (바꾸기 요청에 낸 다른 날 포함)
    change: VisitChange | None  # 열린 바꾸기 요청 (open · countered)
    last_at: datetime | None  # 마지막으로 상태가 바뀐 때
    newer: bool  # 같은 집 · 공종 · 업체에 더 늦은 시도가 있음


def _newer_attempt():
    later = aliased(Visit)
    return exists().where(
        later.project_id == Visit.project_id,
        later.trade == Visit.trade,
        later.vendor_id == Visit.vendor_id,
        later.attempt > Visit.attempt,
    )


def late_cond(now: datetime):
    """'할 일'에 남기는 답 기한 지남: 업체 첫 답 기한이 LATE_KEEP_DAYS 안에 지났고 다시 요청이 없음"""
    return and_(
        Visit.status == "expired",
        Visit.expired_reason == "reply",
        Visit.reply_due_at > now - timedelta(days=LATE_KEEP_DAYS),
        not_(_newer_attempt()),
    )


def done_cond(now: datetime):
    """'끝남' 탭 요청: 지난 상태 중 '할 일'에 남긴 답 기한 지남은 뺀다"""
    return and_(Visit.status.in_(ENDED), not_(late_cond(now)))


def board_cond(now: datetime):
    """'할 일' · '기다림' · '일정' 탭 후보: 살아 있는 요청(확정 빼고) + 할 일에 남긴 답 기한 지남"""
    return or_(Visit.status.in_(OPEN_VISITS), late_cond(now))


async def _all(s: AsyncSession, q) -> list:
    return list((await s.execute(q)).scalars())


async def facts(s: AsyncSession, visits: Iterable[Visit]) -> dict[uuid.UUID, Facts]:
    """요청마다 줄 재료를 한 번에 읽는다 (요청 수와 상관없이 쿼리 수가 일정하다)."""
    rows = list(visits)
    if not rows:
        return {}
    vids = [v.id for v in rows]
    pids = list({v.project_id for v in rows})
    homes = {
        p.id: p
        for p in (
            await s.execute(
                select(
                    Project.id,
                    Project.code,
                    Project.sido,
                    Project.sgg,
                    Project.emd,
                    Project.area_m2,
                    Project.area_basis,
                    Project.occupied,
                    Project.budget_won,
                    Project.house_type,
                ).where(Project.id.in_(pids))
            )
        ).all()
    }
    scopes = {
        (t.project_id, t.trade): t.scope
        for t in await _all(s, select(ProjectTrade).where(ProjectTrade.project_id.in_(pids)))
    }
    stds = await quote_service.latest_of(s, pids)
    windows = {
        w.visit_id: w
        for w in await _all(s, select(VisitWindow).where(VisitWindow.visit_id.in_(vids)))
    }
    holds = {
        h.visit_id: h
        for h in await _all(
            s, select(VisitHold).where(VisitHold.visit_id.in_(vids), VisitHold.status == "active")
        )
    }
    proposals = {
        x.visit_id: x
        for x in await _all(
            s,
            select(VisitProposal).where(
                VisitProposal.visit_id.in_(vids), VisitProposal.status == "open"
            ),
        )
    }
    changes = {
        c.visit_id: c
        for c in await _all(
            s,
            select(VisitChange).where(
                VisitChange.visit_id.in_(vids), VisitChange.status.in_(("open", "countered"))
            ),
        )
    }
    last = dict(
        (
            await s.execute(
                select(VisitEvent.visit_id, func.max(VisitEvent.at))
                .where(VisitEvent.visit_id.in_(vids))
                .group_by(VisitEvent.visit_id)
            )
        ).all()
    )
    attempts = await s.execute(
        select(Visit.project_id, Visit.trade, Visit.vendor_id, func.max(Visit.attempt))
        .where(Visit.project_id.in_(pids))
        .group_by(Visit.project_id, Visit.trade, Visit.vendor_id)
    )
    top = {(p, t, vid): n for p, t, vid, n in attempts.all()}
    return {
        v.id: Facts(
            v=v,
            p=homes[v.project_id],
            scope=scopes.get((v.project_id, v.trade)),
            std=stds.get((v.project_id, v.trade)),
            window=windows.get(v.id),
            hold=holds.get(v.id),
            proposal=proposals.get(v.id),
            change=changes.get(v.id),
            last_at=last.get(v.id),
            newer=top.get((v.project_id, v.trade, v.vendor_id), v.attempt) > v.attempt,
        )
        for v in rows
    }


# ---- 글 (해요체 · 영어 상태값 없음) ----


def _md(d: date) -> str:
    return f"{d.month}.{d.day}({WEEKDAY[d.weekday()]})"


def area_label(f: Facts) -> str:
    """노원구 상계동 · 공급 69.4㎡ (calc.visit_view.area_label, 동이 없는 옛 공사는 구까지).
    면적 · 기준은 집 정보, 없으면(평형만 고른 옛 공사) 표준견적서 값."""
    if f.p.area_m2 is not None:
        m2, basis = f.p.area_m2, f.p.area_basis
    elif f.std is not None:
        m2, basis = f.std.area_m2, f.std.area_basis
    else:
        m2, basis = None, None
    return visit_view.area_label(f.p.sgg, f.p.emd, m2, basis)


def home_label(f: Facts) -> str:
    """아파트 · 도배 전체 · 빈 집"""
    work = TRADE[f.v.trade]
    if f.v.trade == "dobae":
        work = f"{work} {SCOPE.get(f.scope or 'full', '전체')}"
    parts = [HOUSE.get(f.p.house_type, ""), work, "사는 중" if f.p.occupied else "빈 집"]
    return " · ".join(x for x in parts if x)


def _slot(v: Visit) -> str:
    return f"{_md(v.booked_day)} {HALF[v.booked_half]}" if v.booked_day and v.booked_half else ""


def _visit_over(v: Visit, now: datetime) -> bool:
    """확정한 반나절이 끝났는지 (L09: 오전 13:00 · 오후 18:00)"""
    return bool(v.booked_day and v.booked_half) and deadline.visited_ok(
        now, v.booked_day, v.booked_half
    )


# ---- 고객 쪽: 다음 할 일과 기한 (C14 · C42 · C43) ----


def _customer_step(f: Facts, now: datetime) -> tuple[str, str, datetime | None]:
    v = f.v
    if v.status == "requested":
        return "reply", "vendor", v.reply_due_at
    if v.status == "offered":
        return "pick", "customer", f.window.pick_due_at if f.window else None
    if v.status == "picked":
        return "accept", "vendor", f.hold.until if f.hold else None
    if v.status == "proposed":
        return "proposal", "customer", f.proposal.due_at if f.proposal else None
    if v.status == "booked" and f.change is not None:
        if f.change.status == "countered":  # 업체가 다른 날을 냈다: 고객이 고를 차례
            return "change", "customer", f.proposal.due_at if f.proposal else f.change.due_at
        return "change", "vendor", f.change.due_at
    if v.status == "booked" and not _visit_over(v, now):
        return "visit", "vendor", None
    if v.status in ("booked", "visited"):
        return "quote", "vendor", v.quote_due_at
    if v.status == "quoted":
        return "confirm", "customer", None
    return "none", "none", None


def customer_next(f: Facts, now: datetime) -> VisitNextOut:
    kind, who, due = _customer_step(f, now)
    return VisitNextOut(
        kind=kind,
        who=who,
        due_at=due,
        overdue=deadline.is_over(now, due),
        soon=deadline.is_soon(now, due),
    )


# ---- 업체 쪽: 탭 · 상태 아이콘 + 글자 · 다음 일 (V03 · D04) ----


def _todo(label: str, nxt: str, due: datetime | None, now: datetime):
    """업체가 할 일: 기한이 지났으면 아이콘이 '! 기한 지남'이 된다"""
    over = deadline.is_over(now, due)
    return (
        StateTagOut(icon="late" if over else "todo", label=label),
        VendorNextOut(label=nxt, due_at=due, overdue=over),
    )


def _wait(label: str, nxt: str):
    return StateTagOut(icon="wait", label=label), VendorNextOut(
        label=nxt, due_at=None, overdue=False
    )


def vendor_view(f: Facts, now: datetime) -> tuple[str, StateTagOut, VendorNextOut]:
    """(탭, 상태, 다음 일). 탭은 todo · waiting · sched · jobs(확정) · done 중 하나."""
    v = f.v
    if v.status == "requested":
        over = deadline.is_over(now, v.reply_due_at)
        state, nxt = _todo(
            "답 기한 지남" if over else "새 실측 요청", "기간 답하기", v.reply_due_at, now
        )
        return "todo", state, nxt
    if v.status == "picked":
        return "todo", *_todo("날짜 수락", "날짜 수락", f.hold.until if f.hold else None, now)
    if v.status == "booked" and f.change is not None:
        if f.change.status == "open":
            return "todo", *_todo("일정 바꾸기 요청", "일정 바꾸기 답하기", f.change.due_at, now)
        return "waiting", *_wait("고객 차례", "고객 답 기다림")
    if v.status == "booked" and not _visit_over(v, now):
        state = StateTagOut(icon="ok", label="실측 확정")
        return "sched", state, VendorNextOut(label=f"{_slot(v)} 실측", due_at=None, overdue=False)
    if v.status in ("booked", "visited"):
        return "todo", *_todo("견적서 보내기", "견적서 보내기", v.quote_due_at, now)
    if v.status in ("offered", "proposed"):
        return "waiting", *_wait("고객 차례", "고객 답 기다림")
    if v.status == "quoted":
        return "waiting", *_wait("견적서 보냄", "고객 확정 기다림")
    if v.status == "chosen":
        state = StateTagOut(icon="ok", label="공사 확정")
        return "jobs", state, VendorNextOut(label="공사 한 건 보기", due_at=None, overdue=False)
    if is_late(f, now):
        state = StateTagOut(icon="late", label="답 기한 지남")
        return (
            "todo",
            state,
            VendorNextOut(label="재요청 오면 답하기", due_at=v.reply_due_at, overdue=True),
        )
    return (
        "done",
        StateTagOut(icon="done", label=done_label(v)),
        VendorNextOut(label="끝난 요청", due_at=None, overdue=False),
    )


def is_late(f: Facts, now: datetime) -> bool:
    """late_cond와 같은 판정 (파이썬 쪽)"""
    v = f.v
    return (
        v.status == "expired"
        and v.expired_reason == "reply"
        and v.reply_due_at is not None
        and v.reply_due_at > now - timedelta(days=LATE_KEEP_DAYS)
        and not f.newer
    )


def done_label(v: Visit) -> str:
    if v.status == "expired":
        return EXPIRED_LABEL.get(v.expired_reason or "", "기한 지남")
    if v.status == "closed":
        return CLOSED_LABEL.get(v.close_reason or "", "닫힘")
    return DONE_LABEL.get(v.status, "끝남")


def row(f: Facts, now: datetime, today: date) -> dict:
    """작업함 줄 칸 (InboxRowOut). 고객 이름 · 휴대폰 · 주소 · 동 · 호 칸은 없다(B3)."""
    v = f.v
    _, state, nxt = vendor_view(f, now)
    return {
        "id": v.id,
        "received_at": v.created_at,
        "code": f.p.code,
        "trade": v.trade,
        "grade": v.grade or (f.std.grade if f.std is not None else None),  # v3: 요청 때 고른 벽지
        "region": region_label(f.p.sido, f.p.sgg),
        "area_name": f.p.sgg,
        "pyeong": f.std.pyeong if f.std is not None else None,
        "status": v.status,
        "new": v.status == "requested" and v.vendor_seen_at is None,
        "share_contact": v.share_contact,
        "closed_at": f.last_at if v.status in ENDED else None,
        "decline_code": v.decline_code,
        "close_reason": v.close_reason,
        "waiting_days": days_since(f.last_at, today)
        if v.status == "quoted" and f.last_at
        else None,
        "area_label": area_label(f),
        "home": home_label(f),
        "wish_start": v.wish_start,
        "wish_end": v.wish_end,
        "work_wish_on": v.work_wish_on,
        "estimate_total": v.estimate_total,
        "budget_won": f.p.budget_won,
        "state": state,
        "next": nxt,
        "attempt": v.attempt,
    }
