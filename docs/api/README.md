# 믿집 API 안내

[문서 목차](../README.md) · [등록 엔드포인트 97개](endpoints.md) · [인증·공통 오류](common.md) · [주요 호출 흐름](workflows.md) · [API 테스트](../testing.md)

**기준:** 2026-11-18 팀 `dev` 커밋 `1a3e65661924e93225914ebb4b440bbd8330cc2a`(PR #141 병합). [`backend/app/main.py`](../../backend/app/main.py)에 등록된 10개 업무 라우터와 상태 확인 2개를 합쳐 **86개 URL 경로, 97개 HTTP 메서드별 API**를 확인했다. 이 문서는 그 커밋의 **코드 계약**을 설명하며, 실제 AWS 서버의 배포 버전이나 외부 QA 완료를 나타내지 않는다.

## 정본과 문서 역할

| 알아볼 내용 | 읽을 곳 |
| --- | --- |
| 입력/성공 응답 필드, enum, 필수 여부, 쿼리·경로 매개변수, 문서화된 상태 코드 | **FastAPI가 해당 코드에서 생성한 `/openapi.json`**, 개발용 Swagger `/docs` |
| 실제 오류의 HTTP 상태·`error.code`·응답 본문 | [인증·공통 오류](common.md). **자동 생성된 기본 422 `detail` 모형과 실제 커스텀 응답이 다를 수 있음** |
| 실제 메서드·경로, 업무 목적, 권한과 구현 함수 위치 | [엔드포인트 목록](endpoints.md) |
| 쿠키 세션, 역할·승인, 공통 오류, Origin, 한도와 중복 요청 | [공통 계약](common.md) |
| 고객·업체·관리자 순서, 화면 확인, 견적/날짜 버전, v2 상담·저장 | [호출 흐름](workflows.md) |
| 변경/검증 기록과 기능별 구현 상태 | [기능 개발표](../feature-roadmap.md) · [근거 점검](../verification/2026-11-18-documentation.md) |

개별 스키마 전체를 Markdown에 복사하지 않는다. API 필드가 달라지면 FastAPI의 Pydantic 모델·라우터를 먼저 수정하고 OpenAPI를 다시 생성한다. 이 문서는 **권한·상태·사용 순서**와 구현 위치를 설명한다. [`frontend/lib/backend/schema.d.ts`](../../frontend/lib/backend/schema.d.ts)는 생성 파일이므로 직접 편집하지 않는다.

## 어느 주소로 호출하나요?

| 환경 | 주소 예 | 의미 |
| --- | --- | --- |
| 로컬 FastAPI 직접 접근 | `http://localhost:8000/projects` | 실제 백엔드 경로. `/api` 접두어가 **없음** |
| 로컬 브라우저(Next.js) | `http://localhost:3000/api/projects` | 같은 출처의 `/api/*`를 Next.js rewrite가 FastAPI의 `/*`로 전달 |
| AWS 스테이징 웹 | `https://<배포된-호스트>/api/projects` | Caddy `handle_path /api/*`가 접두어를 제거하고 FastAPI로 전달. 실제 호스트는 배포 환경 설정에서 확인 |

근거: [Next.js rewrite](../../frontend/next.config.ts), [Caddyfile](../../deploy/aws/Caddyfile), [프런트 API client](../../frontend/lib/backend/client.ts). 아래 표와 OpenAPI의 `/projects`, `/v2/ask` 등은 **백엔드 기준 경로**다. 프런트에서 호출할 때만 `/api`를 앞에 붙인다.

## Swagger와 OpenAPI 보기

로컬 앱을 실행한 뒤 다음 주소를 사용한다.

- Swagger UI: `http://localhost:8000/docs`
- OpenAPI JSON: `http://localhost:8000/openapi.json`
- 브라우저 앞단 API 호출: `http://localhost:3000/api/...`

`backend/app/main.py`는 `APP_ENV=production`이면 Swagger `/docs`와 `/openapi.json`을 **비활성화**한다. ReDoc `/redoc`은 환경에 관계없이 제공하지 않는다. 스테이징이나 로컬에서 보이더라도 운영 서버에 문서가 항상 공개된다고 가정하지 않는다. [개발 환경](../development.md)을 참고한다.

**인증 표시 주의:** Swagger에 `security` 항목이나 자물쇠가 표시되지 않는 것은 쿠키 인증 검사가 없다는 뜻이 아니다. 대부분의 작업 API가 `Depends(current_user)`, `require_role`, `approved_vendor`로 사용자·권한을 검사한다. [엔드포인트 목록](endpoints.md)의 **인증·역할** 열을 확인한다.

**Try it out 주의:** Swagger를 `localhost:8000/docs`에서 연 브라우저의 POST/PUT/PATCH/DELETE에 `Origin: http://localhost:8000`이 붙는 경우, 기본 허용 출처(`localhost:3000,3100`)에 없다면 `403 bad_origin`이 반환된다. Origin이 없으면 이 검사 조건은 실행되지 않는다. 브라우저에서 쓰기 API를 시험하려면 **로컬 개발 설정**에서 Swagger 출처를 허용 목록에 추가해야 할 수 있다. 이미 실행 중인 서버나 운영 설정을 문서 작업으로 변경하지 않는다. 본문·권한 오류와 구별하고, 허용 출처 조건은 [공통 계약](common.md)을 참고한다.

## 최소 호출 예시 (가짜 데이터만 사용)

인증 없이 확인 가능한 **지역 목록**:

```bash
curl --request GET http://localhost:8000/regions
```

실제 로그인 세션이 이미 있는 **동일 출처의 웹 화면**:

```ts
const result = await fetch("/api/projects", {
  method: "GET",
  credentials: "same-origin",
});
if (!result.ok) {
  const error = await result.json();
  // 예: { error: { code: "login_required", message: "로그인해 주세요." } }
  throw new Error(error.error?.code ?? "api_error");
}
const projects = await result.json();
```

이 코드는 호출 모양을 보여 주는 예시다. `/projects`는 **고객 역할**이 필요하며, 브라우저에 로그인 쿠키가 없다면 `401`이 반환된다. 비밀번호·세션 쿠키·실제 고객 데이터는 문서나 테스트 기록에 넣지 않는다. 요청을 실제로 변경하는 예시는 [업무 흐름](workflows.md)에서 확인한다.

## 갱신·검증 규칙

1. `main.py`의 `ROUTERS`와 실제 `router.py`의 메서드·경로·Depends 및 서비스 내부 권한 검사를 확인한다. 별도 `chat/router.py`와 빈 `mcp_server.py`를 공개 API에 추가하지 않는다.
2. OpenAPI를 현재 코드에서 생성해 경로·메서드·입출력 모델을 확인한다. UI 경로의 `/api` 접두어를 Swagger에 중복 기입하지 않는다.
3. 바뀐 엔드포인트는 [목록](endpoints.md), 역할·오류는 [공통 계약](common.md), 상태 변경·화면 확인은 [호출 흐름](workflows.md)을 갱신한다. 코드 상태와 검증 근거는 [기능 개발표](../feature-roadmap.md)와 구분한다.
4. API가 바뀌었다면 로컬 서비스에서 `frontend/`의 `pnpm gen:api`를 사용해 `schema.d.ts`를 재생성하고 타입·해당 테스트를 검증한다. 문서만 수정할 때는 생성물을 불필요하게 변경하지 않는다.
5. 실제 실행 테스트·CI·운영 서버 QA를 하지 않았으면 통과로 표시하지 않는다. 이 문서 작업은 로컬 문서 수정·검증만 수행했고 GitHub 이슈·PR·배포·제품 코드를 변경하지 않는다.
