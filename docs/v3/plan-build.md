# 믿집 v3 제작 계획 — 동시에 나눌 작업 묶음 (개발자)

- 쓴 날: 2026-11-18 · 쓴 역할: 개발자 · 리드가 묶음별로 맡겨요
- 기준: `architecture.md` · `data-model.md` · `api.md` · `routes.md` · `adr/dev-*`
- 원칙: 한 파일 · 폴더는 한 묶음만 고쳐요. 다른 묶음 파일을 고쳐야 하면 바꿀 내용을 적어 리드에게 넘겨요.

## 0. 한눈에

```
0단계 계약 먼저 (1~2일)   B1a: migration 0024~0030 + 모든 새 models + schemas + router 뼈대(501) → OpenAPI
                          B4: 토큰 · 기준점 · 껍데기 뼈대 · ui 조각 이름 / B6: 자료 모양(JSON 칸) / B7: 위협 모델
        │  (리드: OpenAPI로 schema.d.ts 한 번 만들어 모두에게)
1단계 동시에 (5~8일)      B1a 흐름 · B1b 채팅 · 실시간 · 리뷰 · 신고 · B2 고객 화면 · B3 업체 · 관리자 화면
                          B4 디자인 체계 · B5 에이전트 · AI 칸 · B6 데이터 · B7 보안
        │  (화면 묶음은 lib/api 안 예시 데이터로 먼저, API가 생기는 대로 바꿈)
2단계 합치기 (2~3일)      리드: B1a + B1b 합침 → gen:api → B2 · B3가 예시 데이터를 실제 API로 → B8 e2e
3단계 검증 · 고치기       테스트 · 화면 360/1280 · 보안 점검 · 대변인 시나리오 · 글 점검 → 고침
```

## 1. 묶음

### B1a 백엔드 흐름 (견적 · 업체 · 실측 일정 · 공사 · 기한)

| 항목 | 내용 |
| --- | --- |
| 맡는 곳 | `backend/app/{calc,project,guest(새),vendor,visit,quote,schedule,jobs(새),notify}/**`, `backend/app/{worker.py,main.py,config.py,db.py,queue.py}`, `backend/app/shared/{clock,errors,ids,korean}.py`, `backend/migrations/**`(0024~0031), 해당 테스트 `backend/tests/test_v3_{calc,project,guest,shortlist,visit,jobs,quote,work}_*.py` |
| 0단계에만 | `thread` · `realtime` · `review` · `report`의 `models.py` 뼈대와 migration 0028 · 0029도 B1a가 만들어 한 줄 head를 지켜요. 끝나면 그 폴더는 B1b로 넘겨요. `files/models.py` KINDS 한 줄(0028과 같이)도 0단계 예외로 B1a가 고쳐요 |
| 먼저 끝나야 하는 것 | 0단계 계약(모두가 기다려요) |
| 만드는 것 | 계산 엔진 v3(표준견적서 도배지 평 · 부분 공간 몫 · 가견적 dobae_v3 · 기한 · 반나절 · 초안 · 추천), 손님 계산, 담기, 실측 일정 전이 전부, jobs + worker 수거 + 처리 함수 13개(대화 닫기 등 B1b 함수 부르기 포함), 견적서 칩 · 유효기간, 공사 날 목록 · 추가 금액 판 · 자동 끝 |
| 테스트 DB | `TEST_DB_NAME=mitjip_test_b1a` · `TEST_REDIS_URL=redis://127.0.0.1:6379/1` · API 개발 포트 8011 |
| 완료 기준 | 자기 테스트 · 지금 테스트 전부 통과, `ruff check` · `ruff format --check`, migration up → down → up, `alembic check` 차이 없음, 제약 테스트(`data-model.md` 8장), 상태 전이 표 하나하나 테스트(허용 · 409), 동시 요청 테스트(같은 반나절 · 담기 · 단가 확인) |
| 크기(어림) | 코드 4,500~5,500줄 + 테스트 2,500줄 |

### B1b 백엔드 채팅 · 실시간 · 리뷰 · 신고 · 관리자

