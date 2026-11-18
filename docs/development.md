# 개발 환경과 실행

[문서 목록](README.md) · [개발 흐름](development-flow.md) · [테스트와 QA](testing.md)

## 준비

- Docker Desktop과 Docker Compose의 `watch` 지원 버전
- PC에서 직접 실행할 경우 Python **3.12.x**(`backend/pyproject.toml`의 `>=3.12,<3.13`), uv, Node.js 24.18 이상, pnpm 11.22.0(`frontend/package.json` 기준)
- 저장소 루트의 `.env`. `.env.example`을 복사하고 DB 비밀번호를 바꾼다. 기존 `.env`가 있으면 덮어쓰지 않는다.

`.env`는 Git에서 제외한다. 사용자별 PC 절대 경로나 키를 문서·이슈·PR에 넣지 않는다.

## Docker로 실행

저장소 루트에서 실행한다. 아래 파일 복사 예시는 PowerShell이다.

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
# .env의 POSTGRES_PASSWORD를 설정한 뒤 실행
docker compose up --build --watch
```

Compose는 `compose.yaml`에 `compose.override.yaml`을 덧붙인다. DB 준비 후 `migrate`가 스키마를 올리고 API·worker가 시작한다. 웹 파일 변경은 `watch`가 컨테이너에 복사하며, package.json·잠금 파일 변경 시 이미지를 다시 만든다.

| 대상 | 기본 로컬 주소 | 바꿀 설정 |
| --- | --- | --- |
| 화면 | `http://localhost:3000` | `WEB_HOST_PORT`, `ALLOWED_ORIGINS` |
| API 문서 | `http://localhost:8000/docs` | `API_HOST_PORT` |
| PostgreSQL | `127.0.0.1:5433` | `DB_HOST_PORT` |
| Redis | `127.0.0.1:6379` | `REDIS_HOST_PORT` |

`/docs`와 `/openapi.json`은 `APP_ENV=production`이면 비활성화된다. API의 주소·쿠키 인증·Swagger 쓰기 요청의 Origin 제한·현재 97개 엔드포인트는 [API 사용 안내](api/README.md)를 참고한다. 브라우저에서는 `/api/*`를 사용하고, FastAPI 원본은 `/api` 접두어가 없다.

`watch`를 끈 동안 수정한 웹 코드는 `docker compose up -d --build web`으로 다시 반영한다. 종료할 때는 `docker compose down`을 사용한다. `down -v`는 DB·파일 볼륨까지 지우므로 개발자가 보존 여부를 판단한 경우에만 실행한다.

## API와 화면을 PC에서 직접 실행

DB·Redis만 Docker에서 띄우고 API와 Next.js는 서로 다른 터미널에서 실행할 수 있다.

```powershell
# 저장소 루트
docker compose up -d db redis
cd backend
uv sync --locked
$env:DATABASE_URL = 'postgresql+asyncpg://mitjip:<URL인코딩한_DB비밀번호>@127.0.0.1:5433/mitjip'
$env:REDIS_URL = 'redis://127.0.0.1:6379/0'
$env:ALLOWED_ORIGINS = 'http://localhost:3100,http://127.0.0.1:3100'
uv run --env-file ../.env alembic upgrade head
uv run --env-file ../.env uvicorn app.main:app --host 127.0.0.1 --port 8000
```

DB 이름·사용자·포트를 바꿨다면 URL도 맞춘다. 비밀번호의 `@`, `:`, `/` 등은 URL 인코딩해야 한다. 직접 실행하는 앱은 루트 `.env`를 자동으로 읽지 않으므로 위처럼 `--env-file`을 쓰거나 필요한 환경변수를 먼저 설정한다.

다른 터미널에서는 저장소의 `frontend/`로 이동한다.

```powershell
pnpm install --frozen-lockfile
$env:API_INTERNAL_URL = 'http://127.0.0.1:8000'
pnpm dev --hostname 127.0.0.1 --port 3100
```

화면 주소는 `http://127.0.0.1:3100`이다. 환경변수는 서버 실행 전에 설정한다. `pnpm`을 찾지 못하면 Node.js·pnpm 설치와 터미널 PATH를 확인한다.

## 시험 계정과 시연

- `.env`의 `SEED_PASSWORD`를 설정하면 로컬 Compose의 migrate 단계가 시험 계정을 만든다. 계정 목록과 생성 규칙은 [seed.py](../backend/app/seed.py)를 따른다.
- `/demo`는 로컬·시연 데이터용 흐름이다. [demo.py](../backend/app/demo.py)와 [시연 테스트](../backend/tests/test_demo.py)를 확인한다.
- `DEMO_AUTO=true`면 worker가 시연 업체의 견적·날짜 응답을 대신한다. production에서는 작동하지 않는다. 실제 업체가 응답한 것처럼 검증 결과를 적지 않는다.

## AI와 데이터

- 기본값 `LLM_LIVE=false`는 스텁 응답이다. 실제 상담에는 `LLM_LIVE=true`와 `OPENAI_API_KEY`가 필요하며 비용이 발생한다.
- Jev는 `OPENROUTER_API_KEY`를 별도로 사용한다. `JEV_ENABLED=false`는 비교·시험용 설정이며 정상 운영 품질 검증과 구분한다.
- 모델·추론 강도·키는 [설정 코드](../backend/app/config.py)와 `.env.example`을 함께 확인한다. 예시 환경변수에 이름이 있어도 모두 연결된 기능은 아니다. `AGENT_DAILY_TOKEN_LIMIT`(일일 토큰 한도), `MCP_SERVER_URL`·`MCP_HOST_PORT`(일정 MCP), `VOYAGE_API_KEY`·`VOYAGE_RERANK_MODEL`(Voyage 리랭커)은 현재 앱 설정·호출에 연결되지 않았다. 검색은 현재 BM25와 pgvector를 조합한다.
- DB 마이그레이션은 데이터 적재·임베딩을 대신하지 않는다. [기준 데이터 안내](reference-data.md)의 순서로 따로 진행한다.
