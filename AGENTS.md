# 믿집 작업 지침

- 기준 자료 버전은 `status BOOLEAN`(기본값 `False`)으로 활성 여부만 관리하며 상태 변경 이력을 저장하지 않는다.
- 기준 데이터·전처리 테이블·RAG 관련 작업 전 [기준 데이터 사용 안내](docs/reference-data.md)를 확인한다.

## 1. 제품 규칙

- 가견적은 업체가 직접 넣고 확인한 단가로 계산 엔진이 만든다. 확인 전에는 고객에게 보이지 않는다.
- 고객 연락처는 고객이 업체마다 동의했을 때만 업체에 간다.
- 실측 견적서는 업체가 자기 양식 파일(PDF · 엑셀 · 사진)로 내고, 낼 금액 · 부가세 방식 · 공사 기간 · 유효기간만 칸에 적는다. 믿집 양식은 공공 기준으로 계산한 표준견적서 하나다.

## 2. 구조와 호출 흐름

하나의 FastAPI 앱을 기능별 패키지로 나눈 모듈러 모놀리스다. 패키지 · 층 · 호출 경로는 [v3 구조](docs/v3/architecture.md) · [v3 데이터 모델](docs/v3/data-model.md) · [v2 구조](docs/v2/structure.md), 구현·검증 근거는 [기능 개발표](docs/feature-roadmap.md)를 본다.

| 부분 | 하는 일 |
| --- | --- |
| `frontend/` (Next.js) | 화면만. DB 접근 · LLM 호출 · 금액 계산을 하지 않는다 |
| `backend/app/` (FastAPI) | 유일한 공개 API. 기능 패키지 + 계산 엔진 `calc` + 에이전트 `agent` |
| `backend/app/worker.py` (arq) | 1분 주기 `sweep_jobs`(실측·견적·공사 기한 처리), 선택적 시연 `DEMO_AUTO` |
| PostgreSQL + pgvector · Redis | 원본 데이터와 지식 검색은 PostgreSQL. Redis는 큐 · 요청 제한 · 실시간 알림 · 짧은 캐시처럼 지워져도 되는 것만 |

- 기능 안 파일은 필요한 것만 둔다: `router.py`(HTTP), `service.py`(업무 흐름 · 상태 · commit), `repository.py`(DB), `schemas.py`, `models.py`, `client.py`(외부 API).
- 둘 이상이 실제로 쓰는 코드만 `shared/`에 하는 일 이름으로 둔다. 관리자 API는 각 기능 router에 `/admin/...`으로 둔다.
- AI 상담 구조는 [v3 AI 설계·현황](docs/v3/agents.md) · [AI 협약](docs/agent-contract.md)을 본다. 기본은 무료 모드이고 `LLM_LIVE=true`와 키가 함께 있을 때만 LLM을 부른다.

**호출 흐름**

- 화면 읽기: Server Component → `lib/api/<영역>.ts` → `lib/backend/server.ts`(`API_INTERNAL_URL`, 브라우저 쿠키를 넘김) → API.
- 화면 쓰기: 브라우저 → 같은 주소 `/api/*`(`lib/backend/client.ts`) → 개발은 Next, 운영은 Caddy가 API로 넘긴다. Server Action은 쓰지 않는다.
- API 안: 미들웨어(`CatchAll` · `BodyLimit` · `OriginGuard`) → `router` → `deps`(세션 · 권한) → `service` → `repository` → PostgreSQL. 오류는 모두 `{"error": {code, message, fields?}}`.
- 기한 일: 업무 service가 `jobs` 행을 만들고 `worker.sweep_jobs`가 만기 일을 처리한다.
- 화면 알림: 상태를 바꾸는 service가 같은 트랜잭션에 `notify.service.add`로 쓴다(`dedup_key`로 한 번만). 문자 · 메일 같은 바깥 발송은 아직 없다.
- 호출 흐름을 바꿨다면 이슈 본문 '호출 흐름'에 한 줄로 적는다. 예: `web → /api/projects → project.service → files.service → PostgreSQL`.

**층 규칙** (층 그림은 [v3 구조](docs/v3/architecture.md))

