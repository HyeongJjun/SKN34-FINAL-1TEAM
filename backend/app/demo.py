"""시연용 고객 흐름 데이터를 만든다. 운영(APP_ENV=production)에서는 돌지 않는다.

시연 고객 1명과 시연 업체 3곳(도배 2 · 목공 1, 승인 · 확인한 단가까지)을 만들고,
고객 흐름 단계마다 프로젝트를 하나씩 만든다. 업체 쪽 일(견적서 보내기 · 공사 날짜 내기)은 미리 해 둔다.
  업체 고르기(pick) → 실측 요청(visit_requested) → 견적서 옴(quotes_arrived)
  → 공사 날짜 옴(dates_received) → 확정 공정표(before_work)
다시 돌리면 계정은 그대로 두고 단계별 프로젝트를 한 벌 더 만든다. 시연 안내 화면(/demo)은 단계마다 가장 최근 것을 쓴다.
업체 승인자로 남길 관리자 계정이 먼저 있어야 한다.
비밀번호는 DEMO_PASSWORD에서 읽고 화면에 찍지 않는다. 이미 있는 계정의 비밀번호는 바꾸지 않는다.
돌리기: docker compose exec -T -e DEMO_PASSWORD api python -m app.demo
"""

import asyncio
import os
from datetime import date, time, timedelta

from sqlalchemy import select

from app.auth import repository as auth_repo
from app.auth import service as auth_service
from app.auth.models import User
from app.calc.schedule import workdays
from app.config import settings
from app.db import SessionLocal, engine
from app.files import service as files_service
from app.project import service as project_service
from app.project.schemas import ProjectCreate
from app.quote.schemas import QuoteDraftIn
from app.refprice.holidays import days_off
from app.schedule import service as schedule_service
from app.schedule.schemas import AcceptIn, ConfirmIn, DatesIn
from app.seed import LICENSE, sample_pdf
from app.shared.clock import now_utc, today_seoul
from app.vendor import repository as vendor_repo
from app.vendor import service as vendor_service
from app.vendor.models import Vendor, VendorArea, VendorReview, VendorTrade
from app.vendor.schemas import PriceFileIn, PriceLineIn, PriceSetIn
from app.visit import service as visit_service
from app.visit.schemas import VisitCreateIn

CUSTOMER = ("demo@mitjip.test", "시연 고객", "01000000000")  # 실제로 없는 번호
# 이메일 → (담당자, 상호, 대표, 사업자번호, 전화, 공정, 확인한 단가). 단가는 원 · 부가세 빼고
VENDORS = {
    "demo-dobae1@mitjip.test": (
        "김시연",
        "시연도배",
        "김시연",
        "9990000901",
        "01000000901",
        "dobae",
        {"wall": 6650, "ceiling": 6800, "paper_basic": 3400, "paper_economy": 2600},
    ),
    "demo-dobae2@mitjip.test": (
        "이시연",
        "시연벽지",
        "이시연",
        "9990000902",
        "01000000902",
        "dobae",
        {
            "wall": 7000,
            "ceiling": 7200,
            "paper_basic": 3600,
            "paper_economy": 2800,
            "primer": 600,
        },
    ),
    "demo-mok1@mitjip.test": (
        "박시연",
        "시연목공",
        "박시연",
        "9990000903",
        "01000000903",
        "mokgong",
        {
            "frame": 18000,
            "board": 12000,
            "ceiling_mat": 9000,
            "door": 90000,
            "casing": 4500,
            "door_mat": 180000,
            "molding": 3500,
            "molding_mat": 2500,
            "base": 3000,
            "base_mat": 2000,
        },
    ),
}
D1, D2, MOK = VENDORS
AREA = ("seoul", "노원구")
QUOTE_PDF = sample_pdf(b"SAMPLE QUOTE - demo data only")
PRICE_PDF = sample_pdf(b"SAMPLE PRICE LIST - demo data only")


def _project(today: date, both: bool) -> ProjectCreate:
    """노원구 32평(공급 105.8㎡) 빈 집. both면 목공(몰딩 · 걸레받이)도 한다."""
    trades = {"dobae": {"spaces": ["a", "b", "c"], "grade": "basic"}}
    if both:
        trades["mokgong"] = {"spaces": ["a"], "items": ["molding", "base"]}
    return ProjectCreate.model_validate(
        {
            "sido": AREA[0],
            "sgg": AREA[1],
            "built_year": 2009,
            "size": {"basis": "supply", "m2": "105.8"},
            "balcony_ext": False,
            "when": {
                "kind": "date",
                "start": (today + timedelta(days=28)).isoformat(),
                "end": (today + timedelta(days=42)).isoformat(),
            },
            "occupied": False,
            "budget": "500-700",
            "spaces": [
                {"key": "a", "name": "거실"},
                {"key": "b", "name": "안방"},
                {"key": "c", "name": "작은방"},
            ],
            "trades": trades,
        }
    )


