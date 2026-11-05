"""프로젝트(집 정보) 만들기 · 보기 · 고치기.

표준견적서는 quote, 공정표는 schedule이 이 프로젝트를 읽어 만든다(rev가 바뀌면 새 버전).
"""

import uuid
from datetime import date

from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User
from app.files import service as files_service
from app.project import repository as repo
from app.project.models import (
    CHECK_KEYS,
    CHECK_LABELS,
    Project,
    ProjectCheck,
    ProjectFile,
    ProjectSpace,
    ProjectTrade,
    ProjectTradeSpace,
)
from app.project.schemas import (
    DobaeOut,
    MokgongOut,
    PhotoOut,
    ProjectBrief,
    ProjectCheckOut,
    ProjectCreate,
    ProjectListItem,
    ProjectOut,
    SizeIn,
    SpaceOut,
    TradesOut,
    WhenIn,
)
from app.shared.clock import now_utc
from app.shared.errors import AppError
from app.shared.regions import is_region, region_label

LOCKED = "실측을 요청한 뒤에는 집 정보를 고칠 수 없어요."


async def _check(
    s: AsyncSession,
    owner: User,
    data: ProjectCreate,
    today: date,
    project_id: uuid.UUID | None = None,
) -> None:
    """만들기 · 고치기가 같이 쓰는 검사. 파일은 내가 올린 것, 종류가 맞는 것,
    다른 프로젝트에 안 붙은 것만(고칠 때는 이 프로젝트에 붙은 것은 괜찮다)."""
    if not is_region(data.sido, data.sgg):
        raise AppError(422, "region", "지역을 다시 골라 주세요.")
    if data.built_year is not None and data.built_year > today.year:
        raise AppError(422, "built_year", "준공 연도를 다시 확인해 주세요.")
    if data.when.start is not None and data.when.start < today:
        raise AppError(422, "past_date", "오늘 이후 날짜를 골라 주세요.")
    latest = date(today.year + 2, today.month, min(today.day, 28))
    if any(d is not None and d > latest for d in (data.when.start, data.when.end)):
        raise AppError(422, "far_date", "2년 안의 날짜를 골라 주세요.")
    photo_ids = [p.file_id for p in data.photos]
    files = await files_service.owned(s, owner.id, photo_ids + list(data.plans))
    if any(i not in files or files[i].kind != "photo" for i in photo_ids) or any(
        i not in files or files[i].kind != "plan" for i in data.plans
    ):
        raise AppError(422, "file", "올린 사진 · 도면을 다시 확인해 주세요.")
    ids = photo_ids + list(data.plans)
    used = (
        await repo.attached_file_ids(s, ids)
        if project_id is None
        else await repo.attached_elsewhere(s, ids, project_id)
    )
    if used:
        raise AppError(409, "file_used", "이미 다른 프로젝트에 붙인 파일이 있어요.")


def _fill(p: Project, data: ProjectCreate) -> None:
    p.sido = data.sido
    p.sgg = data.sgg
    p.house_type = data.house_type
    p.built_year = data.built_year
    p.size_band = data.size.band
    p.area_basis = data.size.basis
    p.area_m2 = data.size.m2
    p.balcony_ext = data.balcony_ext
    p.start_kind = data.when.kind
    p.start_date = data.when.start
    p.end_date = data.when.end
    p.occupied = data.occupied
    p.budget = data.budget


async def _write_parts(s: AsyncSession, p: Project, data: ProjectCreate) -> None:
    space_id: dict[str, uuid.UUID] = {}
    for i, sp in enumerate(data.spaces):
        row = ProjectSpace(project_id=p.id, name=sp.name, sort=i)
        s.add(row)
        await s.flush()
        space_id[sp.key] = row.id

    for trade, t in (("dobae", data.trades.dobae), ("mokgong", data.trades.mokgong)):
        if t is None:
            continue
        s.add(
            ProjectTrade(
                project_id=p.id,
                trade=trade,
                items=list(getattr(t, "items", [])),
                grade=getattr(t, "grade", None),
            )
        )
        await s.flush()
        s.add_all(
            [
                ProjectTradeSpace(project_id=p.id, trade=trade, space_id=space_id[k])
                for k in t.spaces
            ]
        )

    s.add_all(
        [
            ProjectFile(
                file_id=ph.file_id,
                project_id=p.id,
                space_id=space_id[ph.space],
                role="photo",
                sort=i,
            )
            for i, ph in enumerate(data.photos)
        ]
    )
    s.add_all(
        [
            ProjectFile(file_id=fid, project_id=p.id, space_id=None, role="plan", sort=i)
            for i, fid in enumerate(data.plans)
        ]
    )