| 항목 | 내용 |
| --- | --- |
| 맡는 곳 | `backend/app/{thread,realtime,review,report,account}/**`(0단계 뒤), `backend/tests/test_v3_{thread,realtime,review,report,admin}_*.py` |
| 먼저 끝나야 하는 것 | 0단계 계약. `thread.service.open / post_system / set_read_only` 함수 이름 · 인자는 0단계에 정해 B1a가 부를 수 있게 해요 |
| 만드는 것 | 대화 · 글(seq · client_key · 주의 줄 규칙 · 동 · 호 꼴 규칙) · 읽음 · 차단, `GET /stream`(Redis Stream · Last-Event-ID · resync · 한도 · 세션 다시 확인), `realtime.push`, 리뷰 · 답글 · 숨김, 신고 · 처리 · 업체 멈춤 · 회원 정지, 탈퇴 때 대화 닫기 |
| 테스트 DB | `mitjip_test_b1b` · Redis db 2 · 포트 8012 |
| 완료 기준 | 위와 같음 + 줄기: 두 연결 · 끊고 다시 잇기 · 남의 줄기 못 읽음 · 끊으면 Redis 연결 닫힘, 채팅: 같은 키 두 번 · 동시 두 글 seq 빈틈 없음 · 업체 응답에 고객 이름 · 휴대폰 없음 |
| 크기 | 코드 2,500~3,000줄 + 테스트 1,500줄 |

### B2 고객 화면 (+ 고객 · 업체가 같이 쓰는 채팅 화면)

| 항목 | 내용 |
| --- | --- |
| 맡는 곳 | `frontend/app/{page.tsx,page.module.css,start,signup/page.tsx,login,reset-password,my,account,notifications,faq,legal,chat,projects,not-found.tsx,error.tsx}/**`, `frontend/components/{start,project,vendors,compare,confirm,schedule,plan,my,notify,docs,thread(새),visit(새),review(새),report(새),home(새)}/**`, `frontend/components/auth/**`(VendorSignupForm 빼고), `frontend/lib/api/{project,quote,visit,schedule,notify,thread(새),guest(새)}.ts`, `frontend/lib/guest/**`(새), `frontend/lib/backend/stream.ts`(새), `frontend/lib/mock/**`, `frontend/lib/types.ts` |
| 먼저 끝나야 하는 것 | 0단계 schema.d.ts, B4 기준점 · ui 조각 이름(조각이 아직 없으면 자리 컴포넌트로 시작) |
| 만드는 것 | `routes.md` 묶음 B2 화면 80개(c · d), 손님 답 저장 · 옮기기, 실시간 한 줄기 훅, 채팅 2단 · 한 단, `vendors/@panel` 지움 |
| 확인 | `pnpm typecheck` · `pnpm lint` · `pnpm build`, 앱 안 브라우저 폰 360px · 웹 1280px(가로 스크롤 없음 · 누를 곳 44px, 최소 40px), 화면 글 해요체 · 영어 상태값 없음 |
| 개발 포트 | web 3102(API는 B1a 8011 · B1b 8012를 `API_INTERNAL_URL`로) |
| 크기 | TSX · CSS 8,000~10,000줄 |

### B3 업체 · 관리자 화면

| 항목 | 내용 |
| --- | --- |
| 맡는 곳 | `frontend/app/{vendor,signup/vendor,admin}/**`, `frontend/components/{pro,admin}/**`, `frontend/components/auth/VendorSignupForm*`, `frontend/lib/api/{vendor,admin}.ts` |
| 먼저 끝나야 하는 것 | B2와 같음. 채팅 · 신고 창은 B2 조각을 가져다 써요(고치지 않음) |
| 만드는 것 | 묶음 B3 화면 27개: 가입 · 처음 할 일 · 작업함 5탭(N4 C) · 기간 답하기 · 수락 · 제안 · 일정 탭 · 견적서 · 공사 한 건 · 단가표(1201~1208) · 정보 · 사례 · 링크 · 리뷰 답글, 관리자 심사 · 거절 창 · 신고 · 회원 |
| 확인 | B2와 같음 |
| 개발 포트 | web 3103 |
| 크기 | 5,000~6,500줄 |

### B4 디자인 체계 · 앱 껍데기 · PWA