async def _user(s, email: str, name: str, password: str, role: str, phone=None) -> User:
    user = await auth_repo.user_by_email(s, email)
    if user is None:
        user = await auth_service.create_user(
            s, email=email, name=name, password=password, role=role, phone=phone
        )
    return user


async def _vendor(s, email: str, password: str, admin: User, today: date) -> User:
    """승인 · 업체 정보 · 확인한 단가까지 갖춘 시연 업체. 이미 있으면 빈 것만 채운다."""
    name, biz, owner, biz_no, phone, trade, prices = VENDORS[email]
    user = await _user(s, email, name, password, "vendor")
    if await s.get(Vendor, user.id) is None:
        lic = files_service.Prepared(
            kind="license", data=LICENSE, content_type="application/pdf", filename="시연용.pdf"
        )
        row = await files_service.persist(s, user.id, lic)
        now = now_utc()
        try:
            s.add(
                Vendor(
                    user_id=user.id,
                    license_file_id=row.id,
                    status="approved",
                    reviewed_by=admin.id,
                    reviewed_at=now,
                    approved_at=now,
                    biz_name=biz,
                    owner_name=owner,
                    biz_no=biz_no,
                    phone=phone,
                    address="서울 노원구 (시연용 주소)",
                    contact_method="phone",
                    call_start=time(9),
                    call_end=time(18),
                    visit_fee=0,
                )
            )
            await s.flush()
            s.add_all(
                [
                    VendorReview(vendor_id=user.id, action="apply", by_id=user.id, at=now),
                    VendorReview(vendor_id=user.id, action="approve", by_id=admin.id, at=now),
                    VendorTrade(vendor_id=user.id, trade=trade),
                    VendorArea(vendor_id=user.id, sido=AREA[0], sgg=AREA[1]),
                ]
            )
            await s.commit()
        except Exception:
            await s.rollback()
            files_service.discard(row)  # 업체 행을 못 만들었으면 등록증 파일도 남기지 않는다
            raise
    else:
        await s.commit()
    if not await vendor_repo.price_sets(s, [user.id], trade, ("confirmed",)):
        if not await vendor_repo.price_files(
            s, [user.id], trade
        ):  # 단가 확인에 꼭 필요한 근거 파일
            doc = files_service.Prepared(
                kind="price_doc",
                data=PRICE_PDF,
                content_type="application/pdf",
                filename="단가표.pdf",
            )
            row = await files_service.persist(s, user.id, doc)
            await s.commit()
            await vendor_service.add_price_file(s, user, PriceFileIn(file_id=row.id, trade=trade))
        lines = [PriceLineIn(key=k, unit_price=v) for k, v in prices.items()]
        if trade == "dobae" and "primer" not in prices:
            lines.append(PriceLineIn(key="primer", included_in="paper_basic"))
        await vendor_service.save_prices(s, user, trade, PriceSetIn(lines=lines))
        await vendor_service.confirm_prices(s, user, trade)
    return user


async def _ask(s, customer: User, pid, trade: str, vendors: list[User], today: date) -> list:
    """실측 요청(연락처 보냄). 업체 순서대로 요청 id"""
    ids = [v.id for v in vendors]
    data = VisitCreateIn(
        trade=trade,
        vendor_ids=ids,
        share_contact_ids=ids,
        apt_name="시연아파트",
        dong="101",
        ho="1203",
        consent_ver=visit_service.CONSENT_VER,
    )
    out = await visit_service.request_visits(s, customer, pid, data, today)
    if out.failed:
        raise RuntimeError("시연 업체에 실측을 요청하지 못했어요.")
    by_vendor = {v.vendor_id: v.id for v in out.created}
    return [by_vendor[i] for i in ids]


