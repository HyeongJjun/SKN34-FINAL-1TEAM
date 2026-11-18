# 등록된 API 전체 목록

[API 안내](README.md) · [권한·오류](common.md) · [업무 호출 흐름](workflows.md)

**기준:** `dev` SHA `1a3e656`, `backend/app/main.py`의 등록 라우터 10개와 직접 정의한 상태 확인 2개. **86개 경로, 메서드별 97개 API**다. `GET`·`POST`처럼 메서드가 다르면 같은 경로여도 각각 한 행으로 센다. 아래 경로는 모두 **FastAPI 원본 경로**이며 브라우저에서 호출할 때 `/api`를 앞에 붙인다. 요청·응답 필드와 enum은 [Swagger/OpenAPI](README.md#swagger와-openapi-보기)를 사용한다.

**권한 표기:** `공개`=로그인 없이 진입하는 API(Origin·요청 제한 등 다른 검사는 가능), `로그인`=모든 활성 계정 역할의 세션, `고객`=고객 역할(집 API는 본인 소유), `업체`=업체 역할(승인 전에도 해당 API는 사용 가능), `승인 업체`=업체 역할 + 관리자 승인(본인 요청·작업), `관리자`=관리자 역할, `본인/관리자`=로그인 후 해당 집의 소유 고객 또는 관리자. [권한과 실패 응답](common.md)도 참고한다.

## 상태 확인 · 회원 · 계정 (8개)

코드: [FastAPI main](../../backend/app/main.py) · [회원 라우터](../../backend/app/auth/router.py) · [탈퇴 라우터](../../backend/app/account/router.py).

| 메서드 | 원본 경로 | 기능 | 인증·역할 | 코드(함수) |
| --- | --- | --- | --- | --- |
| GET | `/health/live` | API 프로세스 상태 | 공개 | `main.live` |
| GET | `/health/ready` | DB·Redis 준비 상태, 장애 시 503 | 공개 | `main.ready` |
| POST | `/auth/signup` | 일반 고객 가입·세션 발급 | 공개 | `auth.signup` |
| POST | `/auth/login` | 이메일·비밀번호 로그인·세션 발급 | 공개 | `auth.login` |
| POST | `/auth/logout` | 기존 세션 폐기·쿠키 삭제(없어도 204) | 공개 | `auth.logout` |
| GET | `/me` | 로그인 사용자·권한·업체 승인 상태 | 로그인 | `auth.read_me` |
| PATCH | `/me` | 본인 정보 수정 | 로그인 | `auth.patch_me` |
| POST | `/me/withdraw` | 비밀번호 재확인 후 탈퇴·쿠키 삭제(관리자 직접 탈퇴는 403) | 로그인·관리자 제외 | `account.withdraw` |

## 파일·알림 (6개)

코드: [파일 라우터](../../backend/app/files/router.py) · [알림 라우터](../../backend/app/notify/router.py). 파일 조회의 `/files/{file_id}`는 올린 사람 또는 관리자만 사용할 수 있다. 견적·업체 사진은 **별도의 권한 확인을 거치는 경로**도 있다.

| 메서드 | 원본 경로 | 기능 | 인증·역할 | 코드(함수) |
| --- | --- | --- | --- | --- |
| POST | `/files` | `kind`와 파일 업로드(multipart), 종류별 역할·크기 제한 | 로그인·파일 종류별 고객/업체 | `files.upload` |
| GET | `/files/{file_id}` | 업로드 파일 읽기 | 올린 사람/관리자 | `files.download` |
| GET | `/notifications` | 본인 알림 최근 50개(선택: 프로젝트) | 로그인 | `notify.list_notifications` |
| GET | `/notifications/unread` | 본인 미확인 알림 수 | 로그인 | `notify.unread` |
| POST | `/notifications/{nid}/read` | 알림 하나 읽음 처리(204) | 로그인·본인 | `notify.read_one` |
| POST | `/notifications/read-all` | 본인 알림 전체 읽음(204) | 로그인 | `notify.read_all` |

## 집 프로젝트·표준견적 (6개)

코드: [프로젝트 라우터](../../backend/app/project/router.py) · [표준견적 라우터](../../backend/app/quote/router.py). `POST /projects`와 `GET /projects`는 서로 다른 라우터에 등록되어 있다.

| 메서드 | 원본 경로 | 기능 | 인증·역할 | 코드(함수) |
| --- | --- | --- | --- | --- |
| GET | `/regions` | 시도·시군구 목록 | 공개 | `project.regions` |
| POST | `/projects` | 고객 프로젝트 생성(201) | 고객 | `project.create_project` |
| GET | `/projects/{project_id}` | 한 집의 상세 정보 | 본인/관리자 | `project.get_project` |
| PATCH | `/projects/{project_id}` | 첫 실측 요청 전 집 정보 전체 수정 | 고객 | `project.update_project` |
| PUT | `/projects/{project_id}/checks/{key}` | 공사 전 준비 체크 상태 켜기·끄기 | 고객 | `project.set_check` |
| GET | `/projects/{project_id}/standard` | 저장된 표준견적 버전 조회·필요 시 계산 | 본인/관리자 | `quote.standard` |

## 업체 가입·심사·단가·프로필 (17개)

코드: [업체 라우터](../../backend/app/vendor/router.py) · [업체 승인 의존성](../../backend/app/vendor/deps.py).

| 메서드 | 원본 경로 | 기능 | 인증·역할 | 코드(함수) |
| --- | --- | --- | --- | --- |
| POST | `/auth/vendor-signup` | 사업자등록증 포함 가입 신청·세션 발급(201) | 공개 | `vendor.vendor_signup` |
| GET | `/admin/vendors` | 업체 신청 목록·상태 검색 | 관리자 | `vendor.list_vendors` |
| GET | `/admin/vendors/summary` | 심사 상태별 수 | 관리자 | `vendor.vendor_summary` |
| GET | `/admin/vendors/{vendor_id}` | 업체 신청 상세·심사 기록 | 관리자 | `vendor.get_vendor` |
| POST | `/admin/vendors/{vendor_id}/review` | 승인·보완·거절 결정(중복 결정 409) | 관리자 | `vendor.review_vendor` |
| GET | `/vendor/application` | 본인 가입 심사·보완/거절 사유 조회 | 업체 | `vendor.my_application` |
| POST | `/vendor/application/resubmit` | 보완 요청 후 신청서 다시 제출 | 업체 | `vendor.resubmit` |
| POST | `/vendor/application/reapply` | 거절 후 같은 계정으로 재신청 | 업체 | `vendor.reapply` |
| GET | `/vendor/profile` | 승인된 업체 본인 정보 | 승인 업체 | `vendor.profile` |
| PUT | `/vendor/profile` | 프로필 저장(`updated_at` 버전 확인) | 승인 업체 | `vendor.save_profile` |
| POST | `/vendor/portfolio` | 먼저 올린 시공 사진을 프로필에 연결(201) | 승인 업체 | `vendor.add_portfolio` |
| DELETE | `/vendor/portfolio/{item_id}` | 시공 사진 연결 해제(204) | 승인 업체 | `vendor.remove_portfolio` |
| GET | `/vendor/prices` | 공종별 가견적 단가·근거 목록(`trade` 쿼리 필수) | 승인 업체 | `vendor.prices` |
| PUT | `/vendor/prices/{trade}` | 공종 단가 초안 전체 저장 | 승인 업체 | `vendor.save_prices` |
| POST | `/vendor/prices/{trade}/confirm` | 초안 단가 확정·이전 버전 보존 | 승인 업체 | `vendor.confirm_prices` |
| POST | `/vendor/price-files` | 업로드한 근거 파일 연결(201) | 승인 업체 | `vendor.add_price_file` |
| DELETE | `/vendor/price-files/{file_id}` | 단가 근거 파일 연결 해제(204) | 승인 업체 | `vendor.remove_price_file` |

## 업체 고르기·실측 요청·견적서 파일 (15개)

코드: [실측·업체 선택 라우터](../../backend/app/visit/router.py).

| 메서드 | 원본 경로 | 기능 | 인증·역할 | 코드(함수) |
| --- | --- | --- | --- | --- |
| GET | `/projects/{project_id}/vendors` | 이 집·공종의 업체/가견적 목록 | 고객 | `visit.vendors` |
| GET | `/projects/{project_id}/vendors/{vendor_id}` | 이 집 기준 업체 상세와 가견적 | 고객 | `visit.vendor_detail` |
| GET | `/projects/{project_id}/vendors/{vendor_id}/photos/{file_id}` | 이 집에서 선택 가능한 업체의 시공 사진 | 고객 | `visit.vendor_photo` |
| POST | `/projects/{project_id}/visits` | 공정별 최대 3곳 실측 요청(201) | 고객 | `visit.request_visits` |
| GET | `/projects/{project_id}/visits` | 요청 상태·연락처 동의·남은 자리 | 고객 | `visit.visits` |
| POST | `/projects/{project_id}/visits/{visit_id}/cancel` | 견적이 오기 전 실측 요청 취소 | 고객 | `visit.cancel_visit` |
| POST | `/projects/{project_id}/visits/reselect` | 업체 확정 전 해당 공종 요청 모두 닫고 다시 고르기 | 고객 | `visit.reselect_visits` |
| GET | `/vendor/visits/{visit_id}` | 내 업체에 온 실측 요청 상세 | 승인 업체 | `visit.vendor_visit` |
| POST | `/vendor/visits/{visit_id}/decline` | 실측 요청 거절·사유 기록 | 승인 업체 | `visit.decline_visit` |
| POST | `/vendor/visits/{visit_id}/seen` | 새 요청 읽음 처리(204) | 승인 업체 | `visit.seen_visit` |
| GET | `/vendor/visits/{visit_id}/quote` | 실측 견적서 임시·발송 버전 목록 | 승인 업체 | `visit.quote_board` |
| PUT | `/vendor/visits/{visit_id}/quote` | 견적 파일 목록·요약 금액 등 임시 저장 | 승인 업체 | `visit.save_quote` |
| POST | `/vendor/visits/{visit_id}/quote/send` | 임시 견적서 보내기·재제출 | 승인 업체 | `visit.send_quote` |
| GET | `/projects/{project_id}/quotes/{quote_id}/files/{file_id}` | 받은 견적서의 발송 버전 파일 | 고객 | `visit.customer_quote_file` |
| GET | `/vendor/visits/{visit_id}/quote/files/{file_id}` | 내 실측 견적서 파일(임시 포함) | 승인 업체 | `visit.vendor_quote_file` |

## 공정표·업체 확정·공사 일정·추가 금액 (23개)

코드: [업체 확정·공정표 라우터](../../backend/app/schedule/router.py). `GET /projects/{id}/plan`은 소유 고객·관리자 가능하지만 **`POST /projects/{id}/plan`은 서비스에서 고객만 허용**한다.

| 메서드 | 원본 경로 | 기능 | 인증·역할 | 코드(함수) |
| --- | --- | --- | --- | --- |
| GET | `/projects/{project_id}/plan` | 예상 또는 확정 공정표 조회 | 본인/관리자 | `schedule.plan` |
| POST | `/projects/{project_id}/plan` | 예상 공정표 재계산·버전 저장 | 고객(서비스에서 역할 확인) | `schedule.redo_plan` |
| POST | `/projects/{project_id}/quotes/{visit_id}/confirm` | 본 견적 버전(`seen_ver`)으로 업체 확정 | 고객 | `schedule.confirm` |
| POST | `/projects/{project_id}/deals/{deal_id}/reselect` | 날짜 수락 전에 확정 업체 다시 고르기 | 고객 | `schedule.reselect` |
| GET | `/projects/{project_id}/deals` | 확정 업체 목록 | 고객 | `schedule.deals` |
| GET | `/projects/{project_id}/quotes` | 공종별 표준·업체 견적 비교 | 고객 | `schedule.compare_quotes` |
| GET | `/vendor/visits` | 업체 작업함(할 일·기다림·공사·완료) | 승인 업체 | `schedule.vendor_inbox` |
| GET | `/vendor/visits/summary` | 작업함 탭별 수 | 승인 업체 | `schedule.vendor_inbox_summary` |
| GET | `/projects/{project_id}/schedule` | 공사 날짜 제안·요청·확정 버전 | 고객 | `schedule.schedule` |
| POST | `/projects/{project_id}/deals/{deal_id}/dates/{proposal_id}/accept` | 새 날짜 수락, 확정 공정표 버전 생성 | 고객 | `schedule.accept_dates` |
| POST | `/projects/{project_id}/deals/{deal_id}/date-requests` | 고객이 다른 날짜 요청(최대 2회, 201) | 고객 | `schedule.request_dates` |
| GET | `/vendor/jobs/{deal_id}` | 내 업체 공사 날짜·작업 보기 | 승인 업체 | `schedule.job` |
| GET | `/vendor/jobs/{deal_id}/dates/preview` | 저장 전 작업일·필요 인원·겹침 계산 | 승인 업체 | `schedule.preview_dates` |
| POST | `/vendor/jobs/{deal_id}/dates` | 업체 날짜 제안·변경안 제출 | 승인 업체 | `schedule.propose_dates` |
| POST | `/vendor/jobs/{deal_id}/extras` | 공사 중 추가 금액 등록(201) | 승인 업체 | `schedule.add_extra` |
| GET | `/vendor/jobs/{deal_id}/extras/{extra_id}/files/{file_id}` | 추가 금액 공사 사진(업체용) | 승인 업체 | `schedule.vendor_extra_photo` |
| POST | `/projects/{project_id}/deals/{deal_id}/extras/{extra_id}/ack` | 고객의 추가 금액 확인·상담 응답 | 고객 | `schedule.ack_extra` |
| GET | `/projects/{project_id}/deals/{deal_id}/extras/{extra_id}/files/{file_id}` | 추가 금액 공사 사진(고객용) | 고객 | `schedule.customer_extra_photo` |
| POST | `/vendor/jobs/{deal_id}/done` | 업체 공사 완료·남은 일 완료 보고 | 승인 업체 | `schedule.finish` |
| POST | `/projects/{project_id}/deals/{deal_id}/check` | 고객의 완료 확인·남은 일 응답 | 고객 | `schedule.check_work` |
| GET | `/projects` | 고객 소유 프로젝트 목록·상태 요약 | 고객 | `schedule.my_projects` |
| GET | `/projects/{project_id}/overview` | 집별 현재 할 일·단계·비용·업체 정보 | 고객 | `schedule.overview` |
| GET | `/projects/{project_id}/docs` | 프로젝트 표준·업체 견적·공정표 서류 모음 | 고객 | `schedule.docs` |

## v2 계산·AI 상담·저장 (22개)

코드: [v2 라우터](../../backend/app/v2/router.py). `/v2/ask`와 계산 API는 **로그인 필요(역할 제한 없음)**이고, `/v2/cases`는 **고객 역할만** 가능하다. v2 화면은 `wallpaper`(도배)만 노출하지만, 코드의 계산 입력 enum이 모든 화면 노출 기능을 뜻하지는 않는다.

| 메서드 | 원본 경로 | 기능 | 인증·역할 | 코드(함수) |
| --- | --- | --- | --- | --- |
| GET | `/v2/floor-plans` | 준비된 예시 평면도 목록 | 로그인 | `v2.plans` |
| GET | `/v2/floor-plans/{plan_id}/qty` | 예시 평면도 공간 수량 | 로그인 | `v2.plan_qty` |
| GET | `/v2/materials` | 목공 자재·고정 단가 항목 | 로그인 | `v2.materials` |
| POST | `/v2/projects/{project_id}/preview` | 기존 프로젝트 도면·자재 견적 미리보기(저장 안 함) | 본인/관리자 | `v2.preview` |
| POST | `/v2/quote` | v2 표준견적 계산(저장 안 함) | 로그인 | `v2.v2_quote` |
| GET | `/v2/market-extras` | 목공 추가 항목·시장 기준 자료 | 로그인 | `v2.v2_market_extras` |
| POST | `/v2/plan` | v2 예상 공정표 계산(저장 안 함) | 로그인 | `v2.v2_plan` |
| POST | `/v2/check` | 받은 견적 맞춰 보기 | 로그인 | `v2.v2_check` |
| POST | `/v2/estimate` | v2 업체 단가 기반 가견적 계산 | 로그인 | `v2.v2_estimate` |
| POST | `/v2/entered` | 실측 견적 입력액의 부가세·합계 계산 | 로그인 | `v2.v2_entered` |
| POST | `/v2/calc7` | 셀프 도배·몰딩·페인트 계산기 | 로그인 | `v2.v2_calc7` |
| POST | `/v2/extras-range` | 선택한 추가 항목 시장 범위 | 로그인 | `v2.v2_extras` |
| POST | `/v2/quick-budget` | 빠른 예산 범위·추가 질문 계산 | 로그인 | `v2.v2_quick` |
| POST | `/v2/ask` | AI 상담 한 턴 시작(도구·완료 JSON) | 로그인 | `v2.v2_ask` |
| POST | `/v2/ask/{turn_id}` | 화면 도구 결과 제출·턴 재개 | 로그인·본인 턴 | `v2.v2_ask_resume` |
| GET | `/v2/ask/health` | v2 AI 켜짐 상태(`ok`, `live`) | 로그인 | `v2.v2_ask_health` |
| GET | `/v2/cases` | 내 v2 인테리어 목록 | 고객 | `v2.cases` |
| POST | `/v2/cases` | v2 인테리어 한 건 생성(201) | 고객 | `v2.case_create` |
| GET | `/v2/cases/{case_id}` | 내 저장된 인테리어 열기 | 고객 | `v2.case_get` |
| PUT | `/v2/cases/{case_id}` | 전체 상태 저장·금액/공정표 재계산 | 고객 | `v2.case_save` |
| PATCH | `/v2/cases/{case_id}` | 저장한 인테리어 제목 변경 | 고객 | `v2.case_rename` |
| DELETE | `/v2/cases/{case_id}` | 내 인테리어 삭제(204) | 고객 | `v2.case_delete` |

## 현재 제공하지 않는 API

- 독립 `/chat/*` 라우트와 SSE 스트리밍: `backend/app/chat/router.py`가 비어 있고 `main.py`의 `ROUTERS`에 없다. 실제 상담은 **`POST /v2/ask`와 `POST /v2/ask/{turn_id}`의 JSON**이다.
- 일정 MCP의 `get_schedule` · `request_schedule_change` 등: `backend/app/mcp_server.py`가 빈 파일이며 공개 HTTP 라우터가 없다.
- 관리자 **회원 관리 변경** API, 소셜 로그인, 문자 인증, 결제·전자계약, 문서 OCR 자동 입력은 현재 목록에 없는 별도 후속 범위다.

엔드포인트가 없다고 업무 흐름을 추정해 임의로 호출하지 않는다. 상태 판정의 근거는 [기능 개발표](../feature-roadmap.md)를 따른다.
