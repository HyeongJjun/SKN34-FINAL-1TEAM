from fastapi import APIRouter, Depends

from app.guest import service
from app.guest.schemas import GuestStandardOut
from app.project.schemas import HomeInfoIn
from app.shared import ratelimit
from app.shared.clock import today_seoul

# 손님 경로는 모두 IP 한도(분당 20 · 하루 300, Redis가 멈추면 프로세스 안에서 셈)를 먼저 센다
router = APIRouter(tags=["손님 (로그인 없음)"], dependencies=[Depends(ratelimit.guest)])


@router.post(
    "/guest/standard",
    response_model=GuestStandardOut,
    summary="로그인 전 표준견적서 계산 (저장 안 함 · IP 요청 제한 · 4KB · 지역 밖 422)",
)
async def guest_standard(data: HomeInfoIn) -> GuestStandardOut:
    """IP 한도(429)는 router 의존성, 본문 4KB(413)는 입구(BodyLimit)에서 막는다. DB · 로그에 입력을 쓰지 않는다."""
    return await service.standard(data, today_seoul())
