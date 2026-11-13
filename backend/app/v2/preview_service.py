"""견적 미리 보기: 도면 · 목공 자재 고르기 · 시장 범위를 팀 프로젝트 위에서 계산한다.

DB에 쓰지 않는다. 프로젝트는 project.service 공개 함수로만 읽고, 숫자는 모두 calc가 만든다.
"""

import uuid
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User
from app.calc import market_band, precise_dobae, precise_mokgong
from app.calc.common import sum_won
from app.calc.plan_qty import Plan, PlanOptions, PlanQty, from_plan
from app.calc.precise_common import Grade, V2Line
from app.calc.standard_quote import house_area
from app.calc.v2_plan_est import plan_est
from app.project import service as project_service
from app.refprice.book import DOBAE_2026H2, MOKGONG_2026H2
from app.refprice.floor_plans import PlanInfo, plans
from app.refprice.house import HOUSE_2026H2
from app.refprice.market import (
    GAP_DOBAE,
    GAP_MOKGONG,
    MARKET_2026_11,
    PUBLIC_EQ_DOBAE,
    PUBLIC_EQ_MOKGONG,
)
from app.refprice.mok_materials import MOK_2026_11
from app.refprice.v2_ref import PRODUCT_PER
from app.shared.errors import AppError
from app.v2.preview_schemas import (
    V2ExtraOut,
    V2GradeInitOut,
    V2MaterialsOut,
    V2MokFixedOut,
    V2MokSelIn,
    V2PlanBriefOut,
    V2PlanEstOut,
    V2PlanQtyOut,
    V2PlanSpaceOut,
    V2PreviewGapStepOut,
    V2PreviewIn,
    V2PreviewLineOut,
    V2PreviewMarketLineOut,
    V2PreviewMarketOut,
    V2PreviewOut,
    V2PreviewStepOut,
    V2ProductOut,
    V2RollOut,
    V2TradePreviewOut,
)


def _brief(p: PlanInfo) -> V2PlanBriefOut:
    return V2PlanBriefOut(**{k: getattr(p, k) for k in V2PlanBriefOut.model_fields})


def list_plans() -> list[V2PlanBriefOut]:
    return [_brief(p) for p in sorted(plans().values(), key=lambda p: (p.supply_m2, p.id))]


def _plan(plan_id: str) -> PlanInfo:
    p = plans().get(plan_id)
    if p is None:
        raise AppError(404, "not_found", "도면을 찾을 수 없어요.")
    return p


def _qty_out(
    plan_id: str, q: PlanQty, est: V2PlanEstOut | None = None, plan: Plan | None = None
) -> V2PlanQtyOut:
    raw = {sp.id: sp for sp in plan.spaces} if plan else {}

    def dims(sid: str) -> dict[str, Decimal]:
        sp = raw.get(sid)
        return (
            {"plan_w_m": Decimal(sp.w_mm) / 1000, "plan_d_m": Decimal(sp.d_mm) / 1000} if sp else {}
        )

    return V2PlanQtyOut(
        est=est,
        plan_id=plan_id,
        expanded=q.options.expanded,
        ceiling=q.options.ceiling,
        kinds=list(q.options.kinds) if q.options.kinds is not None else None,
        spaces=[
            V2PlanSpaceOut(
                **{k: getattr(s, k) for k in V2PlanSpaceOut.model_fields if hasattr(s, k)},
                **dims(s.id),
            )
            for s in q.spaces
        ],
        rolls=[V2RollOut(**r.__dict__) for r in q.rolls.values()],
        **{
            k: getattr(q, k)
            for k in V2PlanQtyOut.model_fields
            if k not in ("plan_id", "expanded", "ceiling", "kinds", "spaces", "rolls", "est")
        },
    )


def _qty(
    plan_id: str, expanded: bool, kinds: list[str] | None, ceiling: bool = True
) -> tuple[PlanInfo, PlanQty]:
    p = _plan(plan_id)
    opts = PlanOptions(expanded=expanded, ceiling=ceiling, kinds=tuple(kinds) if kinds else None)
    return p, from_plan(p.plan, opts)


def plan_qty(
    plan_id: str, expanded: bool, kinds: list[str] | None, ceiling: bool = True
) -> V2PlanQtyOut:
    p, q = _qty(plan_id, expanded, kinds, ceiling)
    return _qty_out(plan_id, q, V2PlanEstOut(**plan_est(p.supply_m2).__dict__), p.plan)


def materials() -> V2MaterialsOut:
    b = MOK_2026_11
    return V2MaterialsOut(
        version=b.version,
        products=[
            V2ProductOut(
                id=k,
                per=PRODUCT_PER.get(p.kind),
                **{f: getattr(p, f) for f in V2ProductOut.model_fields if f not in ("id", "per")},
            )
            for k, p in b.products.items()
        ],
        extras=[V2ExtraOut(**x.__dict__) for x in b.extras],
        grades={g: V2GradeInitOut(**i.__dict__) for g, i in b.init.items()},
        fixed=V2MokFixedOut(
            minus_mult=b.fixed.minus_mult,
            hidden_mult=b.fixed.hidden_mult,
            molding_per_py=b.fixed.molding_per_py,
            base_per_py=b.fixed.base_per_py,
        ),
    )


def _sel(m: V2MokSelIn) -> precise_mokgong.MokSel:
    return precise_mokgong.MokSel(
        door=precise_mokgong.DoorSel(m.door.mode, m.door.pick, m.door.count),
        slide=precise_mokgong.CountSel(m.slide.n, m.slide.pick),
        hidden=precise_mokgong.CountSel(m.hidden.n, m.hidden.pick),
        molding_type=m.molding_type,
        molding=m.molding,
        base=m.base,
        extras=dict(m.extras),
    )