async def _quote(s, vendor: User, visit_id, amount: int, vat_mode: str, today: date) -> None:
    f = files_service.Prepared(
        kind="quote_doc", data=QUOTE_PDF, content_type="application/pdf", filename="실측견적서.pdf"
    )
    row = await files_service.persist(s, vendor.id, f)
    await s.commit()
    data = QuoteDraftIn(
        file_ids=[row.id],
        measured_on=today,
        entered_amount=amount,
        vat_mode=vat_mode,
        days=3,
        valid_until=today + timedelta(days=14),
    )
    await visit_service.save_quote(s, vendor, visit_id, data, today)
    await visit_service.send_quote(s, vendor, visit_id, today)


async def _dates(s, customer: User, pid, visit_id, vendor: User, days: list[date], today: date):
    """확정 → 업체가 공사 날짜 냄. (확정 id, 낸 날짜 id)"""
    deal = (
        await schedule_service.confirm(s, customer, pid, visit_id, ConfirmIn(seen_ver=1), today)
    ).deal
    dates = DatesIn(start=days[0], end=days[-1], crew=2, method="app")
    job = await schedule_service.propose_dates(s, vendor, deal.id, dates, today)
    return deal.id, job.proposal.id


async def build(password: str, today: date) -> dict[str, str]:
    """단계 코드 → 새로 만든 프로젝트 번호(MJ-…)"""
    try:
        async with SessionLocal() as s:
            first_admin = select(User).where(User.role == "admin").order_by(User.created_at)
            admin = await s.scalar(first_admin.limit(1))
            if admin is None:
                raise RuntimeError("업체 승인자로 남길 관리자 계정이 먼저 있어야 해요.")
            email, name, phone = CUSTOMER
            customer = await _user(s, email, name, password, "customer", phone)
            await s.commit()
            d1, d2, mok = [await _vendor(s, e, password, admin, today) for e in (D1, D2, MOK)]
            off = days_off(today, today + timedelta(days=400))
            made = {}

            async def new(stage: str, both: bool = False):
                p = await project_service.create(s, customer, _project(today, both), today)
                made[stage] = p.code
                return p.id

            await new("pick", both=True)

            pid = await new("visit_requested")
            await _ask(s, customer, pid, "dobae", [d1, d2], today)

            pid = await new("quotes_arrived")
            va, vb = await _ask(s, customer, pid, "dobae", [d1, d2], today)
            await _quote(s, d1, va, 3_080_000, "excluded", today)
            await _quote(s, d2, vb, 3_300_000, "included", today)

            pid = await new("dates_received")
            (va,) = await _ask(s, customer, pid, "dobae", [d1], today)
            await _quote(s, d1, va, 3_080_000, "excluded", today)
            await _dates(
                s, customer, pid, va, d1, workdays(today + timedelta(days=28), 3, off), today
            )

            pid = await new("before_work", both=True)
            (vm,) = await _ask(s, customer, pid, "mokgong", [mok], today)
            (vd,) = await _ask(s, customer, pid, "dobae", [d1], today)
            await _quote(s, mok, vm, 1_450_000, "excluded", today)
            await _quote(s, d1, vd, 3_080_000, "excluded", today)
            mok_days = workdays(today + timedelta(days=28), 2, off)
            dobae_days = workdays(mok_days[-1] + timedelta(days=3), 3, off)
            seen = 0
            for visit_id, vendor, days in ((vm, mok, mok_days), (vd, d1, dobae_days)):
                deal_id, prop_id = await _dates(s, customer, pid, visit_id, vendor, days, today)
                out = await schedule_service.accept_dates(
                    s, customer, pid, deal_id, prop_id, AcceptIn(seen_version=seen), today
                )
                seen = out.final_version
    finally:
        await engine.dispose()  # 한 번 돌고 끝나는 스크립트 · 시험이 이벤트 루프를 새로 만든다
    return made


LABEL = {
    "pick": "업체 고르기",
    "visit_requested": "실측 요청",
    "quotes_arrived": "견적서 옴",
    "dates_received": "공사 날짜 옴",
    "before_work": "확정 공정표",
}


def main() -> None:
    if settings.app_env == "production":
        raise SystemExit("시연 데이터는 운영(APP_ENV=production)에서 만들지 않아요.")
    password = os.environ.get("DEMO_PASSWORD", "")
    if len(password) < 8:
        raise SystemExit("DEMO_PASSWORD에 8자 이상 비밀번호를 넣어 주세요.")
    made = asyncio.run(build(password, today_seoul()))
    for stage, label in LABEL.items():
        print(f"만들었어요: {label} {made[stage]}")


if __name__ == "__main__":
    main()