| 항목 | 내용 |
| --- | --- |
| 맡는 곳 | `frontend/app/{layout.tsx,globals.css,manifest.ts(새),icon.svg,offline(새)}`, `frontend/public/**`(아이콘 · `sw.js` 새), `frontend/components/{ui(새),site}/**`, `frontend/lib/{format,labels}.ts`(글은 UX 글 점검과 같이) |
| 먼저 끝나야 하는 것 | 0단계에 토큰 이름 · 기준점(768 · 1024) · ui 조각 목록(`routes.md` 3장)을 먼저 내요 |
| 만드는 것 | 디자인 B 토큰, 껍데기(머리 · 아래 탭 바 · 공사 띠 · 알림 펼침 · 실시간 자리), ui 조각(달력 3종 · 확인 창 · 시트 · 끌어다 놓기 · 믿집 계산 상자 · 상태 아이콘 + 글자 · 금액), PWA manifest · 오프라인 한 장(dev-01) |
| 확인 | typecheck · lint · build, 조각 모음 화면(`/dev/ui`, 개발에서만)으로 360 · 1280 확인 |
| 개발 포트 | web 3104 |
| 크기 | 2,500~3,500줄 |

### B5 에이전트 · AI 칸

| 항목 | 내용 |
| --- | --- |
| 맡는 곳 | `backend/app/{agent,chat,knowledge}/**`, `backend/app/mcp_server.py`, `backend/app/v2/{ask*.py,guard.py,level.py,prompts}/**`, `evaluation/v3/**`, `frontend/components/ai/**`(새), `frontend/lib/api/chat.ts` |
| 먼저 끝나야 하는 것 | 0단계 계약(`POST /ai/turns` 모양, 도구가 부를 B1a 읽기 함수 이름) |
| 만드는 것 | `agents.md` 설계대로. 무료 모드 기본, AI 칸(옆 칸 · 폰 전체 화면 · 로그인 전 칩), 카드(믿집 계산 · 요청 초안 · 달력 열기 · 합지로 보기) |
| 테스트 DB | `mitjip_test_b5` · Redis db 3 · 포트 8015 · web 3105 |
| 완료 기준 | 평가 세트 기준선 · 실험 비교표(유료 0회), pytest · ruff, 화면 확인 |

### B6 데이터 · 지식

| 항목 | 내용 |
| --- | --- |
| 맡는 곳 | `data/v3/**`(+ 수집 스크립트), `backend/app/refprice/**`, `backend/app/data_ingest.py`, `backend/app/shared/regions.py`(+ 읍면동 · 이웃 구), `backend/app/{demo,seed}.py`(1단계 뒤, B1a 모델이 굳은 뒤) |
| 만드는 것 | 합지 · 실크 평당 시장 평균(출처 · 날짜), 공간 몫 표(판), 업체 줄 기준 단가(10배 경고), 2027 공휴일, 읍면동 · 이웃 구, v3 시연 데이터(이야기 24개를 따라가는 고객 · 업체 6곳) |
| 테스트 DB | `mitjip_test_b6` · Redis db 4 |
| 완료 기준 | `data-sources.md` 출처 · 갱신 방법, 자료 검사 테스트, 시연 데이터로 J1 · J3 · J5 · J7 · J10 · J22를 누를 수 있음 |

### B7 보안

| 항목 | 내용 |
| --- | --- |
| 맡는 곳 | `backend/app/{auth,files}/**`(0단계 KINDS 한 줄 빼고), `backend/app/shared/{ratelimit,request_guards}.py`, `deploy/**`, `infra/**`, `frontend/next.config.ts`, `frontend/lib/session.ts`, `frontend/lib/backend/{client,server}.ts`, `.env.example`, `.github/workflows/security.yml`, `backend/tests/security/**`(새) |
| 먼저 할 것 | `next.config.ts`에 `compress: false`(개발 SSE, 실험으로 확인) · Caddy `/api/stream*` encode 빼기 · `sw.js` 머리 · 손님 API 요청 제한 · 본문 한도(`/guest/standard` 4KB, 채팅 글 8KB). 지금 `request_guards.LIMITS`는 경로가 똑같을 때만 맞아서, `/threads/{id}/messages`처럼 id가 든 경로는 무늬 비교를 더해야 해요 |
| 만드는 것 | `security.md` 위협 모델, 권한 · 입력 한도 테스트, 줄기 한도, 파일 kind 3개 검사, 업체에 가는 정보 점검 |
| 테스트 DB | `mitjip_test_b7` · Redis db 5 |

### B8 흐름 검증 (e2e, 리드 · 대변인)

