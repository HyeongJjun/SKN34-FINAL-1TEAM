"""로컬 개발용 시험 계정을 만든다. APP_ENV=local에서만 돈다.

.env에 SEED_PASSWORD가 있으면 docker compose up 때 migrate 뒤에 자동으로 돈다 (compose.override.yaml).
손으로 다시 돌릴 때: docker compose exec api python -m app.seed
관리자 · 고객 · 업체(승인) · 업체(승인 대기) 4개를 만들고, 이미 있으면 건너뛴다.
비밀번호는 넷이 같고 SEED_PASSWORD에서 읽는다. 손으로 돌릴 때 비어 있으면 입력받는다. 화면에 찍지 않는다.
시험 업체에는 상호 · 연락 방식 · 공정 · 지역(서울 모든 구)을 채워서 업체 고르기 목록에 바로 나오게 한다.
예전에 만든 시험 계정이라 이 칸들이 비어 있으면 빈 칸만 채운다(고객 휴대폰도 같다).
"""

import asyncio
import getpass
import os
import sys
from datetime import time

from sqlalchemy import select

from app.auth import repository as auth_repo
from app.auth import service as auth_service
from app.config import settings
from app.db import SessionLocal, engine
from app.files import service as files_service
from app.shared.clock import now_utc
from app.shared.regions import SGG
from app.vendor.models import Vendor, VendorArea, VendorReview, VendorTrade

# (이메일, 이름, 역할, 업체 상태). 관리자를 먼저 만들어야 업체 승인자로 남길 수 있다.
ACCOUNTS = [
    ("admin@mitjip.local", "관리자", "admin", None),
    ("customer@mitjip.local", "시험 고객", "customer", None),
    ("vendor@mitjip.local", "시험 업체", "vendor", "approved"),
    ("vendor-pending@mitjip.local", "승인 대기 업체", "vendor", "pending"),
]
# 시험용 휴대폰 번호 · 사업자번호(실제로 없는 값). 고객 번호는 실측 요청 때 연락처 보내기를 시험하는 데 쓴다
CUSTOMER_PHONE = "01000000000"
VENDOR_INFO = {
    "vendor@mitjip.local": {
        "biz_name": "시험인테리어",
        "owner_name": "김시험",
        "biz_no": "9990000001",
        "phone": "01000000001",
    },
    "vendor-pending@mitjip.local": {
        "biz_name": "심사대기인테리어",
        "owner_name": "이대기",
        "biz_no": "9990000002",
        "phone": "01000000002",
    },
}
VENDOR_TRADES = ("dobae", "mokgong")
VENDOR_AREAS = [("seoul", sgg) for sgg in sorted(SGG["seoul"])]


def sample_pdf(line: bytes = b"TEST ONLY - not a real business license") -> bytes:
    """한 줄짜리 한 쪽 시험용 PDF. 기본은 업체 가입에 꼭 필요한 사업자등록증 자리('TEST ONLY')."""
    text = b"BT /F1 18 Tf 30 70 Td (%s) Tj ET" % line
    objs = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        (
            b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 480 160] /Contents 4 0 R"
            b" /Resources << /Font << /F1 5 0 R >> >> >>"
        ),
        b"<< /Length %d >>\nstream\n%s\nendstream" % (len(text), text),
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    out, offsets = b"%PDF-1.4\n", []
    for i, obj in enumerate(objs, 1):
        offsets.append(len(out))
        out += b"%d 0 obj\n%s\nendobj\n" % (i, obj)
    xref = len(out)
    out += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objs) + 1)
    out += b"".join(b"%010d 00000 n \n" % o for o in offsets)
    out += b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (len(objs) + 1, xref)
    return out


LICENSE = sample_pdf()


