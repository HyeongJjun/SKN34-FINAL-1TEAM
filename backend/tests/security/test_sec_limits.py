"""T04 본문 · 파일 한도 (security.md IN-01 · FI-01). 경로 무늬 한도와 v3 새 파일 종류."""

import pytest

from app.files import service as files_service
from app.files.models import KINDS
from app.shared import request_guards as guards
from app.shared.errors import AppError
from tests.helpers import JPEG, PDF, signup, upload, vendor_signup
from tests.security.sec_util import prepare

KB = 1024


@pytest.mark.parametrize(
    ("path", "limit"),
    [
        ("/guest/standard", 4 * KB),
        ("/guest/standard/", 4 * KB),  # 끝 빗금도 같은 한도
        ("/threads/0190f0c2-aaaa-7bbb-8ccc-1234567890ab/messages", 8 * KB),
        ("/threads/abc/messages/", 8 * KB),
        ("/ai/turns", 16 * KB),
        ("/files", 21 * 1024 * KB),
        ("/auth/vendor-signup", 11 * 1024 * KB),
        ("/threads/abc/read", guards.DEFAULT_LIMIT),  # 무늬는 한 칸만 맞는다
        ("/threads/a/b/messages", guards.DEFAULT_LIMIT),
        ("/threads//messages", guards.DEFAULT_LIMIT),
        ("/x/threads/abc/messages", guards.DEFAULT_LIMIT),
        ("/projects", guards.DEFAULT_LIMIT),
    ],
)
def test_limit_follows_the_path_shape(path, limit):
    assert guards.limit_for(path) == limit


@pytest.mark.parametrize(
    ("path", "limit"),
    [("/guest/standard", 4 * KB), ("/threads/abc/messages", 8 * KB), ("/ai/turns", 16 * KB)],
)
def test_new_paths_refuse_big_bodies_before_reading(api, path, limit):
    """경로가 아직 없어도(뼈대 전) 본문 한도는 경로를 고르기 전에 걸린다."""
    over = api.post(path, content=b"x" * (limit + 1), headers={"content-type": "application/json"})
    assert over.status_code == 413 and over.json()["error"]["code"] == "too_large"
    at = api.post(path, content=b"x" * limit, headers={"content-type": "application/json"})
    assert at.status_code != 413


def test_every_db_kind_has_a_rule_and_uploaders():
    assert set(KINDS) <= set(files_service.RULES) == set(files_service.UPLOADERS)
    assert {"chat_photo", "review_photo", "done_photo"} <= set(files_service.RULES)


@pytest.mark.parametrize("kind", ["chat_photo", "review_photo", "done_photo"])
def test_new_photo_kinds_take_only_images_up_to_10mb(kind, monkeypatch):
    allowed, limit = files_service.RULES[kind]
    assert allowed == files_service.IMAGES and limit == 10 * 1024 * KB
    assert prepare(kind, JPEG).content_type == "image/jpeg"
    for bad, status in ((PDF, 415), (b"<svg onload=alert(1)>", 415), (b"", 422)):
        with pytest.raises(AppError) as e:
            prepare(kind, bad, "a.jpg")
        assert e.value.status == status
    monkeypatch.setitem(files_service.RULES, kind, (files_service.IMAGES, 100))
    with pytest.raises(AppError) as e:
        prepare(kind, JPEG)
    assert e.value.status == 413 and e.value.code == "file_too_big"


def test_new_kinds_check_who_uploads(api):
    api.cookies.clear()
    assert upload(api, kind="chat_photo").status_code == 401
    signup(api)
    assert upload(api, kind="done_photo").status_code == 403  # 공사 끝 사진은 업체만
    vendor_signup(api)
    assert upload(api, kind="review_photo").status_code == 403  # 리뷰 사진은 고객만
    assert files_service.UPLOADERS["chat_photo"] == {"customer", "vendor"}


def test_unknown_kind_is_422_before_reading(api):
    signup(api)
    r = upload(api, kind="../license")
    assert r.status_code == 422 and r.json()["error"]["code"] == "file_kind"