- 다른 기능은 그 기능 service의 공개 함수로만 부른다. 다른 기능 models는 읽기 조인에만 쓰고, router끼리 import하지 않는다.
- 예외는 하나: `/me`가 업체 승인 상태를 읽으려고 `auth.service → vendor.repository`를 함수 안에서 늦게 import한다.
- `calc`는 DB · HTTP · 시계를 모르는 순수 함수다. 오늘 날짜는 인자로 받는다.
- `agent`는 기능 service를 import하지 않는다. 기능 데이터는 도구로 넘겨받는다.

## 3. 돈 · 날짜 · 상태

- 금액, 수량, 기간, 날짜는 계산 엔진(`calc`)만 만든다. 화면, 에이전트, 프롬프트에서 계산하지 않는다. 업체가 적은 줄 금액은 입력값이고 합계 · 부가세는 계산 엔진이 만든다.
- 금액은 원 단위 정수(`int`, DB `bigint`). 반올림은 계산 엔진 한 곳에서만 한다. 부가세는 따로 저장하고, 고객이 보는 금액은 부가세 포함으로 보여 주며 'VAT' 대신 '부가세'라고 쓴다. 공급가와 부가세를 나눠 보여 주는 곳은 견적서 합계 칸 하나다.
- 면적은 ㎡(`numeric(7,1)`)와 기준(공급 · 전용)을 함께 저장한다. 평은 표시할 때만 계산한다. 품은 0.5 단위로 올림한다.
- 날짜는 서울 기준 `date`, 시각은 `timestamptz`. 공휴일은 데이터로 둔다.
- 표준견적서 줄은 표준 행 키와 포함 상태 6종(포함 · 묶음 포함 · 따로 계산 · 선택 · 실측 후 · 안 함)으로 저장한다. 합계에는 '포함'과 '따로 계산'만 들어간다.
- 업체 실측 견적서는 줄로 바꾸지 않는다. 파일과 업체가 적은 칸을 버전으로 쌓고, 공급가 · 부가세 · 합계는 계산 엔진이 만든다. 고객이 확정한 버전은 바꾸지 않는다.
- 상태는 기능별 service 한 곳에서만 바꾼다: 허용 전이 확인 → 조건부 UPDATE(1행이 아니면 409) → 같은 트랜잭션에 이력 행. 업체 확정 · 다시 고르기 · 공정표 확정 · 일정 변경 승인은 사람이 누른 요청으로만 일어난다.
- 업체 날짜 제안 · 고객 날짜 수락은 공정표 버전을 확인하고, 버전 충돌·동시 수락·일정 겹침은 409로 막는다(`schedule.service`).

## 4. 에이전트

- 에이전트는 DB에 쓰지 않고 확정 · 저장 권한이 없다. 확정 · 일정 변경은 사람이 누른 요청으로만 반영한다.
- 사용자와 `project_id`는 서버가 세션으로 고정하고 LLM 출력으로 받지 않는다. 업체가 쓴 글은 지시문에 넣지 않고 데이터로만 넘긴다.
- LLM SDK 호출은 `app/agent/llm.py` 한 곳에서만 한다.
- LLM이 실패하면 계산 결과만 보여 주고 "설명을 만들지 못했어요"라고 알린다. 규칙으로 만든 가짜 설명으로 채우지 않는다.
- CI에서 유료 호출은 0회다(`LLM_LIVE=false` 스텁). 스텁 통과를 에이전트 품질 확인으로 말하지 않는다.

## 5. 코드 작성

**고치는 범위**

- 요청한 것만 고친다. 고칠 파일은 꼭 필요한 것만 고르고, 요청 범위 밖의 리팩터링 · 파일 이동 · 이름 바꾸기 · 일괄 포맷을 하지 않는다.
- 작업하다 보인 다른 문제는 고치지 않고 이슈로 남긴다. 기존 코드를 이 문서에 맞추려고 한꺼번에 고치지 않는다.
- interface · base class · factory는 실제 구현이 둘 이상이거나 외부 경계일 때만 만든다.
- 새 의존성이나 외부 서비스는 추가하기 전에 이슈로 알린다.

**backend**

