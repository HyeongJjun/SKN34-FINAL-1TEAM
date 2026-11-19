"""schedule 기한 일 처리 함수 (deal_dates_due · deal_request_due · deal_done_remind · deal_auto_done · thread_redact).

worker.JOB_HANDLERS가 이 HANDLERS를 모은다. 계약은 jobs.service.JobHandler:
새 세션에서 '아직 그 상태 · 기한이 지났을 때만' 바꾼다 → 바꿨으면 Outcome(changed=True, 신호), 아니면 False.
commit · 화면 신호는 worker.sweep이 한다. 두 번 돌아도 결과 · 알림은 한 번이다(조건부 UPDATE · dedup_key).
잠금 순서는 service와 같다: 프로젝트 → 확정 행(알림 insert의 project_id FK도 프로젝트 행을 잡는다).
"""

import uuid
from datetime import UTC, date, datetime

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.calc import deadline
from app.jobs import service as jobs
from app.jobs.models import Job
from app.jobs.service import JobHandler, Outcome, StatePush
from app.notify import catalog
from app.notify import service as notify_service
from app.project import service as project_service
from app.project.models import Project
from app.schedule.models import DateProposal, DateRequest, Deal, DealEvent
from app.shared.clock import SEOUL
from app.shared.ids import uuid7
from app.shared.korean import i_ga
from app.thread import service as thread_service

LABEL = {"mokgong": "목공", "dobae": "도배"}
WEEKDAY = "월화수목금토일"


def _md(d: date) -> str:
    return f"{d.month}.{d.day}({WEEKDAY[d.weekday()]})"


def _stamp(at: datetime) -> str:
    """알림 dedup_key에 넣는 시각 (UTC 분)"""
    return f"{at.astimezone(UTC):%Y%m%d%H%M}"


async def _owner(s: AsyncSession, project_id: uuid.UUID) -> uuid.UUID:
    return (await project_service.briefs(s, [project_id]))[project_id].owner_id


async def _work(s: AsyncSession, d: Deal) -> str:
    """업체 알림 끝에 붙일 공사 이름 '노원구 상계동 도배' (구 · 동만 읽는다, catalog.work_name)"""
    q = select(Project.sgg, Project.emd).where(Project.id == d.project_id)
    row = (await s.execute(q)).first()
    return catalog.work_name(row.sgg if row else None, row.emd if row else None, d.trade)


def _signal(d: Deal, owner: uuid.UUID, unread: list[uuid.UUID | None]) -> Outcome:
    return Outcome(
        changed=True,
        states=[StatePush((owner, d.vendor_id), "deal", d.id, d.project_id)],
        unread=unread,
    )


async def _both(
    s: AsyncSession,
    d: Deal,
    owner: uuid.UUID,
    *,
    kind: str,
    key: str,
    to_customer: str,
    to_vendor: str,
    customer_link: str,
) -> bool:
    """양쪽 알림. 돌려주는 값: 하나라도 새로 썼는지 (모두 이미 있으면 두 번째 실행)."""
    wrote = await notify_service.add(
        s,
        user_id=owner,
        kind=kind,
        body=to_customer,
        link=customer_link,
        dedup_key=key,
        project_id=d.project_id,
    )
    if d.vendor_id is not None:
        wrote = (
            await notify_service.add(
                s,
                user_id=d.vendor_id,
                kind=kind,
                body=to_vendor,
                link=f"/vendor/jobs/{d.id}",
                dedup_key=key,
            )
            or wrote
        )
    return wrote


async def _deal(s: AsyncSession, deal_id: uuid.UUID | None) -> Deal | None:
    if deal_id is None:
        return None
    return await s.get(Deal, deal_id, populate_existing=True)


async def on_dates_due(s: AsyncSession, job: Job, now: datetime) -> Outcome | bool:
    """확정 + 2일 18:00: 업체가 아직 공사 날짜를 안 냈으면 양쪽 알림 (지난 뒤 처리는 D12 보류)."""
    d = await _deal(s, job.ref_id)
    if d is None or d.status != "confirmed" or not deadline.is_over(now, d.dates_due_at):
        return False
    sent = select(DateProposal.id).where(
        DateProposal.deal_id == d.id, DateProposal.status == "pending"
    )
    if (await s.execute(sent.limit(1))).first() is not None:
        return False
    owner = await _owner(s, d.project_id)
    wrote = await _both(
        s,
        d,
        owner,
        kind="dates_due",
        key=f"dates_due:{d.id}",
        to_customer=f"{i_ga(d.vendor_name)} 아직 공사 날짜를 내지 않았어요 · {LABEL[d.trade]}",
        to_vendor=f"공사 날짜를 낼 기한이 지났어요 · 날짜를 올려 주세요 · {await _work(s, d)}",
        customer_link=catalog.link("dates_due", pid=d.project_id),
    )
    return _signal(d, owner, [owner, d.vendor_id]) if wrote else False


