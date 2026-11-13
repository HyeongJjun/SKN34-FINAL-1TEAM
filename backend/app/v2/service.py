"""v2 화면(/v2) API: 고른 값을 calc 입력으로 바꿔 계산하고 v10 모양으로 돌려준다. DB에 쓰지 않는다.

숫자는 모두 calc(v2_quote · v2_plan · v2_check · v2_tools · market_band)가 만든다.
AI는 agent.llm.chat_tools 한 번 부르기만 한다(도구는 화면이 실행한다).
"""

from datetime import date, timedelta
from decimal import Decimal

from app.calc import market_band, precise_mokgong, v2_check, v2_plan, v2_tools
from app.calc.common import FORMULA_VERSION, from_entered
from app.calc.plan_qty import PlanOptions, from_plan
from app.calc.v2_quote import V2Books, V2Plan, V2QuoteInput, build, inputs, market_input
from app.refprice import v2_ref
from app.refprice.book import DOBAE_2026H2, MOKGONG_2026H2
from app.refprice.floor_plans import plans
from app.refprice.holidays import HOLIDAYS
from app.refprice.market import (
    GAP_DOBAE,
    GAP_MOKGONG,
    MARKET_2026_11,
    PUBLIC_EQ_DOBAE,
    PUBLIC_EQ_MOKGONG,
)
from app.refprice.mok_materials import MOK_2026_11
from app.shared.errors import AppError
from app.v2 import schemas as v2


def books() -> V2Books:
    return V2Books(
        dobae=DOBAE_2026H2,
        mok=MOK_2026_11,
        mokgong=MOKGONG_2026H2,
        market=MARKET_2026_11,
        public_eq_dobae=PUBLIC_EQ_DOBAE,
        public_eq_mokgong=PUBLIC_EQ_MOKGONG,
        gap_dobae=GAP_DOBAE,
        gap_mokgong=GAP_MOKGONG,
        estimate_ref=v2_ref.estimate_ref(),
        materials=v2_ref.materials(),
        cat_ko=v2_ref.CAT_KO,
        dobae_removal_calc=v2_ref.DOBAE_REMOVAL_CALC,
    )


def _sel(m: v2.V2MokIn | None, tier: str) -> tuple[precise_mokgong.MokSel, bool]:
    """v10 S.mok10 → 계산 입력. v10처럼 자재를 안 고른 칸은 하지 않은 것으로, 모르는 칸은 뺀다."""
    book = MOK_2026_11
    if m is None:  # v10 mok10St() 처음 값
        g = tier if tier in book.init else "basic"
        i = book.init[g]  # type: ignore[index]
        sel = precise_mokgong.MokSel(
            slide=precise_mokgong.CountSel(0, "door-yerim-hidden-sliding-set"),
            hidden=precise_mokgong.CountSel(0, "door-yerim-hidden-set"),
            molding_type=i.molding_type,
            molding=i.molding,
            base=i.base,
        )
        return sel, False
    known = {x.key: x for x in book.extras}
    extras: dict[str, bool | Decimal] = {}
    for k, v in m.extras.items():
        x = known.get(k)
        if x is None or v is False:
            continue
        extras[k] = Decimal(1) if v is True and x.auto is None else v  # v10: +true = 1
    d = m.door
    sel = precise_mokgong.MokSel(
        door=precise_mokgong.DoorSel(d.mode if d.pick else "none", d.pick, d.count),
        slide=precise_mokgong.CountSel(m.slide.n if m.slide.pick else 0, m.slide.pick),
        hidden=precise_mokgong.CountSel(m.hidden.n if m.hidden.pick else 0, m.hidden.pick),
        molding_type=m.molding.type if m.molding.pick else "none",
        molding=m.molding.pick,
        base=m.base.pick,
        extras=extras,
    )
    return sel, d.count is not None


def _plan(p: v2.V2PlanSelIn | None) -> V2Plan | None:
    if p is None:
        return None
    info = plans().get(p.id)
    if info is None:
        raise AppError(404, "not_found", "도면을 찾을 수 없어요.")
    kinds = tuple(p.kinds) if p.kinds is not None else None
    qty = from_plan(info.plan, PlanOptions(expanded=p.expanded, ceiling=True, kinds=kinds))
    name = f"{info.name} {info.type}"
    if kinds is not None:  # v10 pp9ScopeKo
        sp = [ko for k, ko in v2_ref.SPACE_KO.items() if k in (p.spaces or [])]
        name += f" ({' · '.join(sp)}만)"
    return V2Plan(name, info.supply_m2, info.supply_py, p.expanded, qty)


