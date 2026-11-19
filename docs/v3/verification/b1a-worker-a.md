# B1a 1단계 2차 — 일꾼 A 보고 (리드가 옮겨 적음, 2026-11-19)

일꾼 A가 맡은 것: 계산 · 견적 · 프로젝트 · 단가, 그리고 화면 묶음 · B1b 부탁 1~8.

## 검증 (일꾼이 실제로 돌림)

- 실행 명령: `. .claude/env.sh && export TEST_DB_NAME=mitjip_test_b1a_calc TEST_REDIS_URL=redis://127.0.0.1:6379/7 && cd backend && uv run pytest … -q -p no:cacheprovider`
- 결과
  - 내 영역 31파일: 283 passed · 0 failed (454초). `test_v3_contract`도 통과해요.
  - 닿는 곳 10파일: 90 passed (202초)
    - `test_v3_vendor_{suspend,profile}`
    - `security/test_sec_{access,limits,ratelimit}`
    - `test_guards` · `test_v3_admin_members` · `test_v3_shortlist_api` · `test_v3_visit_{flow,request}`
  - 백엔드 전체 실행은 하지 않았어요.
- ruff check · format --check: 내 파일 모두 통과
- `app.openapi()`: 오류 없음 (경로 146 · 모양 339)

## 동작이 바뀐 경로

| 경로 | 바뀐 것 |
| --- | --- |
| `POST /vendor/application/reapply` | 사업자등록번호를 고칠 수 있어요(VS02). 남의 번호면 409 `biz_no_taken`(UNIQUE에 걸려도 409). 처리 기록 `changes.biz_no`에 전 번호가 남아요 |
| `GET · PUT /vendor/profile` | `intro`(60자, 줄바꿈 · 겹친 빈칸은 한 칸, "" · 빈칸만이면 지움, null이면 그대로)를 받아요. 공개 프로필에는 넣지 않았어요(V15에만 있어요) |
| `POST /vendor/portfolio` · `PUT /vendor/profile`의 portfolio | `area_basis`(supply · exclusive)를 저장해요. 면적 없이 고르면 422예요. 고객 쪽 `VendorDetailOut.profile.portfolio`에도 나가요. `PortfolioOut.area_text`는 '공급 79.3㎡'예요 |
| `GET /projects/{id}/standard` | `days`(계산 엔진 값, C07 2.0 · 사는 집 2.5 · C60 부분 1.0, 옛 두 공정은 합)가 생겼어요 |
| `GET /vendor/prices?trade=dobae` | `v3.example_home` = "공급 69.4㎡ 집"이 생겼어요 |
| `GET /admin/vendors/{id}` | `suspended_at` · `suspend_scope`가 채워져요 |
| `POST /admin/vendors/{id}/suspend` · `/unsuspend` | vendor 뼈대를 지웠어요. 이제 report router 하나만 남았어요 |
| `POST /admin/vendors/{id}/links/{sort}` | 아직 501 뼈대예요. report에 같은 경로가 없어요 |

- 새 함수(`app.vendor.service`)
  - `suspend(s, vendor_id, scope, at) -> (datetime, str) | None`
  - `unsuspend(s, vendor_id) -> bool`
  - `set_review_link_status(s, vendor_id, sort, status, *, by, at, note=None, url=None) -> ReviewLinkAdminOut | None`
  - 셋 다 부르는 쪽 트랜잭션 안에서 조건부 UPDATE만 해요. commit은 하지 않아요.
  - report가 이 함수들로 바꾸면 `report/repository.py`의 `suspend` · `unsuspend` · `hide_link`는 지워요(B1b · 리드).

## 화면 묶음이 쓸 것

- B3
  - V01 `?again=1`에서 사업자등록번호 칸을 열 수 있어요.
  - V16에 공급 · 전용 고르기가 필요해요.
  - `intro` · `example_home`을 쓰면 돼요.
- B2a: C47은 `area_text`, C07은 `days`를 써요.

## 팀 확인

- 부분 공사 공간 몫 표는 잠정값 그대로예요(`calc/space_share.py`, 판 `space-share-2026.11`).

## 보였지만 고치지 않은 것

- `VendorAdminDetailOut.same_name`이 늘 빈 목록이에요.
- 업체 화면 `area_label`에 '공급'이 없어요(NF-08). 일꾼 B 몫이에요.
