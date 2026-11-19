"""보안 테스트가 같이 쓰는 것 (합성 데이터만)."""

import asyncio
import io
import uuid
from contextlib import asynccontextmanager

import pillow_heif
from fastapi import FastAPI, UploadFile
from PIL import ExifTags, Image
from redis.asyncio import Redis
from redis.exceptions import ConnectionError as RedisConnectionError

from app.files import service as files_service
from app.shared import ratelimit
from app.shared.errors import AppError, app_error_handler
from tests.conftest import REDIS_URL

pillow_heif.register_heif_opener()


class DownRedis:
    """연결이 안 되는 Redis. 요청 제한이 Redis 없이 어떻게 구는지 본다."""

    def pipeline(self, *_a, **_k):
        raise RedisConnectionError("시험: Redis가 멈췄어요")

    async def delete(self, *_a, **_k):
        raise RedisConnectionError("시험: Redis가 멈췄어요")

    async def zrem(self, *_a, **_k):
        raise RedisConnectionError("시험: Redis가 멈췄어요")


def with_redis(monkeypatch, fn):
    """ratelimit을 새 Redis 연결로 한 이벤트 루프 안에서 돌린다(앱 TestClient의 연결과 섞지 않게)."""

    async def main():
        client = Redis.from_url(REDIS_URL)
        monkeypatch.setattr(ratelimit, "redis", client)
        try:
            return await fn()
        finally:
            await client.aclose()

    return asyncio.run(main())


def mini_app(monkeypatch, *middleware) -> FastAPI:
    """미들웨어만 붙인 작은 앱. 요청 제한은 그 앱의 이벤트 루프에서 만든 새 Redis 연결로 센다."""

    @asynccontextmanager
    async def life(_):
        client = Redis.from_url(REDIS_URL)
        monkeypatch.setattr(ratelimit, "redis", client)
        yield
        await client.aclose()

    app = FastAPI(lifespan=life)
    app.add_exception_handler(AppError, app_error_handler)
    for m in middleware:
        app.add_middleware(m)
    return app


def gps_exif() -> Image.Exif:
    """휴대폰 사진처럼 위치(GPS) · 기기 이름이 든 EXIF (합성 좌표)"""
    exif = Image.Exif()
    exif[ExifTags.Base.Make] = "ExamplePhone"
    gps = exif.get_ifd(ExifTags.IFD.GPSInfo)
    gps[ExifTags.GPS.GPSLatitudeRef] = "N"
    gps[ExifTags.GPS.GPSLatitude] = (37.0, 33.0, 30.0)
    gps[ExifTags.GPS.GPSLongitudeRef] = "E"
    gps[ExifTags.GPS.GPSLongitude] = (126.0, 54.0, 10.0)
    return exif


def photo_with_gps(fmt: str) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (40, 20), (90, 140, 200)).save(buf, fmt, exif=gps_exif())
    return buf.getvalue()


def prepare(kind: str, data: bytes, name: str = "a.jpg") -> files_service.Prepared:
    """POST /files가 저장 전에 하는 검사 · 위치 정보 지우기만 돌린다(DB를 쓰지 않는다)."""
    upload = UploadFile(io.BytesIO(data), filename=name)
    return asyncio.run(files_service.prepare(kind, upload))


def random_id() -> str:
    return str(uuid.uuid4())
