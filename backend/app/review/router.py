"""리뷰 · 답글 (api.md 12장, dev-07). 관리자 숨김 · 다시 보이기는 처리 기록(admin_actions)과 함께
report/router.py에 있다(경로 · 모양은 그대로)."""

import uuid
from datetime import datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import require_role
from app.auth.models import User
from app.db import get_session
from app.files import service as files_service
from app.review import service
from app.review.schemas import (
    ReplyIn,
    ReplyOut,
    ReviewEditIn,
    ReviewItemOut,
    ReviewPageOut,
    ReviewWriteIn,
    VendorReviewsOut,
)
from app.shared import ratelimit
from app.vendor.deps import approved_vendor

router = APIRouter(tags=["리뷰"])
customer_only = require_role("customer")
anyone = require_role("customer", "vendor", "admin")


@router.get(
    "/projects/{project_id}/vendors/{vendor_id}/reviews",
    response_model=ReviewPageOut,
    summary="업체 리뷰 전체 (최신순 · 낮은 별점부터, 숨긴 리뷰 빠짐, 최신순만 before 커서)",
)
async def vendor_reviews_for_customer(
    project_id: uuid.UUID,
    vendor_id: uuid.UUID,
    sort: Literal["latest", "low"] = "latest",
    before: datetime | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    user: User = Depends(customer_only),
    s: AsyncSession = Depends(get_session),
) -> ReviewPageOut:
    return await service.for_customer(
        s, user, project_id, vendor_id, sort=sort, before=before, limit=limit
    )


@router.post(
    "/projects/{project_id}/deals/{deal_id}/review",
    status_code=201,
    response_model=ReviewItemOut,
    summary="리뷰 쓰기 (끝난 공사의 고객만, 끝나지 않았으면 403 · 두 번째 409 already)",
)
async def write_review(
    project_id: uuid.UUID,
    deal_id: uuid.UUID,
    data: ReviewWriteIn,
    user: User = Depends(customer_only),
    s: AsyncSession = Depends(get_session),
) -> ReviewItemOut:
    await ratelimit.check("review", str(user.id))
    return await service.write(s, user, project_id, deal_id, data)


@router.patch(
    "/reviews/{review_id}", response_model=ReviewItemOut, summary="내 리뷰 고치기 ('수정됨')"
)
async def edit_review(
    review_id: uuid.UUID,
    data: ReviewEditIn,
    user: User = Depends(customer_only),
    s: AsyncSession = Depends(get_session),
) -> ReviewItemOut:
    return await service.edit(s, user, review_id, data)


@router.delete("/reviews/{review_id}", status_code=204, summary="내 리뷰 지우기")
async def delete_review(
    review_id: uuid.UUID,
    user: User = Depends(customer_only),
    s: AsyncSession = Depends(get_session),
) -> Response:
    await service.remove(s, user, review_id)
    return Response(status_code=204)


@router.get(
    "/reviews/{review_id}/photos/{file_id}",
    summary="리뷰 사진 (보이는 리뷰는 로그인한 고객, 숨긴 리뷰는 쓴 사람 · 그 업체 · 관리자만)",
)
async def review_photo(
    review_id: uuid.UUID,
    file_id: uuid.UUID,
    user: User = Depends(anyone),
    s: AsyncSession = Depends(get_session),
) -> Response:
    f = await service.photo_for(s, user, review_id, file_id)
    return await files_service.respond(f)


@router.get(
    "/vendor/reviews", response_model=VendorReviewsOut, summary="업체 리뷰 · 답글 기다림 수 (V24)"
)
async def my_reviews(
    filter: Literal["waiting", "all"] = "all",
    vendor: User = Depends(approved_vendor),
    s: AsyncSession = Depends(get_session),
) -> VendorReviewsOut:
    return await service.for_vendor(s, vendor, waiting_only=filter == "waiting")


@router.put(
    "/vendor/reviews/{review_id}/reply",
    response_model=ReplyOut,
    summary="답글 달기 · 고치기 (리뷰마다 하나, 처음이면 201 · 고객 알림)",
    responses={201: {"model": ReplyOut, "description": "처음 단 답글"}},
)
async def reply(
    review_id: uuid.UUID,
    data: ReplyIn,
    response: Response,
    vendor: User = Depends(approved_vendor),
    s: AsyncSession = Depends(get_session),
) -> ReplyOut:
    out, created = await service.reply(s, vendor, review_id, data)
    response.status_code = 201 if created else 200
    return out
