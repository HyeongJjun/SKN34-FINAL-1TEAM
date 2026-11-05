import uuid
from typing import Literal

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import current_user, require_role
from app.auth.models import User
from app.db import get_session
from app.project import service
from app.project.schemas import ProjectCheckIn, ProjectCheckOut, ProjectCreate, ProjectOut
from app.shared import ratelimit
from app.shared.clock import today_seoul
from app.shared.regions import SIDO

router = APIRouter(tags=["프로젝트"])


@router.get("/regions", summary="시 · 도 → 시 · 군 · 구 목록")
async def regions() -> list[dict]:
    return [
        {
            "id": sid,
            "name": name,
            "full": full,
            "groups": [{"label": lb, "prefix": pf, "items": items} for lb, pf, items in groups],
        }
        for sid, (name, full, groups) in SIDO.items()
    ]


@router.post(
    "/projects",
    status_code=201,
    response_model=ProjectOut,
    summary="프로젝트 만들기",
)
async def create_project(
    data: ProjectCreate,
    user: User = Depends(require_role("customer")),
    s: AsyncSession = Depends(get_session),
) -> ProjectOut:
    await ratelimit.hit(
        ratelimit.key("project", str(user.id)),
        30,
        3600,
        "프로젝트를 너무 많이 만들었어요. 잠시 뒤에 다시 해 주세요.",
    )
    return await service.create(s, user, data, today_seoul())


@router.get(
    "/projects/{project_id}",
    response_model=ProjectOut,
    summary="프로젝트 보기 (만든 사람 · 관리자)",
)
async def get_project(
    project_id: uuid.UUID,
    user: User = Depends(current_user),
    s: AsyncSession = Depends(get_session),
) -> ProjectOut:
    return await service.get_for(s, user, project_id)


@router.patch(
    "/projects/{project_id}",
    response_model=ProjectOut,
    summary="집 정보 고치기 (실측 요청 전까지, 만든 사람만)",
)
async def update_project(
    project_id: uuid.UUID,
    data: ProjectCreate,
    user: User = Depends(require_role("customer")),
    s: AsyncSession = Depends(get_session),
) -> ProjectOut:
    return await service.update(s, user, project_id, data, today_seoul())


@router.put(
    "/projects/{project_id}/checks/{key}",
    response_model=list[ProjectCheckOut],
    summary="공사 전에 할 일 체크 켜기 · 끄기 (만든 고객만)",
)
async def set_check(
    project_id: uuid.UUID,
    key: Literal["office_report"],
    data: ProjectCheckIn,
    user: User = Depends(require_role("customer")),
    s: AsyncSession = Depends(get_session),
) -> list[ProjectCheckOut]:
    return await service.set_check(s, user, project_id, key, data.done)