| 항목 | 내용 |
| --- | --- |
| 맡는 곳 | `frontend/e2e/**`(새), `frontend/playwright.config.ts`(새), `frontend/package.json` · `pnpm-lock.yaml`(`@playwright/test` 추가만), `.github/workflows/ci.yml`(e2e 일 더하기) |
| 방법 | Playwright `webServer` 배열로 API(uvicorn, 시연 데이터 DB) + web을 띄워요(`reuseExistingServer: !CI`, S32). 로컬은 `channel: 'msedge'`로 깔린 Edge를 써서 브라우저를 내려받지 않아요(S33). CI만 `npx playwright install --with-deps chromium`. 폰(390×844) · 웹(1280×800) 프로젝트 두 개 |
| 이야기 | 완료 기준 6개: J1 · J3 · J5 · J7 · J10 · J22. 두 사용자(고객 · 업체)는 브라우저 문맥 두 개로 동시에 |
| 테스트 DB | `mitjip_v3_e2e`(시연 데이터로 매번 새로) · Redis db 6 · API 8018 · web 3108 |
| 걸리는 점 | `@playwright/test`는 새 개발 의존성이라 ADR에 한 줄 남겨요(작은 라이브러리) |

## 2. 같이 쓰는 파일 · 만든 파일의 주인

| 파일 | 주인 | 규칙 |
| --- | --- | --- |
| `frontend/lib/backend/schema.d.ts` | 리드(합칠 때) | 손으로 고치지 않아요. 0단계에 한 번, 2단계에 B1a + B1b를 합친 API로 다시 만들어요. 묶음 가지에서 충돌하면 상대 것을 받고 다시 만들어요 |
| `backend/app/main.py` `ROUTERS` · `backend/migrations/env.py` import | B1a | 다른 묶음은 한 줄씩 이름 순으로 더하기만 |
| `backend/app/config.py` · `.env.example` | B1a · B7 | 새 설정은 한 줄씩 + 한국어 주석. 값은 넣지 않아요 |
| `backend/app/worker.py` | B1a | B5의 일 함수는 `agent/jobs.py`의 `FUNCTIONS` 목록을 가져다 붙여요 |
| `frontend/app/globals.css` · `lib/labels.ts` · `lib/format.ts` | B4 | 화면 묶음이 필요한 토큰 · 말은 B4에 요청(하루 한 번 모아 반영) |
| `frontend/package.json` · `pnpm-lock.yaml` | B8(+리드) | 다른 묶음은 새 의존성을 넣지 않아요(필요하면 ADR + 리드) |
| `backend/pyproject.toml` · `uv.lock` | 리드 | v3 백엔드는 새 의존성이 필요 없어요(SSE · Redis Stream은 지금 것으로 됨) |
| `docs/v3/*.md` | 쓴 역할 | 남의 문서는 고치지 않고 '고칠 것'을 리드에게 |

## 3. 순서 · 기다리는 것

```
B1a(0단계) ──▶ B1a(1단계) ─┐
     │        B1b(1단계) ──┼─▶ 리드 합침 ─▶ gen:api ─▶ B2 · B3 실제 API로 ─▶ B8 e2e ─▶ 3단계
     │                      │
B4(0단계 토큰 · 조각 이름) ─▶ B2 · B3 · B5 화면(예시 데이터로 먼저)
B6(자료) ─────────────▶ B1a 계산 엔진 값(합지 시장가 · 공간 몫 · 기준 단가) · B6 시연 데이터(1단계 끝)
B7(머리 · 한도) ───────▶ B1a 손님 API · B1b 줄기 한도
B5 ─────────────────────▶ AI 칸(B4 조각) · 도구(B1a 읽기 함수)
```

- B1a 계산 엔진은 B6 값이 오기 전까지 지금 값(실크 9,500원/평)과 '가정값' 표시로 시작해요. 값이 오면 `refprice`만 바뀌어요.
- B1a의 기한 처리 함수가 대화를 닫아야 할 때(실측 취소 · 다른 업체 확정)는 B1b의 `thread.service.set_read_only`를 불러요. 1단계 동안 B1b가 아직이면 0단계 뼈대 함수(아무것도 안 함)를 불러요.

## 4. 테스트 · 실행 환경

