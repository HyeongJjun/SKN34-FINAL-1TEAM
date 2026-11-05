"""파일 올리기 · 읽기 권한. 형식은 이름표(Content-Type)가 아니라 파일 앞부분 바이트로 확인한다.

사진은 저장하기 전에 위치 정보(GPS) · EXIF를 지운다 (images.py). 원본은 남기지 않는다.
"""

import hashlib
import io
import logging
import re
import uuid
import zipfile
import zlib
from dataclasses import dataclass
from urllib.parse import quote

from botocore.exceptions import BotoCoreError, ClientError
from fastapi import UploadFile
from fastapi.responses import FileResponse, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.auth.models import User
from app.config import settings
from app.files import images, storage
from app.files.models import File
from app.shared import ratelimit
from app.shared.errors import AppError

log = logging.getLogger(__name__)
MB = 1024 * 1024
IMAGES = {"image/jpeg", "image/png", "image/webp", "image/heic"}
XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
DOCS = {"application/pdf", XLSX, "image/jpeg", "image/png", "image/heic"}
# 종류별로 받는 형식과 최대 크기
RULES: dict[str, tuple[set[str], int]] = {
    "photo": (IMAGES, 10 * MB),
    "plan": (IMAGES | {"application/pdf"}, 20 * MB),
    "license": ({"image/jpeg", "image/png", "application/pdf"}, 10 * MB),
    "portfolio": ({"image/jpeg", "image/png", "image/webp"}, 10 * MB),
    "price_doc": (DOCS, 20 * MB),
    "quote_doc": (DOCS, 20 * MB),
    "work_photo": (IMAGES, 10 * MB),
}
# 누가 어떤 종류를 올릴 수 있는지
UPLOADERS: dict[str, set[str]] = {
    "photo": {"customer"},
    "plan": {"customer"},
    "license": {"vendor"},
    "portfolio": {"vendor"},
    "price_doc": {"vendor"},
    "quote_doc": {"vendor"},
    "work_photo": {"vendor"},
}

_XLSX_MAIN = b"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"
_MACRO = ("vbaproject.bin", "xl/macrosheets/")
_TYPES_MAX = 256 * 1024
_ZIP_ERRORS = (
    zipfile.BadZipFile,
    KeyError,
    RuntimeError,
    NotImplementedError,
    EOFError,
    ValueError,
    OSError,
    zlib.error,
)


def _is_xlsx(data: bytes) -> bool:
    """엑셀 통합 문서(xlsx)인지 본다: 목차([Content_Types].xml)가 일반 통합 문서이고 xl/ 폴더가 있다.

    매크로 파일(xlsm · vbaProject · 매크로 시트) · 서식 파일(xltx)은 받지 않는다.
    목차 한 개만 풀어 본다(크기를 먼저 봐서 압축 폭탄을 풀지 않는다).
    """
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            names = z.namelist()
            info = z.getinfo("[Content_Types].xml")
            if info.file_size > _TYPES_MAX or not any(n.startswith("xl/") for n in names):
                return False
            if any(m in n.lower() for n in names for m in _MACRO):
                return False
            with z.open(info) as f:
                types = f.read(_TYPES_MAX + 1)
    except _ZIP_ERRORS:
        return False
    return _XLSX_MAIN in types and b"macroenabled" not in types.lower()


def sniff(data: bytes) -> str | None:
    """파일 앞부분 바이트로 형식을 본다. 엑셀은 ZIP 안의 목차까지 확인한다."""
    head = data[:16]
    if head.startswith(b"PK\x03\x04"):
        return XLSX if _is_xlsx(data) else None
    if head.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "image/webp"
    if head[4:8] == b"ftyp" and head[8:12] in (b"heic", b"heix", b"mif1", b"msf1", b"hevc"):
        return "image/heic"
    if head.startswith(b"%PDF-"):
        return "application/pdf"
    return None


def clean_filename(name: str | None) -> str:
    base = re.split(r"[\\/]", name or "")[-1]
    base = re.sub(r"[\x00-\x1f\x7f]", "", base).strip()
    return base[:200] or "file"


@dataclass
class Prepared:
    """검사하고 위치 정보를 지운, 아직 저장하지 않은 파일"""

    kind: str
    data: bytes
    content_type: str
    filename: str


async def prepare(kind: str, upload: UploadFile) -> Prepared:
    """형식 · 크기를 검사하고 사진의 위치 정보를 지운다. DB를 쓰지 않는다 (느린 일을 트랜잭션 밖에서)."""
    if kind not in RULES:
        raise AppError(422, "file_kind", "파일 종류가 맞지 않아요.")
    allowed, limit = RULES[kind]
    data = await upload.read(limit + 1)
    if not data:
        raise AppError(422, "file_empty", "빈 파일이에요.")
    if len(data) > limit:
        raise AppError(413, "file_too_big", f"{limit // MB}MB까지 올릴 수 있어요.")
    ctype = await run_in_threadpool(sniff, data)  # 엑셀은 ZIP 목차를 읽는다
    if ctype not in allowed:
        raise AppError(415, "file_type", "이 형식의 파일은 올릴 수 없어요.")
    name = clean_filename(upload.filename)
    if ctype in IMAGES:
        try:
            # 그림 처리는 CPU를 쓰므로 요청 처리 흐름을 막지 않게 따로 돌린다
            data, out_type = await run_in_threadpool(images.clean, data, ctype)
        except images.BadImage as exc:
            raise AppError(
                422, "file_broken", "사진을 열 수 없어요. 다른 파일로 올려 주세요."
            ) from exc
        if out_type != ctype:  # HEIC → JPEG
            name = re.sub(r"\.(heic|heif)$", "", name, flags=re.IGNORECASE) + ".jpg"
            ctype = out_type
    return Prepared(kind=kind, data=data, content_type=ctype, filename=name)