def _lines(lines) -> list[V2PreviewLineOut]:
    out = []
    for ln in lines:
        basis = ln.price_basis if isinstance(ln, V2Line) else ln.basis
        calc = ln.calc if isinstance(ln, V2Line) else ""
        out.append(
            V2PreviewLineOut(
                key=ln.key,
                name=ln.name,
                qty=ln.qty,
                unit=ln.unit,
                unit_price=ln.unit_price,
                amount=ln.amount,
                state=ln.state,
                source=ln.source,
                price_basis=basis,
                calc=calc,
            )
        )
    return out


def _market(r: market_band.MarketResult, gap: market_band.Gap) -> V2PreviewMarketOut:
    return V2PreviewMarketOut(
        version=r.version,
        supply=r.supply,
        lo=r.lo,
        hi=r.hi,
        band_lo=r.band.lo,
        band_hi=r.band.hi,
        n=r.n,
        lines=[V2PreviewMarketLineOut(**ln.__dict__) for ln in r.lines],
        gap_start=gap.start,
        gap=[V2PreviewGapStepOut(**s.__dict__) for s in gap.steps],
    )


def _trade(trade, version, grade, q, market: V2PreviewMarketOut) -> V2TradePreviewOut:
    return V2TradePreviewOut(
        trade=trade,
        version=version,
        grade=grade,
        lines=_lines(q.lines),
        supply=q.subtotal,
        vat=q.vat,
        total=q.total,
        man_day=q.man_days,
        days=q.days,
        steps=[V2PreviewStepOut(key=s.key, name=s.name, half_days=s.half_days) for s in q.steps],
        notes=q.assumptions,
        market=market,
    )


async def preview(
    s: AsyncSession, user: User, project_id: uuid.UUID, body: V2PreviewIn
) -> V2PreviewOut:
    p = await project_service.get_for(s, user, project_id)
    grade: Grade = body.grade or (p.trades.dobae.grade if p.trades.dobae else None) or "basic"
    info = plan_q = None
    if body.plan_id:
        info, plan_q = _qty(body.plan_id, body.expanded, body.kinds)
        area, basis = info.supply_m2, "supply"
    else:
        area, basis = house_area(p.size.band, p.size.m2, p.size.basis, HOUSE_2026H2)
    name = f"{info.name} {info.type}" if info else ""
    trades: list[V2TradePreviewOut] = []
    try:
        if p.trades.mokgong:
            sel = _sel(body.mok) if body.mok else precise_mokgong.default_sel(MOK_2026_11, grade)
            mq = precise_mokgong.quote(
                precise_mokgong.V2MokgongInput(
                    area_m2=area,
                    sel=sel,
                    area_basis=basis,
                    occupied=p.occupied,
                    plan=plan_q,
                    plan_name=name,
                ),
                MOK_2026_11,
                MOKGONG_2026H2,
            )
            if mq is not None:
                items = tuple(
                    i
                    for i, on in (
                        ("molding", sel.molding_type != "none"),
                        ("base", sel.base is not None),
                        ("door", sel.door.mode != "none" and mq.doors > 0),
                    )
                    if on
                )
                mi = market_band.MarketMokgongInput(
                    area_m2=area,
                    items=items,
                    area_basis=basis,
                    doors=mq.doors,
                    door_frame=sel.door.mode == "replace",
                    plan=plan_q,
                    plan_name=name,
                    extra_amount=mq.extra_amount,
                )
                mr = market_band.mokgong(mi, MARKET_2026_11)
                gap = market_band.gap_steps(
                    mi, MARKET_2026_11, PUBLIC_EQ_MOKGONG, GAP_MOKGONG, mq.subtotal, mq.vat
                )
                trades.append(_trade("mokgong", mq.version, None, mq, _market(mr, gap)))
        if p.trades.dobae:
            dq = precise_dobae.quote(
                precise_dobae.V2DobaeInput(
                    area_m2=area,
                    grade=grade,
                    area_basis=basis,
                    occupied=p.occupied,
                    balcony_ext=p.balcony_ext,
                    plan=plan_q,
                    plan_name=name,
                ),
                DOBAE_2026H2,
            )
            di = market_band.MarketDobaeInput(
                area_m2=area,
                grade=grade,
                area_basis=basis,
                occupied=p.occupied,
                balcony_ext=p.balcony_ext,
                plan=plan_q,
                plan_name=name,
            )
            dr = market_band.dobae(di, MARKET_2026_11)
            gap = market_band.gap_steps(
                di, MARKET_2026_11, PUBLIC_EQ_DOBAE, GAP_DOBAE, dq.subtotal, dq.vat
            )
            trades.append(_trade("dobae", dq.version, dq.paper_grade, dq, _market(dr, gap)))
    except ValueError as e:
        raise AppError(422, "invalid", str(e)) from e
    return V2PreviewOut(
        project_id=p.id,
        project_rev=p.rev,
        area_m2=area,
        area_basis=basis,
        grade=grade,
        plan=_brief(info) if info else None,
        plan_qty=_qty_out(info.id, plan_q, plan=info.plan) if info and plan_q else None,
        trades=trades,
        supply=sum_won(t.supply for t in trades),
        vat=sum_won(t.vat for t in trades),
        total=sum_won(t.total for t in trades),
    )