| 쓰는 이 | 테스트 DB(`TEST_DB_NAME`) | Redis(`TEST_REDIS_URL`) | API 포트 | web 포트 |
| --- | --- | --- | --- | --- |
| 로컬 compose(사람) | `mitjip` | db 0 | 8000 | 3000 |
| v3 개발(리드 합친 것) | 개발 DB `mitjip_v3` | db 7 | 8010 | 3100 |
| B1a | `mitjip_test_b1a` | db 1 | 8011 | — |
| B1b | `mitjip_test_b1b` | db 2 | 8012 | — |
| B2 · B3 · B4 | (API는 B1a · B1b 것을 씀) | — | — | 3102 · 3103 · 3104 |
| B5 | `mitjip_test_b5` | db 3 | 8015 | 3105 |
| B6 | `mitjip_test_b6` | db 4 | — | — |
| B7 | `mitjip_test_b7` | db 5 | — | — |
| B8 | `mitjip_v3_e2e` | db 6 | 8018 | 3108 |
| 개발자(이 조사) | `mitjip_test_dev` | db 14 | — | — |
| 기본 | `mitjip_test` | db 15 | — | — |

- 실행: `backend` 폴더에서 `TEST_DB_NAME=… TEST_REDIS_URL=… LLM_LIVE=false OPENAI_API_KEY= ANTHROPIC_API_KEY= uv run pytest tests/<대상> -q`. 접속 값(`POSTGRES_USER` · `POSTGRES_PASSWORD`)은 환경변수로 넘기고 화면에 찍지 않아요(`verification/dev.md`의 실행 스크립트처럼).
- 줄기 키에 `REALTIME_PREFIX`(기본 `mj:{app_env}`)를 붙이고 테스트는 `mj:test:{TEST_DB_NAME}`로 해서 묶음끼리 섞이지 않게 해요. Pub/Sub은 DB 번호와 상관없지만(S16) 우리는 Stream(키)이라 db 번호로도 나뉘어요.
- 묶음마다 git worktree를 따로 둬요(예: `../wt-v3-b1a`, 가지 `v3-b1a`). 같은 폴더에서 `next dev`를 둘 돌리면 `.next`가 부딪혀요.
- `docker compose down -v`는 하지 않아요. `mitjip_rag`는 건드리지 않아요.

## 5. 0단계 계약에 들어갈 것 (B1a가 내고 리드가 묶음에 돌림)

1. migration 0024~0030(+ downgrade)과 모든 새 · 바뀐 models.
2. Pydantic 요청 · 응답 schemas(`api.md` 모양)와 router 뼈대(service가 아직이면 501 `not_ready`). → `GET /openapi.json` → `schema.d.ts`.
3. 함수 계약: `thread.service.open / post_system / set_read_only`, `realtime.push`, `jobs.add / cancel`, `calc.deadline.*` · `calc.slots.*` 이름 · 인자.
4. 오류 코드 목록(`api.md` 0장)과 알림 kind · link 목록.
5. 예시 데이터 모양: 화면 묶음이 `lib/mock/`에 같은 모양으로 둬요.

## 6. 합치는 법 (리드)

- 순서: B1a → B1b → B7(백엔드) → 백엔드 전체 테스트 · ruff · alembic → gen:api → B4 → B2 → B3 → B5 → B6 시연 데이터 → B8.
- migration head가 둘이면 늦게 온 쪽 번호 · `down_revision`을 고쳐요(이미 적용된 것은 고치지 않음).
- 합친 뒤마다: 백엔드 전체 pytest(`mitjip_test_lead`) · ruff · 프런트 typecheck · lint · build.

## 7. 걸리는 점 · 대응

| 걸리는 점 | 대응 |
| --- | --- |
| 실측 일정 상태가 많아 B1a가 가장 길어요 | B1a 1단계를 '요청 · 기간 · 고르기 · 확정'(J5)과 '제안 · 바꾸기 · 취소 · 실측 뒤'(J12 · J14)로 나눠 앞쪽을 먼저 내요 |
| D12(기한 지난 뒤)가 보류 | 최소 처리(잡기만 풀기)로 만들고 상수 한곳에 모아 바꾸기 쉽게(dev-04) |
| 보관 기간 · 탈퇴 리뷰(법무) | 설정 · ON DELETE만 바꾸면 되게 설계(dev-05 · dev-07) |
| 개발 SSE가 Next 다시 쓰기에서 막힘 | `compress: false`(B7, 0단계) — 실험으로 확인 |
| `next dev`가 `AGENTS.md`를 만들 수 있어요(실험 폴더에서 봄) | 생겨도 커밋하지 않아요. 필요하면 `next.config.ts`의 `agentRules` 설정을 B7이 검토 |
| Windows에서 uvicorn `--workers 2`가 한 번 자식 프로세스 오류(WinError 10022) | 운영은 리눅스(EC2)라 영향 없음. 로컬 다중 프로세스 시험은 포트 두 개로 따로 띄워요 |