async def on_request_due(s: AsyncSession, job: Job, now: datetime) -> Outcome | bool:
    """다른 날짜 요청 + 48시간: 업체가 새 날짜를 안 냈으면(요청이 아직 열림) 양쪽 알림."""
    if job.ref_id is None:
        return False
    r = await s.get(DateRequest, job.ref_id, populate_existing=True)
    if r is None or r.status != "open" or not deadline.is_over(now, r.due_at):
        return False
    d = await _deal(s, r.deal_id)
    if d is None or d.status == "reselected":
        return False
    owner = await _owner(s, d.project_id)
    wrote = await _both(
        s,
        d,
        owner,
        kind="request_due",
        key=f"request_due:{r.id}",
        to_customer=f"다른 날짜 요청에 {i_ga(d.vendor_name)} 아직 답하지 않았어요",
        to_vendor=f"고객이 요청한 다른 날짜에 답할 기한이 지났어요 · {await _work(s, d)}",
        customer_link=catalog.link("request_due", pid=d.project_id),
    )
    return _signal(d, owner, [owner, d.vendor_id]) if wrote else False


async def on_done_remind(s: AsyncSession, job: Job, now: datetime) -> Outcome | bool:
    """'공사 끝냈어요' + 4일: 아직 고객 확인 전이면 '자동으로 끝나요' 알림 (D24). 올린 때마다 한 번."""
    d = await _deal(s, job.ref_id)
    if d is None or d.status != "checking" or d.done_posted_at is None:
        return False
    if not deadline.is_over(now, deadline.done_remind_at(d.done_posted_at)):
        return False
    auto = deadline.auto_done_at(d.done_posted_at).astimezone(SEOUL).date()
    owner = await _owner(s, d.project_id)
    wrote = await notify_service.add(
        s,
        user_id=owner,
        kind="done_remind",
        body=f"{_md(auto)}에 공사가 자동으로 끝나요 · 공사 끝을 확인해 주세요",
        link=catalog.link("done_remind", pid=d.project_id),
        dedup_key=f"done_remind:{d.id}:{_stamp(d.done_posted_at)}",
        project_id=d.project_id,
    )
    return _signal(d, owner, [owner]) if wrote else False


async def on_auto_done(s: AsyncSession, job: Job, now: datetime) -> Outcome | bool:
    """'공사 끝냈어요' + 7일: 아직 고객 확인 전(checking)이면 끝(done, code auto_done) · 리뷰 쓰기 열림."""
    d = await _deal(s, job.ref_id)
    if d is None or d.status != "checking" or d.done_posted_at is None:
        return False
    posted = d.done_posted_at
    if not deadline.is_over(now, deadline.auto_done_at(posted)):
        return False
    await project_service.lock(s, d.project_id)  # 잠금 순서: 프로젝트 → 확정 (고객 확인과 줄 선다)
    res = await s.execute(
        update(Deal)
        .where(Deal.id == d.id, Deal.status == "checking", Deal.done_posted_at == posted)
        .values(status="done")
        .execution_options(synchronize_session=False)
    )
    if res.rowcount != 1:  # 그사이 고객이 확인했거나 업체가 다시 올렸다
        return False
    s.add(
        DealEvent(
            id=uuid7(),
            deal_id=d.id,
            from_status="checking",
            to_status="done",
            by_id=None,
            code="auto_done",
            at=now,
        )
    )
    await jobs.cancel_refs(s, now=now, ref_ids=[d.id], kinds=["deal_done_remind"])
    owner = await _owner(s, d.project_id)
    await notify_service.add(
        s,
        user_id=owner,
        kind="auto_done",
        body=f"공사가 끝났어요 · {d.vendor_name} 리뷰를 남겨 주세요",
        link=catalog.link("auto_done", pid=d.project_id),
        dedup_key=f"auto_done:{d.id}",
        project_id=d.project_id,
    )
    if d.vendor_id is not None:
        await notify_service.add(
            s,
            user_id=d.vendor_id,
            kind="auto_done",
            body=f"고객 확인 없이 7일이 지나 공사가 끝났어요 · {await _work(s, d)}",
            link=f"/vendor/jobs/{d.id}",
            dedup_key=f"auto_done:{d.id}",
        )
    return _signal(d, owner, [owner, d.vendor_id])


async def on_thread_redact(s: AsyncSession, job: Job, now: datetime) -> Outcome | bool:
    """닫힌 대화 + 보관 기간: 글 본문 가리기는 thread(B1b)가 한다. 가리기 함수
    `thread.service.redact(s, thread_id, *, now) -> bool`이 생기기 전이면 아무것도 하지 않는다
    (L07: 보관 기간이 None이라 지금은 이 일을 넣는 곳도 없다)."""
    redact = getattr(thread_service, "redact", None)
    if redact is None or job.ref_id is None:
        return False
    return bool(await redact(s, job.ref_id, now=now))


HANDLERS: dict[str, JobHandler] = {
    "deal_dates_due": on_dates_due,
    "deal_request_due": on_request_due,
    "deal_done_remind": on_done_remind,
    "deal_auto_done": on_auto_done,
    "thread_redact": on_thread_redact,
}
