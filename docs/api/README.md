# 믿집 API 안내

[문서 목록](../README.md) · [개발 환경](../development.md) · [테스트와 QA](../testing.md) · [기능 개발표](../feature-roadmap.md)

이 문서는 실제 FastAPI 라우터의 호출 주소·권한·오류·업무 순서를 설명합니다. 요청/응답 필드, 필수값, enum의 정본은 실행 중인 앱이 제공하는 **OpenAPI**입니다.

- **Swagger:** `http://localhost:8000/docs`
- **OpenAPI JSON:** `http://localhost:8000/openapi.json`
- `APP_ENV=production`에서는 두 주소가 비활성화되며 ReDoc은 제공하지 않습니다.
- 확인 기준: `dev` 커밋 `1a3e656`의 [라우터 등록](../../backend/app/main.py). 86개 경로, 97개 HTTP API. 실행 서버 버전은 별도 확인합니다.

인증 없이 지역 목록을 확인하는 간단한 예시:

```bash
curl http://localhost:8000/regions
```

### 빠른 이동

[주소·인증](#주소와-인증) · [오류·제한](#오류와-요청-제한) · [업무 순서](#주요-업무-흐름) · [전체 API 표](#등록된-api-97개)

## 주소와 인증

| 호출 위치 | 예시 | 주의 |
| --- | --- | --- |
| 백엔드 직접 | `http://localhost:8000/projects` | FastAPI 원본 경로는 `/projects` |
| Next.js 웹 | `http://localhost:3000/api/projects` | 같은 출처 `/api/*`를 Next.js가 백엔드 `/*`로 전달 |
| 배포 웹 | `https://<호스트>/api/projects` | Caddy가 `/api` 접두어를 제거; 호스트명은 배포 환경 확인 |

[Next.js rewrite](../../frontend/next.config.ts) · [Caddyfile](../../deploy/aws/Caddyfile). 아래 목록의 경로에는 **`/api`를 중복해서 붙이지 않습니다.**

- 인증은 **JWT Bearer가 아닌 서버 세션 쿠키**입니다. `POST /auth/signup`·`/auth/login`·`/auth/vendor-signup` 성공 시 쿠키가 발급되고, `POST /auth/logout`은 세션을 폐기합니다. 동일 출처의 웹 fetch에서는 `credentials: "same-origin"`을 사용합니다.
- `APP_ENV=local/test`에서는 `mj_sid` / `Secure=false`, `staging/production`에서는 `__Host-mj_sid` / `Secure=true`입니다(HTTPS URL을 자동 감지해 정하는 값이 아님). `HttpOnly`·`SameSite=Lax`·경로 `/`, 기본 14일입니다.
- 권한: **공개**는 세션 검사 없음, **로그인**은 활성 계정, **고객**은 고객 역할, **업체**는 승인 전 업체도 가능, **승인 업체**는 관리자 심사 승인 필요, **관리자**는 관리자 역할, **본인/관리자**는 집 주인 또는 관리자입니다. 고객·업체의 개별 자원 소유권도 서비스에서 검사합니다. `POST /me/withdraw`는 관리자 직접 탈퇴를 `403 admin_withdraw`로 제한합니다.
- Swagger에 자물쇠나 `security`가 없더라도 익명 API를 뜻하지 않습니다. 실제 `Depends(current_user)`·`require_role`·`approved_vendor`로 검사합니다.

## 오류와 요청 제한

오류는 원칙적으로 `{"error":{"code":"invalid","message":"입력한 내용을 확인해 주세요.","fields":[{"loc":["title"],"msg":"입력값을 확인해 주세요."}]}}` 모양입니다(`title` 필드는 합성 예시). `fields`는 필요할 때만 있고 오류 응답에 입력한 값이나 비밀번호를 넣지 않습니다.

**OpenAPI와 실행 오류의 차이:** FastAPI가 자동 생성한 422 스키마에는 `HTTPValidationError.detail`이 나오지만, 런타임의 커스텀 핸들러는 `422 invalid`와 `error.fields`로 응답합니다. 손상된 JSON도 422이며, 자동 명세에 없는 401·403·409도 서비스에서 발생합니다. 입력/성공 응답은 OpenAPI, 오류는 [errors.py](../../backend/app/shared/errors.py)와 각 service를 확인합니다.

| HTTP | `error.code` 예 | 처리 지침 |
| --- | --- | --- |
| 400·405 | `bad_request`·`method_not_allowed` | 요청 형식·메서드 확인(손상 JSON은 보통 422) |
| 401 | `login_required`·`bad_login` | 세션 또는 로그인 정보 확인 |
| 403 | `forbidden`·`vendor_not_approved`·`bad_origin`·`suspended`·`admin_withdraw` | 역할·업체 승인·Origin·계정 상태 확인 |
| 404 | `not_found` | 없는 자원, 다른 사람 자원, 만료된 상담 턴 등; 의미는 API마다 다름 |
| 409 | `stale`·`invalid_state`·`quote_changed`·`plan_changed`·`overlap`·`conflict` | 상태·버전 다시 조회 후 사용자 확인 |
| 413·415 | `too_large`·`file_too_big`·`file_type` | 본문/파일 상한·형식 확인 |
| 422 | `invalid`·`missing`·`file_kind` 등 | `fields`와 실제 요청 모델 확인 |
| 429 | `too_many_attempts` | `Retry-After`(초) 이후 재시도 |
| 500·503 | `server_error`·`unavailable` | 일시 장애. `GET /health/ready`는 예외적으로 자체 `status/checks` 형태의 503 |

`204` 성공은 응답 본문이 없고 파일 GET 성공은 바이너리입니다. 모든 성공/실패를 같은 JSON으로 처리하지 않습니다. [에러 처리](../../backend/app/shared/errors.py) · [파일 검사](../../backend/app/files/service.py).

| 제한 | 현재 값 |
| --- | --- |
| 본문 | 일반 JSON 1 MiB, `POST /v2/ask` 2 MiB, `POST /files` 21 MiB, 업체 가입 11 MiB |
| 개별 파일 | 사진·포트폴리오 10 MiB, 도면·견적/단가 문서 최대 20 MiB(`kind`별 내용 검사) |
| 가입·로그인 | 가입 IP당 시간당 10회, 로그인 IP당 15분 50회 + 이메일·IP당 10회 |
| 프로젝트·파일 | 사용자당 시간당 생성 30회, 업로드 120회 |
| AI 상담 시작 | 사용자당 시간당 60회(`APP_ENV=local`은 예외, 재개 요청과 구분) |

Redis에 의존하는 요청 제한은 연결 실패 시 제한 검사만 통과시킵니다. `429`는 `Retry-After` 헤더를 사용합니다. [request_guards.py](../../backend/app/shared/request_guards.py) · [ratelimit.py](../../backend/app/shared/ratelimit.py).

**Origin은 CORS가 아닙니다.** `POST/PUT/PATCH/DELETE`에서 Origin 헤더가 존재하고 `ALLOWED_ORIGINS`에 없으면 `403 bad_origin`입니다(기본 `localhost:3000,3100`). `localhost:8000/docs`에서 Swagger Try it out POST를 누르면 해당 Origin이 허용되지 않아 403이 날 수 있습니다. 반면 현재 CORS 미들웨어가 없어 허용된 Origin의 교차 출처 `OPTIONS` 사전 요청도 405이며 CORS 허용 헤더가 없습니다. 웹은 **같은 출처 `/api/*` 프록시**를 사용합니다.

## 주요 업무 흐름

### 고객·업체 가입과 심사

1. 고객: `POST /auth/signup` 또는 `/auth/login` → `GET /me` → `GET /regions`.
2. 업체: 사업자등록증 포함 multipart `POST /auth/vendor-signup` → `GET /vendor/application`. 심사 전에도 신청 상태는 확인할 수 있습니다.
3. 관리자: `GET /admin/vendors` → `POST /admin/vendors/{vendor_id}/review`(승인·보완·거절). 이미 결정된 신청은 `409 invalid_state`. 보완 시 `POST /vendor/application/resubmit`, 거절 후 `/vendor/application/reapply`.
4. 승인 업체: `GET/PUT /vendor/profile`(`updated_at` 불일치 `409 stale`), `GET /vendor/prices?trade=dobae` → `PUT /vendor/prices/dobae` → `POST /vendor/prices/dobae/confirm`. 근거 파일은 먼저 `POST /files`(`kind=price_doc`). 승인 전 업체 기능은 `403 vendor_not_approved`입니다.

### 집 정보 → 실측 요청 → 업체 확정

1. 고객: `POST /projects` → `GET /projects/{project_id}/standard` · `/plan` → `GET /projects/{project_id}/vendors?trade=dobae`. 사진·도면은 먼저 `POST /files`(`kind=photo|plan`)로 올립니다.
2. `POST /projects/{project_id}/visits`로 공정당 최대 3곳에 요청. 연락처를 공유할 때만 `share_contact_ids`·`consent_ver`와 필수 주소를 확인합니다. 첫 실측 요청 후 집 정보 수정은 `409 locked`, 동의 문구 버전이 다르면 `409 consent_changed`입니다.
3. **부분 성공:** 201 응답에서도 `created`와 `failed`(`unavailable|already`)를 **둘 다 확인**합니다. 생성 가능한 업체가 없으면 `409 already|unavailable`, 자리가 없으면 `409 slots_full`입니다.
4. 승인 업체: `GET /vendor/visits` → `POST /files`(`kind=quote_doc`) → `PUT /vendor/visits/{visit_id}/quote`(임시 저장) → `POST /vendor/visits/{visit_id}/quote/send`(발송). 누락 필드는 `422 missing`과 `fields`, 이미 보낸 견적만 다시 보내면 `409 already_sent`이며 수정 초안 후 재제출합니다.
5. 고객: `GET /projects/{project_id}/quotes?trade=dobae` → `POST /projects/{project_id}/quotes/{visit_id}/confirm`. 본 견적의 `seen_ver`가 달라지면 `409 quote_changed`. 확정은 같은 공종의 다른 요청을 닫습니다. 파일 GET의 `quote_id`는 **견적 버전 ID**, confirm의 `visit_id`는 **실측 요청 ID**입니다.

실측 요청(합성 데이터) — 연락처는 공유하지 않는 예입니다.

```json
{"trade":"dobae","vendor_ids":["00000000-0000-4000-8000-000000000001"],"share_contact_ids":[]}
```

### 날짜·추가 금액·완료

1. 업체: `GET /vendor/jobs/{deal_id}/dates/preview`(`start`·`end`·`crew`, 저장 없음) → `POST /vendor/jobs/{deal_id}/dates`로 제안.
2. 고객: `GET /projects/{project_id}/schedule`에서 날짜·최신 `final_version` 확인 후 `POST /projects/{project_id}/deals/{deal_id}/dates/{proposal_id}/accept`. 본문은 **`{"seen_version":0}`** 같은 확정 공정표 버전(첫 버전은 0)입니다. 수락하면 새 확정 공정표 버전이 만들어집니다.
3. `409 plan_changed`는 본 공정표 버전 변경, `409 dates_changed`는 업체의 재제안, `409 overlap`은 공정 기간 겹침입니다. 고객 확인 없이 자동 재요청하지 않습니다. 다른 날짜 요청은 `POST .../date-requests`(최대 2회) → 업체 새 제안 → 고객 수락입니다.
4. 업체가 공사 중 추가 금액을 올리면 `POST /vendor/jobs/{deal_id}/extras`, 고객은 `POST /projects/{project_id}/deals/{deal_id}/extras/{extra_id}/ack`(`ack=ok|talk`). 완료는 업체 `POST /vendor/jobs/{deal_id}/done` → 고객 `POST /projects/{project_id}/deals/{deal_id}/check` 순서입니다.

### v2 계산·AI 상담

- `POST /v2/quote`·`/plan`·`/quick-budget`는 입력값 계산이며 자동 저장이 아닙니다. 평형·도면 미입력 시 32평 등 **가정값**으로 계산할 수 있으므로 `inp.assumed`를 확인합니다. `POST /v2/cases`는 고객의 새 건 생성(최대 30건), `PUT /v2/cases/{case_id}`는 선택값 `state`의 전체 저장과 견적·일정 **서버 재계산**입니다. 계산이 실패한 견적·공정표 결과는 비워질 수 있습니다.
- `POST /v2/ask`의 `kind=chat` 성공 완료는 대화를 저장하지만, `gate="out"`(범위 밖)·`failed=true`(모델·출력 검사 실패)는 **HTTP 200 안의 결과 값**이고 저장하지 않습니다. 설명용 `kind=quote_explanation|schedule`도 일반 대화 이력을 쓰지 않습니다. DB의 `rev` 충돌은 `409 conflict`입니다.
- `done=false`이면 응답의 `turn`·`tool_calls`을 받아 **브라우저에서 실제 도구**를 실행한 뒤 `POST /v2/ask/{turn_id}`에 해당 도구 ID별 `results`를 돌려줍니다. `set_home_info` 등 화면 도구는 제안이고 고객이 **[담기]**를 눌러야 선택값이 반영됩니다. 잘못된/중복 ID는 **422 invalid(턴 유지)**, 만료·다른 사용자의 턴·중복 재개의 늦은 요청은 **404 not_found**입니다(Redis TTL 10분).
- 계산 결과·대화는 JSON으로 한 번에 응답합니다. 독립 `/chat/*`/SSE, 일정 MCP HTTP API는 현재 등록되지 않았습니다.

```json
{"kind":"chat","message":"도배 전에 무엇을 확인해야 하나요?"}
```

화면 도구의 **실제 실행 결과**를 제출하는 본문 형태(합성 ID이며 특정 도구의 실행을 보장하지 않는 예시):

```json
{"results":[{"id":"예시-도구-ID","content":"{\"ok\":true,\"saved\":false}"}]}
```

요청·응답 모델: [v2 스키마](../../backend/app/v2/schemas.py) · [상담 저장](../../backend/app/v2/ask_chat.py) · [프런트 확인 버튼](../../frontend/components/v2/ai/ask.tsx). 실제 화면·LLM·AWS QA는 별도 검사입니다.

## 등록된 API (97개)

FastAPI 원본 경로입니다. 동일 URL에서 메서드가 다르면 별도 API로 셉니다. **권한 표기:** 공개=세션 불필요, 로그인=활성 계정, 고객=고객 역할/본인 자원, 업체=업체 역할(승인 전 신청 API 포함), 승인 업체=관리자 승인된 업체, 관리자=관리자 역할, 본인/관리자=집 소유 고객 또는 관리자입니다.

[상세 입력·성공 응답: Swagger UI](http://localhost:8000/docs) · [OpenAPI JSON](http://localhost:8000/openapi.json)

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

### 목록에 없는 기능

독립 채팅 SSE·일정 MCP 서버·결제·전자계약·문서 OCR·관리자 회원 수정 API는 이 라우터 목록에 없습니다. 구현과 계획의 구분은 [기능 개발표](../feature-roadmap.md)에서 확인합니다.

API 변경 시 라우터/스키마의 OpenAPI를 갱신하고, `frontend/`에서 `pnpm gen:api`로 생성된 `lib/backend/schema.d.ts`를 재생성합니다(직접 손수정 금지). 오류·권한·호출 순서가 바뀌면 이 문서도 함께 수정합니다.