def _quote_input(q: v2.V2QuoteIn) -> V2QuoteInput:
    sel, count_set = _sel(q.mok, q.tier)
    return V2QuoteInput(
        pyeong=q.pyeong,
        occupied=q.living == "living",
        cats=tuple(q.cats),
        picks=dict(q.picks),
        plan=_plan(q.plan),
        balcony=q.balcony,
        mok=sel,
        door_count_set=count_set,
        door_removal=bool(q.mok and q.mok.door.mode in ("replace", "overlay")),
    )


def _build(q: v2.V2QuoteIn, today: date) -> tuple[V2QuoteInput, dict]:
    qi = _quote_input(q)
    try:
        return qi, build(qi, books(), today)
    except ValueError as e:
        raise AppError(422, "invalid", str(e)) from e


def quote(q: v2.V2QuoteIn, today: date) -> v2.V2QuoteOut:
    _, r = _build(q, today)
    return v2.V2QuoteOut(**r, formula_version=FORMULA_VERSION, price_ver=DOBAE_2026H2.version)


def market_extras() -> list[v2.V2MarketExtraOut]:
    return [v2.V2MarketExtraOut(**e.__dict__) for e in MARKET_2026_11.mokgong.extras]


def _holidays() -> dict[str, str]:
    return {d.isoformat(): n for d, n in {**HOLIDAYS, **v2_ref.HOLIDAYS_EXTRA}.items()}


def plan(b: v2.V2PlanIn, today: date) -> v2.V2PlanOut:
    _, q = _build(b.quote, today)
    c = b.cons
    o = v2_plan.Opts(c.weekendWork, frozenset(c.avoid), _holidays())
    props = {k: v.model_dump() for k, v in b.props.items()}
    acc = {k: v.model_dump() for k, v in b.accepted.items()}
    trades = v2_plan.plan_trades(q, b.quote.cats, props, acc)
    t = today.isoformat()
    p = v2_plan.build_plan(trades, o, t, c.endBy, c.startAfter, b.move)
    tri = b.trial
    trial = v2_plan.trial(p, tri.trade, tri.start, tri.end, o, t, acc) if tri else None
    return v2.V2PlanOut(
        **p,
        today=t,
        tomorrow=(today + timedelta(days=1)).isoformat(),
        due_next=f"{(today + timedelta(days=1)).isoformat()} 18:00",
        weeks=v2_plan.weeks(p["blocks"]),
        trial=trial,
    )


def check(b: v2.V2CheckIn, today: date) -> v2.V2CheckOut:
    qi, q = _build(b.quote, today)
    t = next((x for x in q["precise"] if x["trade"] == b.trade), None)
    if t is None:
        raise AppError(422, "invalid", "이 공정은 견적서에 없어요.")
    mi = market_input(t, qi, inputs(qi, books()))
    s = b.scope
    scope = v2_check.CheckScope(s.ceiling, s.removal, s.moving, s.casing9, s.etc, dict(s.extras))
    return v2.V2CheckOut(**v2_check.check(mi, MARKET_2026_11, b.amount, b.mode, scope))


def estimate(b: v2.V2EstimateIn) -> v2.V2EstimateOut:
    lines = [ln.model_dump() for ln in b.lines]
    return v2.V2EstimateOut(**v2_check.estimate_for(lines, b.prices, b.grade, b.std_total))


def entered(b: v2.V2EnteredIn) -> v2.V2EnteredOut:
    m = from_entered(b.amount, b.mode)
    pct = v2_check.percent_vs(m.total, b.std_total) if b.std_total else None
    return v2.V2EnteredOut(supply=m.supply, vat=m.vat, total=m.total, pct=pct)


def calc7(b: v2.V2Calc7In) -> v2.V2WallOut | v2.V2TrimOut | v2.V2PaintOut:
    if b.kind == "wallpaper":
        r = v2_tools.wallpaper(
            b.w, b.d, b.hgt, b.rollW, b.rollLen, b.doors, b.windows, b.ceiling, b.repeat, b.loss
        )
        return v2.V2WallOut(**r)
    if b.kind == "trim":
        return v2.V2TrimOut(**v2_tools.trim(b.w, b.d, b.doors, b.doorW, b.pieceLen, b.loss))
    r = v2_tools.paint(b.w, b.d, b.hgt, b.doors, b.windows, b.ceiling, b.coats, b.cover)
    return v2.V2PaintOut(**r)


def extras_range(b: v2.V2ExtrasIn) -> v2.V2ExtrasOut:
    c = b.casing
    r = market_band.extras_range(
        MARKET_2026_11.mokgong, dict(b.picks), c.doors if c else 0, c.with_door if c else False
    )
    return v2.V2ExtrasOut(lo=r.lo, hi=r.hi, notes=r.notes)
