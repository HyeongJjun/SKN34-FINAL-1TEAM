import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import current_user
from app.auth.models import User
from app.calc.plan_qty import SpaceKind
from app.db import get_session
from app.shared.clock import today_seoul
from app.v2 import preview_service, service
from app.v2 import schemas as v2
from app.v2.preview_schemas import (
    V2MaterialsOut,
    V2PlanBriefOut,
    V2PlanQtyOut,
    V2PreviewIn,
    V2PreviewOut,
)

router = APIRouter(prefix="/v2", tags=["v2"])


@router.get("/floor-plans", response_model=list[V2PlanBriefOut], summary="예시 평면도 목록")
async def plans(_: User = Depends(current_user)) -> list[V2PlanBriefOut]:
    return preview_service.list_plans()


@router.get("/floor-plans/{plan_id}/qty", response_model=V2PlanQtyOut, summary="평면도 수량")
async def plan_qty(
    plan_id: str,
    expanded: bool = True,
    kinds: list[SpaceKind] | None = Query(default=None, max_length=9),
    ceiling: bool = True,
    _: User = Depends(current_user),
) -> V2PlanQtyOut:
    return preview_service.plan_qty(plan_id, expanded, kinds, ceiling)


@router.get("/materials", response_model=V2MaterialsOut, summary="목공 자재 · 정해진 단가 항목")
async def materials(_: User = Depends(current_user)) -> V2MaterialsOut:
    return preview_service.materials()


@router.post(
    "/projects/{project_id}/preview",
    response_model=V2PreviewOut,
    summary="견적 미리 보기 (도면 · 목공 자재 · 시장 범위, 저장하지 않음)",
)
async def preview(
    project_id: uuid.UUID,
    body: V2PreviewIn,
    user: User = Depends(current_user),
    s: AsyncSession = Depends(get_session),
) -> V2PreviewOut:
    return await preview_service.preview(s, user, project_id, body)


# ---- v2 화면 (v10 이식). 저장하지 않고 계산만 한다 ----
@router.post("/quote", response_model=v2.V2QuoteOut, summary="v2 표준견적서")
async def v2_quote(body: v2.V2QuoteIn, _: User = Depends(current_user)) -> v2.V2QuoteOut:
    return service.quote(body, today_seoul())


@router.get(
    "/market-extras",
    response_model=list[v2.V2MarketExtraOut],
    summary="v2 받은 견적 맞춰 보기 목공 추가 항목",
)
async def v2_market_extras(_: User = Depends(current_user)) -> list[v2.V2MarketExtraOut]:
    return service.market_extras()


@router.post("/plan", response_model=v2.V2PlanOut, summary="v2 예상 공정표")
async def v2_plan(body: v2.V2PlanIn, _: User = Depends(current_user)) -> v2.V2PlanOut:
    return service.plan(body, today_seoul())


@router.post("/check", response_model=v2.V2CheckOut, summary="v2 받은 견적 맞춰 보기")
async def v2_check(body: v2.V2CheckIn, _: User = Depends(current_user)) -> v2.V2CheckOut:
    return service.check(body, today_seoul())


@router.post("/estimate", response_model=v2.V2EstimateOut, summary="v2 업체 가견적")
async def v2_estimate(body: v2.V2EstimateIn, _: User = Depends(current_user)) -> v2.V2EstimateOut:
    return service.estimate(body)


@router.post("/entered", response_model=v2.V2EnteredOut, summary="v2 실측 견적서 금액")
async def v2_entered(body: v2.V2EnteredIn, _: User = Depends(current_user)) -> v2.V2EnteredOut:
    return service.entered(body)


@router.post(
    "/calc7",
    response_model=v2.V2WallOut | v2.V2TrimOut | v2.V2PaintOut,
    summary="v2 셀프 계산기",
)
async def v2_calc7(
    body: v2.V2Calc7In, _: User = Depends(current_user)
) -> v2.V2WallOut | v2.V2TrimOut | v2.V2PaintOut:
    return service.calc7(body)


@router.post("/extras-range", response_model=v2.V2ExtrasOut, summary="v2 추가 항목 범위")
async def v2_extras(body: v2.V2ExtrasIn, _: User = Depends(current_user)) -> v2.V2ExtrasOut:
    return service.extras_range(body)


@router.post("/llm", response_model=v2.V2LlmOut, summary="v2 AI 한 번 부르기")
async def v2_llm(body: v2.V2LlmIn, user: User = Depends(current_user)) -> v2.V2LlmOut:
    return await service.ask_llm(str(user.id), body)


@router.get("/llm/health", response_model=v2.V2LlmHealthOut, summary="v2 AI 상태")
async def v2_llm_health(_: User = Depends(current_user)) -> v2.V2LlmHealthOut:
    return service.llm_health()