async def _commit(s: AsyncSession) -> None:
    try:
        await s.commit()
    except IntegrityError as exc:  # 같은 사진으로 동시에 두 번 만들면 파일 PK가 막는다
        await s.rollback()
        raise AppError(409, "file_used", "이미 다른 프로젝트에 붙인 파일이 있어요.") from exc


async def create(s: AsyncSession, owner: User, data: ProjectCreate, today: date) -> ProjectOut:
    await _check(s, owner, data, today)
    no = await repo.next_code_no(s)
    p = Project(owner_id=owner.id, code=f"MJ-{today:%y%m}-{no:04d}")
    _fill(p, data)
    s.add(p)
    await s.flush()
    await _write_parts(s, p, data)
    await _commit(s)
    return await _out(s, p)


async def update(
    s: AsyncSession, owner: User, project_id: uuid.UUID, data: ProjectCreate, today: date
) -> ProjectOut:
    """집 정보 고치기: 실측을 요청하기 전까지만. 공간 · 공정 · 파일은 통째로 바꾸고 rev를 올린다."""
    p = await repo.get_for_update(s, project_id)
    if p is None or p.owner_id != owner.id:
        raise AppError(404, "not_found", "프로젝트를 찾을 수 없어요.")
    if p.locked_at is not None:
        raise AppError(409, "locked", LOCKED)
    await _check(s, owner, data, today, project_id)
    _fill(p, data)
    p.rev += 1
    await repo.clear_parts(s, p.id)
    await s.flush()
    await _write_parts(s, p, data)
    await _commit(s)
    return await _out(s, p)


async def lock(s: AsyncSession, project_id: uuid.UUID) -> None:
    """프로젝트 행을 잠근다. 같은 집의 상태 변경은 프로젝트 → 요청 · 확정 행 → 제안 · 요청 행 순서로
    잠가 줄 선다(알림 insert의 project_id FK도 이 행을 잡으므로 먼저 잡는다). commit은 부르는 쪽이."""
    if await repo.get_for_update(s, project_id) is None:
        raise AppError(404, "not_found", "프로젝트를 찾을 수 없어요.")


async def lock_for_visit(
    s: AsyncSession, project_id: uuid.UUID, unit: tuple[str, str, str] | None = None
) -> Project:
    """실측 요청을 넣기 전에 부른다: 프로젝트 행을 잠그고(같은 프로젝트의 요청이 줄 선다),
    아직 안 잠겼으면 locked_at을 찍는다. 연락처를 보내면 아파트 이름 · 동 · 호수(unit)도 적는다.
    commit은 부르는 쪽이 한다."""
    p = await repo.get_for_update(s, project_id)
    if p is None:
        raise AppError(404, "not_found", "프로젝트를 찾을 수 없어요.")
    if p.locked_at is None:
        p.locked_at = now_utc()
    if unit is not None:
        p.apt_name, p.dong, p.ho = unit
    return p


def _size(p: Project) -> SizeIn:
    return SizeIn(band=p.size_band) if p.size_band else SizeIn(basis=p.area_basis, m2=p.area_m2)


async def _out(s: AsyncSession, p: Project) -> ProjectOut:
    spaces, trades, links, files = await repo.parts(s, p.id)
    tr = TradesOut()
    for t in trades:
        ids = [link.space_id for link in links if link.trade == t.trade]
        if t.trade == "dobae":
            tr.dobae = DobaeOut(spaces=ids, grade=t.grade)
        else:
            tr.mokgong = MokgongOut(spaces=ids, items=list(t.items))
    return ProjectOut(
        id=p.id,
        code=p.code,
        rev=p.rev,
        locked=p.locked_at is not None,
        sido=p.sido,
        sgg=p.sgg,
        region=region_label(p.sido, p.sgg),
        house_type=p.house_type,
        built_year=p.built_year,
        size=_size(p),
        balcony_ext=p.balcony_ext,
        when=WhenIn(kind=p.start_kind, start=p.start_date, end=p.end_date),
        occupied=p.occupied,
        budget=p.budget,
        spaces=[SpaceOut(id=sp.id, name=sp.name) for sp in spaces],
        trades=tr,
        photos=[
            PhotoOut(file_id=f.file_id, space_id=f.space_id) for f in files if f.role == "photo"
        ],
        plans=[f.file_id for f in files if f.role == "plan"],
        created_at=p.created_at,
    )