async def persist(s: AsyncSession, owner_id: uuid.UUID, f: Prepared) -> File:
    """디스크에 쓰고 파일 행을 더한다. commit은 부르는 쪽이 하고, 실패하면 discard로 디스크 파일을 지운다."""
    key = await run_in_threadpool(storage.save, f.data)
    row = File(
        owner_id=owner_id,
        kind=f.kind,
        storage_key=key,
        filename=f.filename,
        content_type=f.content_type,
        size=len(f.data),
        sha256=hashlib.sha256(f.data).hexdigest(),
    )
    s.add(row)
    try:
        await s.flush()
    except Exception:
        storage.remove(key)
        raise
    return row


def discard(row: File) -> None:
    """DB에 넣지 못한 파일을 디스크에서도 지운다 (주인 없는 파일을 남기지 않음)."""
    storage.remove(row.storage_key)


async def drop(s: AsyncSession, owner_id: uuid.UUID, file_id: uuid.UUID) -> str | None:
    """내 파일 행을 지우고 저장 위치를 돌려준다. commit은 부르는 쪽이 하고, 그 뒤 remove_stored를 부른다."""
    row = await s.get(File, file_id)
    if row is None or row.owner_id != owner_id:
        return None
    await s.delete(row)
    return row.storage_key


async def remove_stored(key: str) -> None:
    """commit 뒤에 저장소의 내용을 지운다. 못 지우면 기록만 남긴다(DB에는 이미 없다)."""
    try:
        await run_in_threadpool(storage.remove, key)
    except (OSError, BotoCoreError, ClientError):  # 남은 내용은 정리 작업이 지운다
        log.error("지운 파일의 내용을 저장소에서 지우지 못했어요")


UPLOADS_PER_HOUR = 120


async def upload_by(s: AsyncSession, user: User, kind: str, upload: UploadFile) -> File:
    if kind not in RULES:
        raise AppError(422, "file_kind", "파일 종류가 맞지 않아요.")
    if user.role not in UPLOADERS[kind]:
        raise AppError(403, "forbidden", "이 종류의 파일을 올릴 권한이 없어요.")
    await ratelimit.hit(
        ratelimit.key("upload", str(user.id)),
        UPLOADS_PER_HOUR,
        3600,
        "파일을 너무 많이 올렸어요. 잠시 뒤에 다시 해 주세요.",
    )
    await s.commit()  # 로그인 확인에 쓴 DB 연결을 돌려준다 (사진 처리 동안 붙잡지 않게)
    prepared = await prepare(kind, upload)
    row = await persist(s, user.id, prepared)
    try:
        await s.commit()
    except Exception:
        discard(row)
        raise
    return row


async def readable(s: AsyncSession, user: User, file_id: uuid.UUID) -> File | None:
    """볼 수 있는 파일만 돌려준다: 올린 사람, 관리자. (견적을 요청받은 업체는 가견적 기능에서 더한다)"""
    f = await s.get(File, file_id)
    if f is None:
        return None
    if f.owner_id == user.id or user.role == "admin":
        return f
    return None


async def respond(f: File) -> Response:
    """파일 내용을 내준다. 볼 권한은 부르는 쪽(파일 · 업체 자세히 router)이 먼저 확인한다."""
    headers = {
        "Content-Disposition": f"inline; filename*=UTF-8''{quote(f.filename)}",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
        # 올린 파일 안의 스크립트가 우리 주소에서 돌지 못하게 (PDF · SVG 같은 것)
        "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    }
    if settings.files_s3_bucket:
        try:
            data = await run_in_threadpool(storage.read, f.storage_key)
        except FileNotFoundError as exc:
            log.error("파일 행은 있는데 S3에 없어요: %s", f.id)
            raise AppError(404, "not_found", "파일을 찾을 수 없어요.") from exc
        return Response(data, media_type=f.content_type, headers=headers)
    path = storage.path_of(f.storage_key)
    if not path.is_file():  # DB에는 있는데 디스크에 없다: 볼륨 유실 · 다른 서버
        log.error("파일 행은 있는데 디스크에 없어요: %s", f.id)
        raise AppError(404, "not_found", "파일을 찾을 수 없어요.")
    return FileResponse(path, media_type=f.content_type, headers=headers)


async def owned(
    s: AsyncSession, owner_id: uuid.UUID, ids: list[uuid.UUID], *, lock: bool = False
) -> dict[uuid.UUID, File]:
    """그 회원이 올린 파일. lock이면 행을 잠가 같은 파일을 붙이는 요청이 줄 선다."""
    q = select(File).where(File.id.in_(ids), File.owner_id == owner_id).order_by(File.id)
    if lock:
        q = q.with_for_update()
    return {r.id: r for r in (await s.execute(q)).scalars().all()}


async def storage_keys_of(s: AsyncSession, owner_id: uuid.UUID) -> list[str]:
    """그 회원이 올린 파일의 저장 위치 (탈퇴할 때 디스크에서 지우려고)"""
    return list(
        (await s.execute(select(File.storage_key).where(File.owner_id == owner_id))).scalars()
    )
