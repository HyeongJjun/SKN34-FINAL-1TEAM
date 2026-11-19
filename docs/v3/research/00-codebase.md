# 지금 코드 조사 (v3 시작점: 팀 dev 1a3e656)

- 조사: 2026-11-18, 리드가 맡긴 읽기 전용 조사(하위 에이전트). 경로는 `C:\Workspace\SKN34\wt-v3\` 기준이에요.
- 요약만 적어요. 자세한 것은 코드에서 확인해요.

## 먼저 알아 둘 것

- 빈 파일이 있어요(0바이트): `backend/app/chat/router.py` · `chat/schemas.py` · `chat/tools.py` · `backend/app/mcp_server.py` · `backend/app/calc/vendor_score.py`.
  - `frontend/lib/api/chat.ts`는 `export {}`뿐이고, `frontend/components/chat/` 폴더는 비어 있어요.
- `langgraph` · `mcp` · `langchain-mcp-adapters`는 설치돼 있지만 아무 데서도 쓰지 않아요.
- README는 MCP 서버 · 코드 점수 업체 추천 · SSE 채팅 · 평가 세트 50/30/15를 적었지만, 코드에는 없어요.

## 백엔드 (`backend/app/`)

| 패키지 | 하는 일 |
| --- | --- |
| account | `POST /me/withdraw` |
| auth | argon2id, 쿠키 세션(`mj_sid` / https면 `__Host-mj_sid`), 가입 · 로그인 · 로그아웃 · `/me`, `deps.current_user` · `require_role`, `cli.py create-admin` |
| agent | 입구 분류기 · LLM 래퍼(아래 '에이전트') |
| calc | 순수 계산 함수(아래 '계산 엔진') |
| chat | AI 대화 저장만 해요(`create/get_for/recent/save_turn`, `rev`로 동시 쓰기 막음). router는 연결돼 있지 않아요 |
| files | 내용으로 형식 판별, EXIF · GPS 지움(`images.py`), 로컬 또는 S3(`storage.py`) |
| knowledge | `bm25.py`(키워드 + RRF, 인용 검사), `service.search/verify_cites/suggest_*`, `repository.nearest`(pgvector), `ingest.py` · `sources.py` · `suggest.py`. `hybrid.py`는 `evaluation/rag/`에 있어요 |
| notify | 화면 알림(`add` · `unread_count` · `page` · `mark_read` · `mark_all_read`) |
| project | 집 정보 만들기 · 보기 · 고치기, `lock_for_visit`, `/regions` |
| quote | 표준견적서 판(`ensure_standard`), 업체 실측 견적서(`save_draft` · `seal_draft` · `compare`) |
| refprice | 기준 단가 · 상수 |
| schedule | 예상 · 확정 공정표, deals(확정 · 다시 고르기), 날짜 제안 · 요청, 추가 금액, 끝냄 · 확인, overview, 서류, 업체 작업함. `service.py`가 2,174줄이에요 |
| shared | 서울 시계 · 오류 모양 · uuid7 · Redis 요청 제한 · 지역 · `BodyLimit` · `CatchAll` |
| v2 | `/v2` API: 계산(v10 화면에서 옮김) · AI 상담(`ask*.py` · `guard.py` · `level.py` · `prompts/`) · 저장 사례(`case_*`) · 도면 미리보기 |
| vendor | 업체 가입 · 관리자 심사(이력) · 업체 정보/FAQ/링크/사례 · 단가표(`save_prices` · `confirm_prices`) · 근거 파일 |
| visit | 업체 목록 · 자세히 + 가견적(`vendors_for` · `vendor_detail`), 실측 요청 · 취소 · 거절, 업체 견적 보드, 연락처 공개 |

- `worker.py`(arq)에는 `ping`과 `demo_reply`만 있어요. `demo_reply`는 `DEMO_AUTO`일 때 5초마다 돌아요.
- `data_ingest.py`는 `data/processed` CSV를 `ref_*` 표와 `rag_chunks`(1536차원)에 넣어요.
- `demo.py`는 시연 고객 · 업체 6곳 · 단계별 프로젝트를 만들고, `seed.py`는 로컬 계정 4개를 만들어요(비밀번호는 `SEED_PASSWORD`).

## DB

- 마이그레이션은 0001 → … → 0022_chat → **0023_reference_simplify(head)**로 한 줄로 이어져요.
- 표는 44개예요. v3와 관련된 것만 적어요.

| 묶음 | 표와 핵심 |
| --- | --- |
| 프로젝트 | `projects`: house_type이 CHECK로 'apt'만 돼요. 크기는 size_band 10~50 또는 area_m2 + area_basis(supply/exclusive). start_kind date/movein/months/unknown, budget 구간, code · rev · locked_at · apt_name/dong/ho |
| 공종 | `project_trades`: dobae/mokgong. grade economy/basic은 도배만, items는 목공만 |
| 견적 | `standard_quotes`/`lines`, `vendor_quotes`(Q-YYYY-N, vat_mode, days 1~120, valid_until) · `vendor_quote_files`(10개) |
| 업체 | `vendors`: pending/needs_info/approved/rejected, contact_method, visit_fee, tax_kind |
| 업체 단가 | `vendor_price_sets`(draft/confirmed/retired) · `vendor_price_lines`(unit_price 또는 included_in) |
| 업체 심사 | `vendor_reviews`는 **관리자 심사 이력**이에요. 고객 리뷰가 아니에요 |
| 실측 | `visits`: slot 1~3, requested/quoted/cancelled/declined/closed/chosen, 가견적 사본. 이력은 `visit_events` |
| 공정표 | `plans`(expected/final) · `plan_steps` · `plan_days` |
| 확정 · 공사 | `deals`(confirmed/scheduled/checking/fixing/done/reselected) · `deal_events` · `date_requests` · `date_proposals` · `extra_charges`(+files) |
| AI | `chats`(rev, waiting) · `chat_messages`(의도 · 신뢰도 · 출처), `v2_cases` |
| 기준 자료 | `ref_dataset_versions` · `ref_*_rows` · `rag_chunks`(pgvector + 출처) |

## API

- 경로는 97개예요. 로그인 없이 쓰는 것은 `/health/*` · `/regions` · `/auth/signup|login|logout` · `/auth/vendor-signup`뿐이에요.
- 고객: `/projects/{id}` 아래에 standard · plan · vendors · vendors/{vid} · visits · quotes · confirm · deals · dates · date-requests · extras · check · overview · docs · schedule이 있어요.
- 업체
  - 작업함: `/vendor/visits?tab=todo|waiting|jobs|done` · summary
  - 공사: `/vendor/jobs/{deal}`(dates · extras · done)
  - 견적서: `/vendor/visits/{v}`(decline · seen · quote · send)
  - 업체 정보: `/vendor/profile` · portfolio · prices(+confirm) · price-files, `/vendor/application`(resubmit · reapply)
- 관리자: `/admin/vendors`(목록 · 요약 · 자세히 · review)
- `/v2`(22개): 계산 · `ask` · `ask/{turn}` · cases

## 에이전트 (지금 실제로 도는 길: `POST /v2/ask` → `v2/ask_chat.py` → `v2/ask.py`)

1. **요청 제한**: 사용자마다 시간당 60회예요. `APP_ENV=local`이면 하지 않아요.
2. **입구 분류**(`agent/gate.classify`)
   - TF-IDF(글자 2~4그램) + 로지스틱 회귀를 순수 파이썬으로 돌려요. 무게는 `intent_lr_v1.json.gz`에 있어요.
   - 라벨: orchestrator · trade · quote_explanation · schedule · out_of_scope
   - 신뢰도가 0.7보다 낮으면 Jev(OpenRouter)에게 한 번 물어요.
   - out_of_scope는 정해 둔 글로 답해요.
3. **공종 고르기**: 낱말(`bm25.trade_of`)로 정하고, `trade_<x>_v1.md` 지시문과 `agent/trades/{dobae,mokgong}.py` 설정을 더해요.
4. **첫 검색**: `knowledge.search`로 k=6개를 찾고, 고객 수준은 규칙(`v2/level.py`)으로 정해요.
5. **도구 반복**(`llm.chat_tools`): 도구 4회 · LLM 6회까지예요.
   - 서버 도구: `price_reference` · `set_schedule_constraints` · `search_knowledge`
   - 브라우저 도구: `set_style` · `set_home_info` 등이에요. Redis에 10분 맡겨 두고 `/v2/ask/{turn}`으로 이어 가요.
6. **출력 검사**(`guard.check`)
   - 계산 · 자료 · 사용자 글에 없는 숫자가 든 문장은 버려요. 기간은 계산 엔진 값만 써요.
   - 금지 표현을 거르고 전화 · 동호수를 가려요.
   - `[K####]` 인용을 확인하고, 추천 질문은 3개까지예요.
7. **저장**: `rev`가 어긋나면 409예요.

- 정의만 하고 연결하지 않은 것: `gate.gate` · `gate.fixed_reply` · `trade_agent.trade`(늘 failed) · `llm.structured`(테스트만 써요) · `ChatState` · `agent/prompts/`(비어 있어요).
- LLM은 **OpenAI만** 써요.
  - 대화는 `langchain_openai.ChatOpenAI`, 임베딩은 `text-embedding-3-small`(1536차원)이에요.
  - Anthropic 코드는 없어요.
  - 설정: `LLM_LIVE`(기본 false) · `OPENAI_*` · `OPENROUTER_API_KEY` · `JEV_*`
- **`LLM_LIVE=false`일 때**
  - 대화는 "지금은 AI 답변을 쓸 수 없어요…" 정해 둔 글만 돌려줘요. 무료 모드 답이 없어요.
  - 검색은 키워드(BM25)만 해요.
- 검색 방식
  - 키워드 BM25(프로세스마다 캐시)와 pgvector cos top-30을 RRF로 합쳐요(k=60, dense 0.75).
  - 출처 등급 · 공종 무게를 더해요. CONF 판은 `rag7-2026.11.16`이에요.
  - 조각 번호: K1~(상담 자료) · K2001~(팀 CSV) · K5001~(책) · K6000~(시공일지)
- 지시문(`backend/app/v2/prompts`): `chat_v3` · `quote_explanation_v2` · `schedule_v1` · `trade_dobae_v1` · `trade_mokgong_v1`

## 계산 엔진 · 기준 단가

- `dobae.py` · `mokgong.py`
  - 표준견적서 줄(상태 6종) · 품 · 단계 · 부가세 10%를 계산해요.
  - `GRADE_PAPER = {economy: 합지, basic: 실크}`
- `estimate.py`: 가견적 = 확인한 업체 단가 × 표준 수량이에요.
  - `PRICE_ROWS`(도배): wall · ceiling · paper_basic(실크) · paper_economy(합지) · primer
  - **1201~1208 코드는 어디에도 없어요.**
- `schedule.py`
  - 주말 · 공휴일을 건너뛰고 목공 → 도배 순서로 잡아요. 건조 2일 · 청소 1일을 넣어요.
  - `due_at` = 날짜 + N일 18:00(서울)이에요. 연락처는 공사가 끝난 날부터 1년 보여요.
  - 서비스 상수: `DATES_DUE_DAYS=2` · `REQUEST_DUE_DAYS=1` · `LEAD_DAYS=14`
- `refprice/book.py`
  - `DOBAE_2026H2`: 인건비 벽 5,993 · 천장 8,531원/㎡, 벽지 실크 3,325 · 합지 1,300원/㎡(합지는 팀 가정값이에요)
  - `SILK_2026`: 9,500 · 15,000원/평, 업체 견적 1장이 근거예요
- `refprice/holidays.py`: 2026~2027년 대체공휴일까지 넣었어요.
- 그 밖에 `market_band.py`(실견적 806건으로 맞춘 시장 범위) · `quick_budget.py` · `plan_qty.py` · `precise_*.py` · `v2_*`가 있어요.

## 프런트 (`frontend/`)

- 기술: Next.js 16.4.5(App Router, standalone, `/api/*` → `API_INTERNAL_URL`) · React 19.3.1 · @daypicker/react · TypeScript 5.9 · oxlint · openapi-typescript · pnpm 11 · Node ≥24.18
- 경로
  - 공개 · 계정: `/` · `/start` · `/login` · `/signup`(+phone · vendor) · `/reset-password` · `/my` · `/account` · `/notifications` · `/faq` · `/legal` · `/demo` · `/v2`
  - 프로젝트(`/projects/[id]` 아래): standard · plan · vendors · `vendors/[vid]` · `vendors/@panel/(.)[vid]`(옆 칸) · visits · quotes · `quotes/[visitId]/confirm` · schedule · docs
  - 업체: `/vendor` · profile · `requests/[visitId]`(+quote) · jobs · `jobs/[dealId]`
  - 관리자: `/admin` · vendors · `vendors/[id]` · members
- `lib/backend`
  - `client.ts`: 브라우저에서 `/api`를 부르고, 실패하면 `ApiError`예요.
  - `server.ts`: 쿠키를 넘기고, 401 · 403 · 404면 null을 돌려줘요.
  - `schema.d.ts`: 만든 파일이고, CI가 API와 같은지 확인해요.
- `lib/mock/ask.ts`가 떠 있는 묻기 창을 맡아요. 이 창은 예시 데이터로만 돌아요.
- 스타일: `globals.css`(변수 약 49개 · `mj-*`) + CSS 모듈 55개. Tailwind는 없어요.
- **PWA는 없어요**(manifest · 서비스 워커 없음). 프런트 테스트도 없어요.

## 평가 · 자료

| 위치 | 내용 |
| --- | --- |
| `evaluation/intent` | dev 133 · heldout 67, `run.py` · `intent_metrics.py` |
| `evaluation/rag` | 질문 90 · 300 · 시공일지 60, gold_sigong 225, 스크립트 corpus · rank_server · dense · hybrid · metrics. held-out hit@5 약 0.73 |
| `evaluation/answer/set30` | 유료 채점 |
| `evaluation/ask_back` | 14 · 7 |
| `evaluation/trade` | 도배 9 · 목공 9 |
| `evaluation/guide` · `orchestrator` · `quote_explanation` · `schedule` | 비어 있어요 |
| `data/consult/` | rag5.json · consult_knowledge_rag.csv |
| `data/processed/` | CSV 13개 · 약 95MB(단가 · 품셈 · 노임 · 도면 · KCS/LH/주택 RAG) |
| `data/sigong_ilji/` | 본문은 git 밖이에요 |

## 테스트 · 실행

- 백엔드 테스트
  - 모듈 61개 · 함수 약 472개이고, 실제 Postgres · Redis로 돌아요.
  - conftest는 `mitjip_test`를 지우고 다시 만든 뒤 Alembic을 올림 → 내림 → 올림으로 돌려요. 표는 테스트마다 비우고, Redis는 db 15를 써요.
  - **v3에서 `TEST_DB_NAME` 환경변수를 더했어요**(리드). 역할마다 `mitjip_test_<역할>`과 `TEST_REDIS_URL`(다른 db 번호)을 써요.
- compose
  - 서비스: db 5433(pgvector 0.8.7) · redis 6379 · migrate(+seed) · api 8000 · worker · web 3000
  - 화면만 따로 띄울 때는 `pnpm dev --port 3100`으로 PC에서 돌려도 돼요.

## v3 흐름과 비교 (있음 / 일부 / 없음)

| v3 항목 | 상태 |
| --- | --- |
| 가입 전 표준견적서 | **없음**(견적 API는 모두 로그인이 필요해요) |
| 기본 정보 페이지 | 일부(`/start`). 전체/부분 스위치 · ㎡↔평 도움 · 주거 종류가 없어요(apt만) |
| 표준견적서 + 옆 AI 칸 | 일부. 떠 있는 창은 예시 데이터만 쓰고, 실제 AI는 `/v2`에만 있어요 |
| 업체 목록 · 업체별 가견적 | 일부. 단가표 줄이 1201~1208과 달라요(퍼티 · 부자재 · 품 · 식대 · 운송비가 없어요) |
| 업체 자세히 | 일부. 고객 리뷰가 없어요 |
| 3곳까지 담기 | 있음(담기 = 실측 요청, 공종마다 3칸) |
| AI가 돕는 실측 일정 | **없음**(지금은 '연결만'이에요). 기한 · 알림 도구는 있어서 다시 쓸 수 있어요 |
| 고객-업체 채팅(실시간) | **없음** |
| 실측 견적서 · 비교 | 있음 |
| 업체 확정 | 있음 |
| 공사 날짜 · 바꾸기 | 있음 |
| 확정 공정표 · 추가 금액 | 있음 |
| 공사 끝 · 확인 | 있음 |
| 리뷰 | **없음** |
| 업체 작업함 4탭 | 있음 |
| 단가표 편집 | 있음(줄이 달라요) |
| 관리자 업체 심사 | 있음 |
| 신고 처리 | **없음** |
| 알림 종 | 있음(화면 안만, 실시간 아님) |