- 트랜잭션 안에서 외부 API · LLM을 부르지 않는다. 사진 처리 같은 느린 일은 DB를 쓰기 전에 끝내고, 디스크에 쓴 파일은 DB 저장이 실패하면 지운다.
- 이벤트 루프를 막는 일(비밀번호 해시, 그림 처리, 파일 쓰기)은 작업 스레드로 넘긴다.
- 같은 요청이 동시에 두 번 와도 500이 되지 않게: 고유성은 DB 제약으로 지키고 IntegrityError는 409로 바꾼다.
- 스키마는 Alembic migration으로만 바꾼다. autogenerate 결과는 읽고 고친 뒤 커밋하고(CHECK는 손으로 더함), 이미 적용된 migration은 고치지 않고 새 revision을 더한다.
- 고유성 · 참조 · 값 범위는 DB 제약(UNIQUE, FK, CHECK)으로도 지킨다. JSONB는 통째로 남기는 기록에만 쓴다.
- 로그 · 오류 메시지에 입력값과 개인정보를 넣지 않는다.

**frontend**

- Server Component가 기본이고, `"use client"`는 상호작용이 필요한 곳에만 붙인다. 화면 권한은 `lib/session.ts`의 `requireRole`로 확인한다.
- API를 바꿨으면 `pnpm gen:api`로 `lib/backend/schema.d.ts`를 다시 만든다. 이 파일은 손으로 고치지 않는다.
- 예시 데이터(`lib/mock/`)와 실제 API는 `lib/api/<영역>.ts` 안에서만 바꾼다.
- 색 · 글자 크기는 `globals.css` 토큰만 쓴다. `globals.css`에는 토큰과 여러 화면이 같이 쓰는 공용 클래스(`mj-` 접두어)만 두고, 한 화면 · 컴포넌트에만 쓰는 스타일은 그 옆 `*.module.css`에 둔다.
- 화면 문구에 영어 상태값을 보이지 않는다.

## 6. Git · 이슈 · PR

- 팀 저장소(upstream)를 fork한 내 저장소(origin)에서 작업한다. 기능 PR 대상은 팀 `dev`이고, 절차는 [팀 기여 가이드](CONTRIBUTING.md)를 따른다.
- 브랜치는 `작업유형-기능이름`(영어 소문자 · 하이픈, 예: `feat-vendor-signup`), 커밋 제목은 `type: 한국어 요약`이다. type은 `feat · fix · docs · test · chore · refactor · prompt · eval`.
- 이슈 제목도 커밋 제목 형식으로 쓴다. 기능 PR 제목은 이슈 제목과 같고, squash 병합 때 그대로 dev의 커밋 제목이 된다.
- 이슈 · PR 본문은 [이슈 템플릿](.github/ISSUE_TEMPLATE/task.md) · [PR 템플릿](.github/pull_request_template.md)을 따른다. 검증 결과는 실제로 돌린 것만 `[x]`로 적는다.
- 한 PR에 기능 여러 개를 담을 때는 커밋을 기능 하나 단위로 나눈다.
- 커밋 · PR에 `Co-Authored-By` 같은 공동 작성자 줄이나 도구 홍보 문구를 넣지 않는다.
- 이슈 · PR · 커밋 · 문서 · 코드 주석은 한국어로 짧게 쓴다. 바뀐 것만 적고 과정 설명은 쓰지 않는다. 브랜치와 코드 이름은 영어로 쓴다.
- `.env`는 커밋하지 않는다. 새 환경변수는 `.env.example`에 한국어 주석과 함께 더한다.
- AI 코딩 도구는 사람이 요청했을 때만 커밋 · 푸시한다.

## 7. 검증

- CI(`.github/workflows/ci.yml`)가 PR마다 저장소 점검(`.github/scripts/check_repo.py`), backend(ruff, migration head 하나, 실제 DB로 pytest), frontend(API 타입 비교, typecheck · lint · build)를 돌린다.
- 로컬에서는 바꾼 범위만 확인한다.
  - backend: `uv run pytest <대상>`, `uv run ruff check`, `uv run ruff format --check`
  - frontend: `pnpm typecheck`, `pnpm lint`. API를 바꿨으면 `pnpm gen:api`
  - migration: `docker compose run --rm migrate`로 실제 DB에 올리고 `alembic check`로 모델과 차이가 없는지 본다
  - compose · Dockerfile: `docker compose config --quiet`
  - 저장소 점검: `python .github/scripts/check_repo.py`
  - 화면: 폰 너비 360px에서 가로 스크롤이 없고, 버튼 · 입력 칸이 40px 이상인지 본다
- 반드시 테스트할 것:
  - 계산 엔진
  - 상태 변경과 동시 요청(409)
  - 권한: 남의 것은 404, 역할이 다르면 403
