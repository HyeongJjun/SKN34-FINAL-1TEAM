from app.config import settings
from tests.conftest import query
from tests.helpers import JPEG, PASSWORD, biz_no_for, make_admin, signup, use, vendor_signup


def test_vendor_applies_with_form_and_license_and_waits(api):
    r = vendor_signup(api, biz_no="214-86-03518", trades=["dobae", "mokgong"])
    assert r.status_code == 201, r.text
    me = r.json()
    assert me["role"] == "vendor" and me["vendor_status"] == "pending"
    assert me["name"] == "예시 담당자" and me["phone"] == "01012345678"
    (v,) = query("select biz_name, owner_name, biz_no, phone, status from vendors")
    assert dict(v) == {
        "biz_name": "예시도배",
        "owner_name": "예시 대표",
        "biz_no": "2148603518",
        "phone": "01012345678",
        "status": "pending",
    }
    assert {r["trade"] for r in query("select trade from vendor_trades")} == {"dobae", "mokgong"}
    assert {r["sgg"] for r in query("select sgg from vendor_areas")} == {"노원구", "도봉구"}
    (h,) = query("select action, by_id, code, changes from vendor_reviews")
    assert h["action"] == "apply" and h["by_id"] is not None and h["changes"] is None
    assert api.get("/me").json()["vendor_status"] == "pending"


def test_signup_checks_input_and_license(api):
    assert vendor_signup(api, license=None).status_code == 422  # 사업자등록증 없음
    short = vendor_signup(api, password="short")
    assert short.status_code == 422 and short.json()["error"]["fields"][0]["loc"] == ["password"]
    assert vendor_signup(api, license=("a.txt", b"not a license")).status_code == 415
    for bad in ({"biz_no": "12345"}, {"trades": ["floor"]}, {"biz_name": "  "}, {"phone": "02-1"}):
        assert vendor_signup(api, **bad).status_code == 422, bad
    region = vendor_signup(api, areas=["seoul/없는구"])
    assert region.status_code == 422 and region.json()["error"]["code"] == "region"
    owner_only = vendor_signup(api, name="")  # 담당자 이름을 비우면 대표자 이름으로
    assert owner_only.status_code == 201 and owner_only.json()["name"] == "예시 대표"
    again = vendor_signup(api, biz_no="9999999999")  # 이메일만 같다
    assert again.status_code == 409 and again.json()["error"]["code"] == "email_taken"
    same_no = vendor_signup(api, email="other@mitjip.test", biz_no=biz_no_for("vendor@mitjip.test"))
    assert same_no.status_code == 409 and same_no.json()["error"]["code"] == "biz_no_taken"
    assert (
        vendor_signup(api, email="jpg@mitjip.test", license=("등록증.jpg", JPEG)).status_code == 201
    )
    assert query("select count(*) n from files")[0]["n"] == 2  # 실패한 신청은 파일을 남기지 않는다


def test_only_admin_sees_vendor_applications(api):
    signup(api, "c@mitjip.test")
    assert api.get("/admin/vendors").status_code == 403
    api.cookies.clear()
    assert api.get("/admin/vendors").status_code == 401


def test_license_file_is_private(api):
    vendor_signup(api)
    vendor_token = api.cookies.get(settings.session_cookie)
    make_admin(api)
    lic = api.get("/admin/vendors").json()[0]["license_file_id"]
    assert api.get(f"/files/{lic}").status_code == 200  # 관리자
    use(api, vendor_token)
    assert api.get(f"/files/{lic}").status_code == 200  # 그 업체
    signup(api, "stranger@mitjip.test")
    assert api.get(f"/files/{lic}").status_code == 404  # 다른 회원은 있는지도 모른다
    assert PASSWORD


def test_removing_the_reviewing_admin_keeps_the_approval(api):
    vendor_signup(api)
    make_admin(api)
    vid = api.get("/admin/vendors").json()[0]["user_id"]
    assert api.post(f"/admin/vendors/{vid}/review", json={"action": "approve"}).status_code == 200
    query("delete from users where role = 'admin'")
    (row,) = query("select status, reviewed_by from vendors")
    assert row["status"] == "approved" and row["reviewed_by"] is None
    by = query("select by_id from vendor_reviews where action = 'approve'")
    assert by[0]["by_id"] is None  # 처리 기록은 남고 누가 했는지만 비운다
