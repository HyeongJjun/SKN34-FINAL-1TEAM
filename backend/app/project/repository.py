import uuid

from sqlalchemy import delete, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User
from app.project.models import Project, ProjectFile, ProjectSpace, ProjectTrade, ProjectTradeSpace


async def attached_file_ids(s: AsyncSession, ids: list[uuid.UUID]) -> set[uuid.UUID]:
    if not ids:
        return set()
    return set(
        (await s.execute(select(ProjectFile.file_id).where(ProjectFile.file_id.in_(ids)))).scalars()
    )


async def next_code_no(s: AsyncSession) -> int:
    return int(await s.scalar(text("select nextval('project_code_seq')")))


async def attached_elsewhere(
    s: AsyncSession, ids: list[uuid.UUID], project_id: uuid.UUID
) -> set[uuid.UUID]:
    """이 프로젝트가 아닌 곳에 붙은 파일"""
    if not ids:
        return set()
    q = select(ProjectFile.file_id).where(
        ProjectFile.file_id.in_(ids), ProjectFile.project_id != project_id
    )
    return set((await s.execute(q)).scalars())


async def clear_parts(s: AsyncSession, project_id: uuid.UUID) -> None:
    """공간 · 공정 · 파일 연결을 지운다(집 정보 고치기에서 새로 넣기 전에)."""
    for model in (ProjectFile, ProjectTradeSpace, ProjectTrade, ProjectSpace):
        await s.execute(delete(model).where(model.project_id == project_id))


async def get_for_update(s: AsyncSession, project_id: uuid.UUID) -> Project | None:
    q = select(Project).where(Project.id == project_id).with_for_update()
    return (await s.execute(q)).scalar_one_or_none()


async def get(s: AsyncSession, project_id: uuid.UUID) -> Project | None:
    return await s.get(Project, project_id)


async def list_by_owner(s: AsyncSession, owner_id: uuid.UUID) -> list[Project]:
    q = select(Project).where(Project.owner_id == owner_id).order_by(Project.created_at.desc())
    return list((await s.execute(q)).scalars())


async def parts(s: AsyncSession, project_id: uuid.UUID):
    spaces = list(
        (
            await s.execute(
                select(ProjectSpace)
                .where(ProjectSpace.project_id == project_id)
                .order_by(ProjectSpace.sort)
            )
        ).scalars()
    )
    trades = list(
        (
            await s.execute(select(ProjectTrade).where(ProjectTrade.project_id == project_id))
        ).scalars()
    )
    links = list(
        (
            await s.execute(
                select(ProjectTradeSpace).where(ProjectTradeSpace.project_id == project_id)
            )
        ).scalars()
    )
    files = list(
        (
            await s.execute(
                select(ProjectFile)
                .where(ProjectFile.project_id == project_id)
                .order_by(ProjectFile.sort)
            )
        ).scalars()
    )
    return spaces, trades, links, files


async def trades_of(s: AsyncSession, project_ids: list[uuid.UUID]) -> dict[uuid.UUID, list[str]]:
    out: dict[uuid.UUID, list[str]] = {i: [] for i in project_ids}
    if project_ids:
        for pid, t in (
            await s.execute(
                select(ProjectTrade.project_id, ProjectTrade.trade).where(
                    ProjectTrade.project_id.in_(project_ids)
                )
            )
        ).all():
            out[pid].append(t)
    return out


async def with_owners(
    s: AsyncSession, project_ids: list[uuid.UUID]
) -> list[tuple[Project, str, str | None]]:
    """프로젝트와 만든 고객의 이름 · 휴대폰 (회원 표는 읽기 조인에만 쓴다)"""
    q = (
        select(Project, User.name, User.phone)
        .join(User, User.id == Project.owner_id)
        .where(Project.id.in_(project_ids))
    )
    return [(p, name, phone) for p, name, phone in (await s.execute(q)).all()]
