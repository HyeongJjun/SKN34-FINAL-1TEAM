"""로그인 전 표준견적서 계산 (dev-03, C57 · J1).

DB에 쓰지 않고 입력을 로그에 남기지 않는다. 숫자는 가입 뒤 표준견적서와 같은 계산 엔진(calc.dobae.standard_v3 ·
calc.mokgong.quote)이 만든다(화면이 보낸 금액은 믿지 않음). 목공 할 곳을 골랐으면 가입 뒤처럼 목공도 센다
(방은 이 단계에서 고르지 않아 방문은 1개, quote.service.calc_trades와 같음).
지역 · 동 · 희망일 검사는 공사 만들기와 같은 project.schemas.check_home.
"""

from datetime import date

from app.calc import dobae, mokgong
from app.calc.common import FORMULA_VERSION, Line, sum_days, sum_won
from app.calc.quote_diff import budget_fit
from app.calc.space_share import SPACE_SHARE_2026_11
from app.guest.schemas import GuestLineOut, GuestPartOut, GuestStandardOut, GuestSumOut
from app.project.schemas import HomeInfoIn, check_home
from app.refprice.book import DOBAE_2026H2, MOKGONG_2026H2
from app.refprice.house import HOUSE_2026H2
from app.refprice.wallpaper_market import paper_market


def _lines(lines: tuple[Line, ...] | list[Line]) -> list[GuestLineOut]:
    return [
        GuestLineOut(
            key=ln.key,
            name=ln.name,
            qty=ln.qty,
            unit=ln.unit,
            unit_price=ln.unit_price,
            amount=ln.amount,
            state=ln.state,
            basis=ln.basis,
            source=ln.source,
        )
        for ln in lines
    ]


async def standard(data: HomeInfoIn, today: date) -> GuestStandardOut:
    """POST /guest/standard: 기본 정보 → 표준견적서 v3(줄 · 합계 · 예상 일수 · 품 · 예산 안/밖 · 가정).
    지역 밖 · 지난 희망일은 422 invalid(fields)."""
    check_home(data, today)
    h = dobae.HomeV3(
        data.area_m2,
        data.area_basis,
        data.grade,
        data.occupied,
        data.scope,
        tuple(data.spaces),
        tuple(data.faces),
    )
    v = dobae.standard_v3(h, DOBAE_2026H2, paper_market(h.grade), SPACE_SHARE_2026_11, HOUSE_2026H2)
    q = v.quote
    parts: list[GuestPartOut] = []
    days = q.days
    total = q.total
    sum_out = None
    if data.mokgong:
        items = tuple(data.mokgong)
        m = mokgong.quote(
            mokgong.MokgongInput(
                data.area_m2,
                data.area_basis,
                items,
                data.occupied,
                doors=1 if "door" in items else 0,
            ),
            MOKGONG_2026H2,
        )
        parts.append(
            GuestPartOut(
                trade="mokgong",
                lines=_lines(m.lines),
                supply=m.subtotal,
                vat=m.vat,
                total=m.total,
            )
        )
        sum_out = GuestSumOut(
            supply=sum_won((q.subtotal, m.subtotal)),
            vat=sum_won((q.vat, m.vat)),
            total=sum_won((q.total, m.total)),
        )
        days = sum_days((m.days, q.days))
        total = sum_out.total
    return GuestStandardOut(
        formula_ver=FORMULA_VERSION,
        price_ver=q.version,
        market_ver=v.market_ver,
        share_ver=v.share_ver,
        scope=data.scope,
        area_m2=data.area_m2,
        area_basis=data.area_basis,
        pyeong=v.pyeong,
        lines=_lines(q.lines),
        supply=q.subtotal,
        vat=q.vat,
        total=q.total,
        days=days,
        man_day=q.man_days,
        budget_fit=budget_fit(total, data.budget_won),
        assumptions=list(q.assumptions),
        parts=parts,
        sum=sum_out,
    )