async def get_for(s: AsyncSession, user: User, project_id: uuid.UUID) -> ProjectOut:
    p = await repo.get(s, project_id)
    if p is None or (p.owner_id != user.id and user.role != "admin"):
        raise AppError(404, "not_found", "프로젝트를 찾을 수 없어요.")
    return await _out(s, p)


async def get_out(s: AsyncSession, project_id: uuid.UUID) -> ProjectOut:
    """권한 확인 없이 읽는다. 업체 확정처럼 부르는 쪽이 이미 권한을 확인했을 때만 쓴다."""
    p = await repo.get(s, project_id)
    if p is None:
        raise AppError(404, "not_found", "프로젝트를 찾을 수 없어요.")
    return await _out(s, p)


async def list_mine(s: AsyncSession, user: User) -> list[ProjectListItem]:
    rows = await repo.list_by_owner(s, user.id)
    trades = await repo.trades_of(s, [p.id for p in rows])
    return [
        ProjectListItem(
            id=p.id,
            code=p.code,
            region=region_label(p.sido, p.sgg),
            size=_size(p),
            trades=sorted(trades[p.id]),
            created_at=p.created_at,
        )
        for p in rows
    ]


async def briefs(s: AsyncSession, project_ids: list[uuid.UUID]) -> dict[uuid.UUID, ProjectBrief]:
    """실측 요청을 받은 업체 쪽에 쓰는 집 요약 (권한은 부르는 쪽이 요청으로 확인한다)."""
    if not project_ids:
        return {}
    return {
        p.id: ProjectBrief(
            id=p.id,
            code=p.code,
            owner_id=p.owner_id,
            owner_name=name,
            owner_phone=phone,
            sido=p.sido,
            sgg=p.sgg,
            region=region_label(p.sido, p.sgg),
            occupied=p.occupied,
            when=WhenIn(kind=p.start_kind, start=p.start_date, end=p.end_date),
            apt_name=p.apt_name,
            dong=p.dong,
            ho=p.ho,
        )
        for p, name, phone in await repo.with_owners(s, project_ids)
    }


# ---- 공사 전에 할 일 체크 ----


async def checks(s: AsyncSession, project_id: uuid.UUID) -> list[ProjectCheckOut]:
    """체크 목록 (권한은 부르는 쪽이 먼저 확인한다)"""
    rows = {
        c.key: c
        for c in (
            await s.execute(select(ProjectCheck).where(ProjectCheck.project_id == project_id))
        ).scalars()
    }
    return [
        ProjectCheckOut(
            key=k,
            label=CHECK_LABELS[k],
            done=k in rows,
            done_at=rows[k].done_at if k in rows else None,
        )
        for k in CHECK_KEYS
    ]


async def set_check(
    s: AsyncSession, user: User, project_id: uuid.UUID, key: str, done: bool
) -> list[ProjectCheckOut]:
    """체크 켜기 · 끄기 (만든 고객만). 두 번 켜도 한 줄(PK), 없는 것을 꺼도 그대로."""
    p = await get_for(s, user, project_id)
    if user.role != "customer":
        raise AppError(403, "forbidden", "고객만 체크할 수 있어요.")
    if done:
        await s.execute(
            insert(ProjectCheck)
            .values(project_id=p.id, key=key, by_id=user.id)
            .on_conflict_do_nothing(index_elements=["project_id", "key"])
        )
    else:
        await s.execute(
            delete(ProjectCheck).where(ProjectCheck.project_id == p.id, ProjectCheck.key == key)
        )
    await s.commit()
    return await checks(s, p.id)
