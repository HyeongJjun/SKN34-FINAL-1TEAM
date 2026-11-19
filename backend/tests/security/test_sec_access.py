"""T01 남의 것은 404 · T02 역할이 다르면 403 (security.md AC-01 · AC-02 · AC-04 · FI-04)."""

from app.config import settings
from tests.conftest import query
from tests.helpers import make_admin, signup, upload, use, vendor_signup
from tests.security.sec_util import random_id
from tests.test_project import body
from tests.test_vendor_profile import approved_vendor


def test_someone_elses_file_looks_like_a_missing_file(api):
    a = signup(api, "a@mitjip.test")
    fid = upload(api).json()["id"]
    signup(api, "b@mitjip.test")
    theirs, missing = api.get(f"/files/{fid}"), api.get(f"/files/{random_id()}")
    assert theirs.status_code == missing.status_code == 404
    assert theirs.json() == missing.json()  # 있는지조차 알 수 없다
    use(api, a)
    assert api.get(f"/files/{fid}").status_code == 200


def test_license_is_only_for_the_vendor_and_admin(api):
    assert vendor_signup(api, email="x@mitjip.test").status_code == 201
    x = api.cookies.get(settings.session_cookie)
    (row,) = query("select license_file_id id from vendors")
    lic = str(row["id"])
    assert vendor_signup(api, email="y@mitjip.test").status_code == 201
    assert api.get(f"/files/{lic}").status_code == 404  # 다른 업체
    signup(api)
    assert api.get(f"/files/{lic}").status_code == 404  # 고객
    use(api, x)
    assert api.get(f"/files/{lic}").status_code == 200  # 업체 본인
    make_admin(api)
    assert api.get(f"/files/{lic}").status_code == 200  # 관리자


def test_someone_elses_project_is_404(api):
    signup(api, "owner@mitjip.test")
    pid = api.post("/projects", json=body()).json()["id"]
    signup(api, "other@mitjip.test")
    for r in (api.get(f"/projects/{pid}"), api.get(f"/projects/{random_id()}")):
        assert r.status_code == 404 and r.json()["error"]["code"] == "not_found"
    assert api.patch(f"/projects/{pid}", json=body(occupied=False)).status_code == 404
    assert api.get("/projects").json() == []  # 목록에도 없다


def test_roles_are_403_and_anonymous_is_401(api):
    api.cookies.clear()
    assert api.get("/me").status_code == 401
    assert api.get("/admin/vendors").status_code == 401
    signup(api)
    assert api.get("/admin/vendors").status_code == 403
    assert api.get("/vendor/profile").status_code == 403
    vendor_signup(api)  # 아직 승인 전
    pending = api.get("/vendor/profile")
    assert pending.status_code == 403 and pending.json()["error"]["code"] == "vendor_not_approved"
    assert api.get("/admin/vendors").status_code == 403
    approved_vendor(api, "ok@mitjip.test")
    assert api.get("/vendor/profile").status_code == 200
    assert api.get("/admin/vendors").status_code == 403


def test_signup_cannot_pick_its_own_role(api):
    api.cookies.clear()
    r = api.post(
        "/auth/signup",
        json={
            "name": "고객",
            "email": "sneaky@mitjip.test",
            "password": "test-pass-1234",
            "phone": "01012345678",
            "role": "admin",
            "status": "active",
        },
    )
    assert r.status_code == 201 and r.json()["role"] == "customer"
    assert api.get("/admin/vendors").status_code == 403


def test_suspended_account_is_cut_off_at_once(api):
    signup(api, "stop@mitjip.test")
    assert api.get("/me").status_code == 200
    query("update users set status = 'suspended' where email = 'stop@mitjip.test'")
    assert api.get("/me").status_code == 401  # 쓰던 세션도 바로 끊긴다
    api.cookies.clear()
    r = api.post("/auth/login", json={"email": "stop@mitjip.test", "password": "test-pass-1234"})
    assert r.status_code == 403 and r.json()["error"]["code"] == "suspended"


def test_logged_out_cookie_cannot_be_used_again(api):
    token = signup(api)
    assert api.post("/auth/logout").status_code == 204
    use(api, token)  # 지운 세션의 쿠키를 다시 붙여도
    assert api.get("/me").status_code == 401
