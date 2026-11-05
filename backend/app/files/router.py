import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Form, UploadFile
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import current_user
from app.auth.models import User
from app.db import get_session
from app.files import service
from app.files.schemas import FileOut
from app.shared.errors import AppError

router = APIRouter(tags=["파일"])


@router.post(
    "/files",
    status_code=201,
    response_model=FileOut,
    summary="파일 올리기 (공간 사진 · 도면 · 시공 사진 · 견적서 · 단가표 · 공사 사진)",
)
async def upload(
    kind: Annotated[str, Form()],
    file: UploadFile,
    user: User = Depends(current_user),
    s: AsyncSession = Depends(get_session),
) -> FileOut:
    row = await service.upload_by(s, user, kind, file)
    return FileOut.model_validate(row, from_attributes=True)


@router.get("/files/{file_id}", summary="파일 보기 (올린 사람 · 관리자)")
async def download(
    file_id: uuid.UUID, user: User = Depends(current_user), s: AsyncSession = Depends(get_session)
) -> Response:
    f = await service.readable(s, user, file_id)
    if f is None:  # 남의 파일은 있는지조차 알려 주지 않는다
        raise AppError(404, "not_found", "파일을 찾을 수 없어요.")
    return await service.respond(f)
