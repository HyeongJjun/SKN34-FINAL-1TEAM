# 개발자 검증 기록

실제로 돌린 것만 적어요. 날짜 · 명령 · 결과(통과/실패, 숫자)를 그대로 남겨요. 제품 코드는 고치지 않았어요(실험은 스크래치 폴더).

- 스크래치 폴더: `C:\Users\lsm15\AppData\Local\Temp\claude\9fde9263e2ae7b10\4f9af5b4-65b7-4ec0-9f70-41add44e991c\scratchpad\`(아래 `scratch\`)
- 테스트 실행기: `scratch\run_pytest_dev.py` — 메인 체크아웃 `.env`에서 `POSTGRES_USER` · `POSTGRES_PASSWORD` · `DB_HOST_PORT` 세 값만 읽어 환경변수로 넘기고(값은 찍지 않음), `TEST_DB_NAME=mitjip_test_dev` · `TEST_REDIS_URL=redis://127.0.0.1:6379/14` · `LLM_LIVE=false` · `OPENAI_API_KEY=` · `ANTHROPIC_API_KEY=` · `OPENROUTER_API_KEY=` · `JEV_ENABLED=false`로 `uv run pytest`를 불러요.

| 날짜 | 무엇 | 명령 · 방법 | 결과 | 남은 일 |
| --- | --- | --- | --- | --- |
| 2026-11-18 | 백엔드 테스트(v3가 기대는 것: 기한 계산 · 가견적 · 알림 dedup · AI 대화 rev · 실측 요청 칸 UQ · 입구 보호 · 상태 확인 · 단가 · 공사 날짜) | `python scratch\run_pytest_dev.py tests/test_calc_schedule.py tests/test_calc_estimate.py tests/test_notify.py tests/test_chat_store.py tests/test_visit_request.py tests/test_guards.py tests/test_health.py tests/test_vendor_price.py tests/test_dates.py -q -p no:cacheprovider` (backend 폴더) | **통과 133 · 실패 0**, 244.94초. conftest가 `mitjip_test_dev`를 새로 만들고 migration up → down → up을 돌림 | 전체 테스트는 B1a가 0단계 뒤에 |
| 2026-11-18 | 백엔드 린트 | `uv run ruff check` · `uv run ruff format --check` | **통과**(All checks passed · 238 files already formatted) | |
| 2026-11-18 | 프런트 타입 검사 | `pnpm typecheck` (wt-v3/frontend) | **통과**(exit 0, 14.25초) | |
| 2026-11-18 | 프런트 린트 | `pnpm lint` | **통과**(exit 0) | `pnpm build`는 다른 역할의 `.next`와 겹칠까 봐 이번에 돌리지 않았어요 → 검증 대기 |
| 2026-11-18 | FastAPI 내장 SSE가 있는지 | `uv run python -c "import fastapi.sse …"` + `fastapi/routing.py` 읽기 | FastAPI **0.162.0**, `fastapi.sse`(EventSourceResponse · ServerSentEvent · KEEPALIVE_COMMENT) 있음, `_PING_INTERVAL = 15.0`, SSE 응답에 `Cache-Control: no-cache` · `X-Accel-Buffering: no`. `sse-starlette` 3.7.0은 `mcp`가 끌고 옴 → **새 의존성 필요 없음** | |
| 2026-11-18 | 사용자별 Redis Stream + SSE, uvicorn 2프로세스 | `scratch\sse_lab\app.py`를 `uv run uvicorn app:app --workers 2 --port 8791`, `scratch\sse_lab\client.py http://127.0.0.1:8791` 4번 | 1회: 받은 글 5/6(6번째는 다시 열 때 `Last-Event-ID`로 받음). 원인은 확인 못 했어요 — 그 직전에 프로세스 하나가 시작 때 WinError 10022로 죽었다 다시 떴고, 같은 실험을 다시 돌린 2~4회는 모두 받았어요. 2~4회: **6/6**, 다른 프로세스가 쓴 글 2 · 2 · 4개, 보낸 때 → 받은 때 최대 0.016~0.276초, `Last-Event-ID`로 다시 열어 놓친 2개 정확히 받음, 끊은 뒤 SSE용 Redis 연결 **0개** | Linux(운영)에서 다시 재기. Windows 다중 프로세스 오류는 로컬 한정 |
| 2026-11-18 | curl로 마지막 글이 늦게 오는지 | `curl -sN …/stream` 열고 글 2개 보내기 | 각 글이 1초 안에 끝 줄까지 옴(쌓임 없음) | |
| 2026-11-18 | **Next 16.4.5 개발 서버 `/api/*` 다시 쓰기로 SSE** | 스크래치 최소 Next 앱(`scratch\next_lab`, `node_modules`는 wt-v3/frontend에 junction, 제품과 같은 rewrites) `next dev --port 3199` → `scratch\sse_lab\timing.py` · `client.py` | 압축 켬(기본): 응답에 `content-encoding: gzip`이 붙고 **20초 동안 글 0바이트**(ping도 안 옴), client 0/6 → **실패**. `compress: false`: 글이 바로 옴(보낸 때와 같은 0.0초대), client 6/6 · 다시 잇기 정확 · 끊으면 연결 0개 → **통과** | B7이 `frontend/next.config.ts`에 `compress: false`를 넣어요(운영 압축은 Caddy) |
| 2026-11-18 | 9판 금액을 지금 계산 엔진으로 맞춰 보기 | `uv run python -c` (calc.dobae.quote · common.won · with_vat, DOBAE_2026H2) | C07 표준견적서(공급 69.4㎡ · 실크 · 빈 집): 지금 엔진은 도배지 ㎡ × 3,325로 2,077,210원. 도배지 줄만 63.0평 × 9,500으로 바꾸면 공급가 1,794,608 · 부가세 179,461 · 합계 **1,974,069원 = 화면과 같음**. C11 가견적(1201~1208): 2,896,500 + 289,650 = **3,186,150원 = 화면과 같음**. C60 부분(46%): 지금 초배지 비율(벽 1.2)이면 640,098원, 화면 638,501원은 1.1로 그린 **예시값** | 합지 평당 시장 평균은 B6 |
| 2026-11-18 | 화면 109개가 경로 표에 다 들어갔는지 | `scratch\make_routes.py`가 `screens.json` 키와 표 키를 견줌(빠짐 · 남음이면 멈춤) | 109줄, 빠짐 0 · 남음 0 | |
| 2026-11-18 | 실험 정리 | 포트 3199 · 8791 프로세스 끔, Redis db 13 `v3lab:*` 키 7개 지움 | 남은 것 0 | |

## 못 한 것과 이유

- Caddy(`encode`에서 `/api/stream*` 빼기)와 Cloudflare를 지나는 SSE: 로컬에 Caddy가 없고 이미지를 받아야 해서 하지 않았어요 → 스테이징에서 2분 넘게 열어 두고 재요(B7 · 리드).
- `pnpm build`: 위 표 참고(검증 대기).
- e2e(Playwright): 아직 코드가 없어요(B8).
