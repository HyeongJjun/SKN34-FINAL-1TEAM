"""신고 · 관리자 처리 (api.md 13장, A02 · A03 · D26 · C49).

처리 기록(admin_actions)을 남기는 관리자 일은 모두 여기 있다: 신고 처리 · 회원 정지 · 업체 멈춤 · 리뷰 숨김.
업체 멈춤 · 리뷰 숨김의 경로는 vendor · review 쪽과 같다(0단계 vendor/router.py 뼈대 두 개는 B1a가 지워요,
b1b.md 부탁. 이 router가 먼저 등록돼 요청은 여기로 온다).
"""

import uuid
from datetime import datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Path, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import require_role
from app.auth.models import User
from app.db import get_session
from app.report import service
from app.report.schemas import (
    MemberNoteIn,
    MemberPageOut,
    MemberStateOut,
    ReportDetailOut,
    ReportIn,
    ReportKind,
    ReportOut,
    ReportPageOut,
    ResolveIn,
)
from app.review.schemas import ReviewHideIn, ReviewStateOut
from app.shared import ratelimit
from app.vendor.schemas import (
    LinkCheckIn,
    ReviewLinkAdminOut,
    SuspendIn,
    UnsuspendIn,
    VendorSuspendOut,
)

router = APIRouter(tags=["신고 · 관리자"])
people = require_role("customer", "vendor")
admin_only = require_role("admin")


@router.post(
    "/reports",
    status_code=201,
    response_model=ReportOut,
    summary="신고 (채팅 · 업체 · 링크, 내 대화 · 볼 수 있는 업체 · 보이는 링크만, 같은 글은 처리 전 한 번)",
)
async def report(
    data: ReportIn, user: User = Depends(people), s: AsyncSession = Depends(get_session)
) -> ReportOut:
    await ratelimit.check("report", str(user.id))
    return await service.create(s, user, data)


@router.get(
    "/admin/reports",
    response_model=ReportPageOut,
    summary="관리자 신고 목록 (처리 기다림 · 처리함 · 종류)",
)
async def admin_reports(
    status: Literal["open", "done"] = "open",
    kind: ReportKind | None = None,
    _: User = Depends(admin_only),
    s: AsyncSession = Depends(get_session),
) -> ReportPageOut:
    return await service.page(s, status, kind)


@router.get(
    "/admin/reports/{report_id}",
    response_model=ReportDetailOut,
    summary="관리자 신고 자세히 (신고된 글은 데이터로만, 신고한 사람은 이름 없이)",
)
async def admin_report(
    report_id: uuid.UUID, _: User = Depends(admin_only), s: AsyncSession = Depends(get_session)
) -> ReportDetailOut:
    return await service.detail(s, report_id)


@router.post(
    "/admin/reports/{report_id}/resolve",
    response_model=ReportDetailOut,
    summary="관리자 신고 처리 (경고 · 쓰기 막기 · 업체 멈춤 · 링크 숨김 · 문제없음, 두 번째 409 already)",
)
async def resolve(
    report_id: uuid.UUID,
    data: ResolveIn,
    admin: User = Depends(admin_only),
    s: AsyncSession = Depends(get_session),
) -> ReportDetailOut:
    return await service.resolve(s, admin, report_id, data)


@router.get(
    "/admin/members",
    response_model=MemberPageOut,
    summary="관리자 회원 목록 (고객 · 업체, 이름 · 이메일로 찾기 · 상태 · 가입 최근 순 50명씩)",
)
async def members(
    q: Annotated[str | None, Query(max_length=100)] = None,
    status: Literal["active", "suspended"] | None = None,
    before: datetime | None = None,
    _: User = Depends(admin_only),
    s: AsyncSession = Depends(get_session),
) -> MemberPageOut:
    return await service.members(s, q=q, status=status, before=before)


@router.post(
    "/admin/members/{user_id}/suspend",
    response_model=MemberStateOut,
    summary="관리자 회원 정지 (세션 지움, 관리자 계정 403, 이미면 409 already)",
)
async def suspend_member(
    user_id: uuid.UUID,
    data: MemberNoteIn,
    admin: User = Depends(admin_only),
    s: AsyncSession = Depends(get_session),
) -> MemberStateOut:
    return await service.set_member(s, admin, user_id, "suspended", data.note)


@router.post(
    "/admin/members/{user_id}/unsuspend",
    response_model=MemberStateOut,
    summary="관리자 회원 정지 풀기 (이미면 409 already)",
)
async def unsuspend_member(
    user_id: uuid.UUID,
    data: MemberNoteIn,
    admin: User = Depends(admin_only),
    s: AsyncSession = Depends(get_session),
) -> MemberStateOut:
    return await service.set_member(s, admin, user_id, "active", data.note)


@router.post(
    "/admin/vendors/{vendor_id}/suspend",
    response_model=VendorSuspendOut,
    summary="관리자: 업체 기능 멈추기 (new 새 요청만 · all 진행 중 대화도 닫기, admin_actions)",
)
async def admin_suspend_vendor(
    vendor_id: uuid.UUID,
    data: SuspendIn,
    admin: User = Depends(admin_only),
    s: AsyncSession = Depends(get_session),
) -> VendorSuspendOut:
    return await service.suspend_vendor(s, admin, vendor_id, data.scope, data.note)


@router.post(
    "/admin/vendors/{vendor_id}/unsuspend",
    response_model=VendorSuspendOut,
    summary="관리자: 업체 기능 멈춤 풀기 (멈춤으로 닫은 대화는 다시 열림)",
)
async def admin_unsuspend_vendor(
    vendor_id: uuid.UUID,
    data: UnsuspendIn,
    admin: User = Depends(admin_only),
    s: AsyncSession = Depends(get_session),
) -> VendorSuspendOut:
    return await service.unsuspend_vendor(s, admin, vendor_id, data.note or None)


@router.post(
    "/admin/vendors/{vendor_id}/links/{sort}",
    response_model=ReviewLinkAdminOut,
    summary="관리자: 외부 리뷰 링크 보여요 · 숨김 (본 주소 보호, admin_actions 기록 · 업체 알림)",
)
async def admin_check_link(
    vendor_id: uuid.UUID,
    sort: Annotated[int, Path(ge=0, le=2)],
    data: LinkCheckIn,
    admin: User = Depends(admin_only),
    s: AsyncSession = Depends(get_session),
) -> ReviewLinkAdminOut:
    return await service.check_link(s, admin, vendor_id, sort, data)


@router.post(
    "/admin/reviews/{review_id}/hide",
    response_model=ReviewStateOut,
    summary="관리자: 리뷰 숨김 (공개한 기준 코드만, admin_actions 기록)",
)
async def hide_review(
    review_id: uuid.UUID,
    data: ReviewHideIn,
    admin: User = Depends(admin_only),
    s: AsyncSession = Depends(get_session),
) -> ReviewStateOut:
    return await service.set_review(s, admin, review_id, data.code, data.note or None)


@router.post(
    "/admin/reviews/{review_id}/show",
    response_model=ReviewStateOut,
    summary="관리자: 숨긴 리뷰 다시 보이기",
)
async def show_review(
    review_id: uuid.UUID, admin: User = Depends(admin_only), s: AsyncSession = Depends(get_session)
) -> ReviewStateOut:
    return await service.set_review(s, admin, review_id, None, None)
