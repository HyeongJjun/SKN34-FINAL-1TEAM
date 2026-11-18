# API 공통 계약: 인증·오류·요청 제한

[API 안내](README.md) · [전체 엔드포인트](endpoints.md) · [호출 흐름](workflows.md)

기준: `dev` SHA `1a3e656`. **필드의 상세 명세는 [OpenAPI](README.md#swagger와-openapi-보기)**가 정본이고, 아래는 백엔드 미들웨어·의존성·서비스에서 실제로 검사하는 규칙이다.

## 인증과 권한

- 인증은 **서버 세션 쿠키**이며 JWT Bearer가 아니다. `POST /auth/signup`, `POST /auth/login`, `POST /auth/vendor-signup`이 성공하면 `Set-Cookie`로 세션을 발급한다. `POST /auth/logout`은 받은 쿠키의 세션을 폐기하고 쿠키를 지운다.
- 쿠키 이름·`Secure` 설정은 **URL의 HTTPS 자동 감지가 아니라 `APP_ENV` 값**으로 정한다. `local`·`test`일 때는 `mj_sid`/`Secure=false`, `staging`·`production`일 때는 `__Host-mj_sid`/`Secure=true`다. 그 외에 `HttpOnly`, `SameSite=Lax`, 경로 `/`, 기본 세션 기간 14일을 사용한다. [인증 의존성](../../backend/app/auth/deps.py), [설정](../../backend/app/config.py).
- API 호출 시 브라우저의 같은 출처 쿠키를 자동 전달한다(`fetch`의 `credentials:"same-origin"`). 세션이 없거나 만료되면 `401 login_required`, 역할이 다르면 `403 forbidden`을 돌린다. `approved_vendor`가 필요한 API는 **업체 역할과 관리자 승인 모두** 필요하며, 승인 전에는 `403 vendor_not_approved`다.
- `GET /projects/{project_id}`, 표준견적서·공정표 조회 등은 로그인한 **소유 고객 또는 관리자**만 볼 수 있다. 그 밖의 고객 API는 보통 고객 역할과 **본인 프로젝트**를 확인한다. 다른 사람 자료는 존재 여부를 숨기려고 `404 not_found`로 응답하는 곳이 있다.
- 업체 가입 신청·심사 상태 확인은 업체 승인 전에도 가능하지만, 단가·포트폴리오·실측 견적·공사 날짜 작업은 승인된 업체만 가능하다. 관리자 심사 API는 관리자 전용이다.
- `POST /me/withdraw`는 세션 외에 비밀번호 재확인이 필요하며, **관리자 역할의 직접 탈퇴는 서비스에서 `403 admin_withdraw`로 막는다**.
- 세션 없이 호출 가능한 API는 [목록](endpoints.md)에서 `공개`로 표시한다. Swagger의 보안 스키마가 비어 있더라도 다른 API가 익명으로 열려 있다는 뜻이 아니다.

**인증 근거:** [auth/router.py](../../backend/app/auth/router.py) · [auth/service.py](../../backend/app/auth/service.py) · [auth/deps.py](../../backend/app/auth/deps.py) · [vendor/deps.py](../../backend/app/vendor/deps.py). 각 API의 역할 조건은 [엔드포인트 목록](endpoints.md)을 따른다.

## 요청 주소·헤더

| 구분 | 실제 처리 |
| --- | --- |
| 경로 | FastAPI는 `/auth/login`, `/projects`, `/v2/ask` 등 원본 경로를 사용. 브라우저 경유는 같은 출처 **`/api` 접두어** |
| JSON 요청 | `Content-Type: application/json`. 본문·쿼리·경로값은 Pydantic/FastAPI로 검사 |
| 파일 업로드 | `POST /files`는 `multipart/form-data`의 `kind`와 `file`, 업체 가입은 별도 `multipart/form-data` 입력(상호·사업자 정보와 사업자등록증) |
| Origin 확인 | `POST`·`PUT`·`PATCH`·`DELETE` 중 `Origin` 헤더가 **존재하고** `ALLOWED_ORIGINS`에 없으면 `403 bad_origin`. 헤더가 없으면 이 미들웨어 검사는 건너뜀 |
| 기본 허용 Origin | `http://localhost:3000`, `http://localhost:3100`(`config.py`, `.env.example`). 웹 포트를 바꾸면 개발자가 설정값도 맞춘다 |
| 응답 쿠키 | 가입·로그인 성공은 `Set-Cookie`, 로그아웃·탈퇴는 쿠키 삭제. 이 쿠키나 실사용 키를 문서에 복사하지 않는다 |
| 요청 제한 | 해당 라우터가 Redis로 초과를 판정하면 `429`와 `Retry-After`(초). Redis 연결 실패 시 요청 제한 검사만 통과시키는 구현 |

Swagger의 `Try it out`도 브라우저에서 요청하므로 **같은 출처 POST에서 Origin 헤더가 붙을 수 있다**. `http://localhost:8000/docs` 자체가 기본 허용 목록에는 없어 로그인·POST가 `403 bad_origin`으로 막힐 수 있다. `GET`에는 해당 Origin 검사를 적용하지 않는다. 이는 API 로그인 권한과 다른 검사다.

로컬 검증에서는 `Origin: http://localhost:8000`인 `POST /auth/login`은 내용 검사 전에 **403 `bad_origin`**, `Origin: http://localhost:3000`으로 보내고 빈 JSON을 사용하면 **422 `invalid`**로 확인됐다. Swagger에서 쓰기 시험을 하려면 테스트 대상 **로컬 앱의 `ALLOWED_ORIGINS`**를 먼저 확인해야 한다. 기존 QA 서버나 운영 설정을 문서 작성 때문에 바꾸지 않는다.

`ALLOWED_ORIGINS`는 쓰기 요청의 **Origin 검사 목록**이지 브라우저 CORS 허용 설정이 아니다. 현재 `main.py`에 `CORSMiddleware`가 없어, 허용된 `Origin: http://localhost:3100`을 넣은 `OPTIONS /auth/login` 사전 요청도 **405 `method_not_allowed`**이며 `Access-Control-Allow-Origin`이 없다. Origin을 허용 목록에 추가하는 것만으로 교차 출처 fetch가 동작하지는 않는다. 브라우저는 Next.js/Caddy의 **동일 출처 `/api/*` 프록시**를 사용한다.

코드: [main.py](../../backend/app/main.py) · [request_guards.py](../../backend/app/shared/request_guards.py) · [ratelimit.py](../../backend/app/shared/ratelimit.py) · [Next.js rewrite](../../frontend/next.config.ts) · [Caddyfile](../../deploy/aws/Caddyfile).

## 오류 응답

실패하면 기본적으로 다음 구조를 사용한다. `code`는 프런트가 분기에 쓰는 값이며, `message`는 사용자에게 보여 줄 수 있는 한국어 문장이다. `fields`는 유효성 검사나 누락된 견적 항목처럼 개별 칸 정보가 있을 때만 나타난다.

```json
{
  "error": {
    "code": "invalid",
    "message": "입력한 내용을 확인해 주세요.",
    "fields": [{ "loc": ["title"], "msg": "입력값을 확인해 주세요." }]
  }
}
```

위 `title`과 메시지는 형식 설명용 합성 예시다. 실제 Pydantic 검증은 `422 invalid`와 오류 `loc`·`msg`를 응답하며, 비밀번호 등 원본 입력값을 다시 싣지 않는다. **깨진 JSON**(예: 본문이 `{` 한 글자뿐인 경우)도 현재 코드에서는 `422 invalid`와 JSON decode error 필드로 확인됐다. [errors.py](../../backend/app/shared/errors.py).

**OpenAPI 기본 오류 모형과 실제 응답의 차이:** FastAPI가 생성한 `POST /auth/login`의 422 응답 스키마는 `HTTPValidationError`(`detail` 형태)로 표시된다. 그러나 현재 앱은 사용자 정의 `RequestValidationError` 핸들러를 등록해, 빈 JSON을 전송한 실제 422 응답을 `{"error":{"code":"invalid","message":"입력한 내용을 확인해 주세요.","fields":[...]}}` 형태로 내보낸다. 따라서 **요청·성공 응답의 명세는 OpenAPI로 확인하되, 오류 응답은 이 문서의 공통 처리와 각 서비스의 `AppError`를 함께 확인**한다. OpenAPI에 명시되지 않은 401·403·409 등도 실제 코드에서 발생한다.

| HTTP | `error.code` 예 | 발생 조건·구분 |
| --- | --- | --- |
| 400 | `bad_request` | Starlette가 직접 400 HTTP 예외를 낸 경우 등. **잘못된 JSON 파싱이 항상 400이 되는 것은 아님** |
| 401 | `login_required`, `bad_login` | 세션 누락·만료 또는 로그인 정보가 틀림. 같은 401이어도 코드가 다름 |
| 403 | `forbidden`, `vendor_not_approved`, `bad_origin`, `suspended`, `bad_password`, `admin_withdraw` | 역할 불일치, 업체 미승인, Origin 미허용, 정지된 계정, 비밀번호 재확인 실패, 관리자 직접 탈퇴 제한 등 |
| 404 | `not_found` | 없는 경로·리소스, 타인 소유 자료, 남의/지난 v2 도구 턴. 의미는 호출 API에 따라 다름 |
| 405 | `method_not_allowed` | 해당 URL에서 허용되지 않는 HTTP 메서드 |
| 409 | `conflict`, `stale`, `invalid_state`, `quote_changed`, `plan_changed`, `overlap` 등 | 저장 번호표·보았던 견적/공정표 버전 충돌, 중복 처리, 허용되지 않는 상태 변경 |
| 413 | `too_large`, `file_too_big` | 본문 상한 또는 개별 파일 크기 상한 위반 |
| 415 | `file_type` | 파일 내용의 실제 형식이 허용 목록 밖 |
| 422 | `invalid`, `missing`, `file_kind`, `file_empty`, `file_broken`, 도메인별 코드 | Pydantic/경로 값 오류, 견적서 필수 칸 누락, 파일 종류·내용 등 |
| 429 | `too_many_attempts` | Redis 요청 횟수 제한 초과. `Retry-After` 헤더 확인 |
| 500 | `server_error` | 처리하지 못한 서버 예외를 공통 구조로 변환 |
| 503 | `unavailable` | DB/외부 연결 실패 등 공통 처리 또는 v2 Redis 턴 저장·재개 실패 |

**예외:** `GET /health/ready`는 DB·Redis 상태를 `{"status":"ok"|"error","checks":{...}}`로 돌려준다. 장애 시 **503이어도 `error` 래퍼가 없다**. 또한 파일 GET 성공 응답은 바이너리(사진/PDF 등)이고 204 응답은 본문이 없다. HTTP 숫자만 보고 항상 같은 JSON 형태라고 가정하지 않는다.

FastAPI가 내는 400·404·405·413의 표준 오류는 [errors.py](../../backend/app/shared/errors.py)의 별도 매핑을 사용한다. 도메인 서비스의 `AppError(status,code,...)`는 해당 서비스가 정한 코드가 우선한다. 따라서 **403은 모두 `forbidden`, 404는 모든 곳에서 동일한 업무 오류**라고 가정하지 않는다.

## 본문·파일·요청 수 한도

| 범위 | 현재 코드의 한도 |
| --- | --- |
| 일반 JSON 본문 | 기본 **1 MiB**(`BodyLimit`) |
| `POST /v2/ask` 본문 | **2 MiB**, 사진 base64 데이터는 요청 스키마에서도 한도 검사 |
| `POST /files` 본문 | **21 MiB**(multipart 헤더 공간 포함). 개별 사진·시공 사진·시공 사례는 보통 10 MiB, 도면·근거/견적 문서는 최대 20 MiB 등 `kind`별 별도 검사 |
| `POST /auth/vendor-signup` 본문 | **11 MiB**(사업자등록증 최대 10 MiB + multipart 머리) |
| 일반 고객/업체 가입 | 동일 IP **시간당 10회** |
| 로그인 시도 | IP당 15분 **50회**, 이메일+IP 조합당 15분 **10회**. 비밀번호 재확인도 같은 검사 |
| `POST /projects` | 회원별 시간당 **30회** |
| `POST /files` | 회원별 시간당 **120회** |
| `POST /v2/ask` 시작 | 회원별 시간당 **60회**(`APP_ENV=local`이면 이 제한 생략). 이어받기 `POST /v2/ask/{turn_id}`와 구분 |

본문 한도는 잘못된/과도한 `Content-Length`를 읽기 전에 검사하고, 본문을 나눠 보내는 경우에도 누적 크기를 검사한다. 로그인 검사는 **본문 크기 검사보다 뒤**에 있으므로 익명 호출도 먼저 413을 받을 수 있다. 파일 형식은 전송한 MIME 글자만 믿지 않고 바이트·엑셀 구조를 확인하며, 이미지의 위치/EXIF 정보는 저장 전 제거한다. 자료별 세부 제약은 [files/service.py](../../backend/app/files/service.py)와 OpenAPI를 따른다.

## 버전 충돌과 재시도

- 프로젝트는 첫 실측 요청 뒤 정보를 잠그므로 `PATCH /projects/{id}`가 `409 locked`가 될 수 있다.
- 업체가 실측 견적을 다시 보낸 뒤 고객이 **이전 견적 버전**을 확정하려 하면 `409 quote_changed`. 업체 확정 요청은 `seen_ver`를 사용한다.
- 공사 날짜 수락은 화면이 본 확정 공정표 버전 `seen_version`으로 검증한다. 다른 요청이 먼저 날짜를 수락해 버전이 달라지면 `409 plan_changed`, 겹치는 일정은 `409 overlap`, 업체가 이미 다른 제안을 올린 경우 `409 dates_changed`가 가능하다.
- v2 대화 DB 저장은 `chats.rev`로 동시 질문을 막는다. 늦게 저장한 요청은 `409 conflict`이다. 화면 도구 재개는 Redis에 저장한 턴에서 기다리는 결과 ID와 완전히 일치해야 한다. ID 누락·중복·불일치는 **422 invalid**이며 턴을 유지한다. 같은 턴 동시 재개의 늦은 요청이나 만료된 턴·다른 사용자의 턴은 **404 not_found**다.
- 서비스별 409는 상태 전이 거부나 고유 제약 충돌도 포함한다. **무조건 같은 쓰기 요청을 재전송하지 말고** 최신 상세 조회 후 사용자의 선택·동의/확정 여부를 다시 확인한다.

세부 근거: [visit/service.py](../../backend/app/visit/service.py) · [schedule/service.py](../../backend/app/schedule/service.py) · [chat/service.py](../../backend/app/chat/service.py) · [v2/ask.py](../../backend/app/v2/ask.py) · [실제 호출 순서](workflows.md).
