"""테스트에서 함께 쓰는 합성 데이터와 동작 (실제 사람 · 업체 정보 아님)."""

import asyncio
import hashlib
import io

from PIL import Image

from app.config import settings

PASSWORD = "test-pass-1234"
PHONE = "01012345678"


def image_bytes(fmt: str = "JPEG", size: tuple[int, int] = (40, 20), **save) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", size, (200, 120, 80)).save(buf, fmt, **save)
    return buf.getvalue()


JPEG = image_bytes("JPEG")
PNG = image_bytes("PNG")
PDF = b"%PDF-1.4\n" + b"0" * 64


def signup(api, email: str = "customer@mitjip.test", name: str = "고객") -> str:
    api.cookies.clear()
    body = {"name": name, "email": email, "password": PASSWORD, "phone": PHONE}
    r = api.post("/auth/signup", json=body)
    assert r.status_code == 201, r.text
    return api.cookies.get(settings.session_cookie)


def use(api, token: str) -> None:
    api.cookies.clear()
    api.cookies.set(settings.session_cookie, token)


def make_admin(api, email: str = "admin@mitjip.test") -> str:
    from app.auth.cli import create_admin

    asyncio.run(create_admin(email, "관리자", PASSWORD))
    api.cookies.clear()
    r = api.post("/auth/login", json={"email": email, "password": PASSWORD})
    assert r.status_code == 200, r.text
    return api.cookies.get(settings.session_cookie)


def biz_no_for(email: str) -> str:
    """이메일마다 다른 합성 사업자등록번호 10자리 (실제 번호 아님)"""
    return f"{int(hashlib.sha256(email.encode()).hexdigest(), 16) % 10**10:010d}"


def vendor_signup(api, license=("사업자등록증.pdf", PDF), **over):
    """업체 가입 신청: 신청서 + 사업자등록증. license=None이면 파일 없이 보낸다."""
    api.cookies.clear()
    email = over.pop("email", "vendor@mitjip.test")
    data = {
        "name": "예시 담당자",
        "email": email,
        "password": PASSWORD,
        "biz_name": "예시도배",
        "owner_name": "예시 대표",
        "biz_no": biz_no_for(email),
        "phone": PHONE,
        "trades": ["dobae"],
        "areas": ["seoul/노원구", "seoul/도봉구"],
        **over,
    }
    files = (
        {"license_file": (license[0], license[1], "application/octet-stream")} if license else None
    )
    return api.post("/auth/vendor-signup", data=data, files=files)


def upload(api, kind: str = "photo", content: bytes = JPEG, name: str = "living.jpg"):
    return api.post(
        "/files", data={"kind": kind}, files={"file": (name, content, "application/octet-stream")}
    )


def no_surprises(results: list) -> list:
    """동시 시험 결과: AppError가 아닌 예외(교착 · 처리 못 한 오류)는 숨기지 않고 그대로 던진다."""
    from app.shared.errors import AppError

    for r in results:
        if isinstance(r, BaseException) and not isinstance(r, AppError):
            raise r
    return results