async def seed(password: str) -> list[tuple[str, bool]]:
    """계정마다 (이메일, 새로 만들었는지)를 돌려준다."""
    done: list[tuple[str, bool]] = []
    admin_id = None
    async with SessionLocal() as s:
        for email, name, role, status in ACCOUNTS:
            user = await auth_repo.user_by_email(s, email)
            made = user is None
            if user is None:
                phone = CUSTOMER_PHONE if role == "customer" else None
                user = await auth_service.create_user(
                    s, email=email, name=name, password=password, role=role, phone=phone
                )
                if role == "vendor":
                    await _add_vendor(s, user.id, status, admin_id)
            elif role == "customer" and not user.phone:
                user.phone = CUSTOMER_PHONE
            if role == "vendor":
                await _fill_vendor(s, user.id, email)
            await s.commit()
            done.append((email, made))
            if role == "admin":
                admin_id = user.id
    await engine.dispose()
    return done


async def _add_vendor(s, user_id, status: str, admin_id) -> None:
    lic = files_service.Prepared(
        kind="license",
        data=LICENSE,
        content_type="application/pdf",
        filename="시험용-사업자등록증.pdf",
    )
    row = await files_service.persist(s, user_id, lic)
    approved = status == "approved"
    now = now_utc()
    try:
        s.add(
            Vendor(
                user_id=user_id,
                license_file_id=row.id,
                status=status,
                reviewed_by=admin_id if approved else None,
                reviewed_at=now if approved else None,
                approved_at=now if approved else None,
            )
        )
        await s.flush()
        s.add(VendorReview(vendor_id=user_id, action="apply", by_id=user_id, at=now))
        if approved:
            s.add(VendorReview(vendor_id=user_id, action="approve", by_id=admin_id, at=now))
        await s.flush()
    except Exception:
        files_service.discard(row)  # 업체 행을 못 만들었으면 등록증 파일도 남기지 않는다
        raise


async def _fill_vendor(s, user_id, email: str) -> None:
    """시험 업체의 상호 · 연락 방식 · 공정 · 지역을 채운다. 상호가 이미 있으면 손대지 않는다."""
    v = await s.get(Vendor, user_id)
    if v is None or v.biz_name:
        return
    for key, value in VENDOR_INFO[email].items():
        setattr(v, key, value)
    v.address = "서울 노원구 (시험용 주소)"
    v.contact_method = "phone"
    v.call_start, v.call_end = time(9), time(18)
    v.visit_fee = 0
    have_t = set(
        (
            await s.execute(select(VendorTrade.trade).where(VendorTrade.vendor_id == user_id))
        ).scalars()
    )
    s.add_all(VendorTrade(vendor_id=user_id, trade=t) for t in VENDOR_TRADES if t not in have_t)
    have_a = set(
        (
            await s.execute(
                select(VendorArea.sido, VendorArea.sgg).where(VendorArea.vendor_id == user_id)
            )
        ).all()
    )
    s.add_all(
        VendorArea(vendor_id=user_id, sido=sido, sgg=sgg)
        for sido, sgg in VENDOR_AREAS
        if (sido, sgg) not in have_a
    )
    await s.flush()


def main(argv: list[str]) -> None:
    """--auto: docker compose up 때 migrate가 부른다. 만들 수 없으면 알리고 넘어간다(api가 뜨는 것을 막지 않게)."""
    auto = "--auto" in argv

    def stop(msg: str) -> None:
        if not auto:
            raise SystemExit(msg)
        print(f"{msg} 시험 계정은 만들지 않았어요.")

    if settings.app_env != "local":
        return stop("시험 계정은 로컬(APP_ENV=local)에서만 만들 수 있어요.")
    password = os.environ.get("SEED_PASSWORD", "")
    if not password and auto:
        return stop(".env의 SEED_PASSWORD가 비어 있어요.")
    password = password or getpass.getpass("시험 계정 비밀번호 (8자 이상): ")
    if len(password) < 8:
        return stop("비밀번호는 8자 이상이어야 해요.")
    try:
        done = asyncio.run(seed(password))
    except Exception as exc:
        if not auto:
            raise
        return stop(f"시험 계정을 만들다 오류가 났어요 ({type(exc).__name__}).")
    for email, made in done:
        print(f"{'만들었어요' if made else '이미 있어요'}: {email}")


if __name__ == "__main__":
    main(sys.argv[1:])
