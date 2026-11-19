# 믿집 v3 구조 (개발자)

- 쓴 날: 2026-11-18 · 쓴 역할: 개발자(아키텍트 · 풀스택) · 기준: `00-prompt.md`, 9판 `design/`, 지금 코드 `research/00-codebase.md`
- 결정 근거: `adr/dev-01`~`dev-08`, 출처 `research/dev.md`, 실제로 돌린 것 `verification/dev.md`
- 같이 보는 문서: `data-model.md`(표 · 상태) · `api.md`(엔드포인트) · `routes.md`(화면 109개 → 경로) · `plan-build.md`(제작 묶음)

## 1. 한 장 그림

```
 폰(홈 화면 앱 = PWA) · 데스크톱 브라우저
        │ HTTPS (같은 주소)
 Cloudflare ── DNS · TLS · 방화벽. 무응답 125초에 끊음 → SSE는 15초 ping
        │
 Caddy (EC2) ── /api/stream* → api:8000 (encode 빼기)
        │      ├ /api/*        → api:8000 (경로 앞 /api 떼고)
        │      └ 나머지         → web:3000 (Next.js 16, 화면만)
        │
 api (FastAPI, uvicorn 2프로세스) ──── PostgreSQL 17 + pgvector  ← 원본(돈 · 날짜 · 상태 · 글)
   │  └ GET /stream (SSE) ◀─ XREAD ── Redis 8  ← 지워져도 되는 것만
   │                                    · 사용자별 이벤트 줄기(Stream, id만)
   │                                    · 요청 제한 · arq 큐 · 짧은 캐시
 worker (arq) ── 1분마다 jobs 수거(기한) · 알림 · AI 설명 · 정리
```

- 원칙: 돈 · 날짜 · 기한은 계산 엔진(`calc`)만 만들어요. 상태는 기능 service 한 곳에서 '허용 전이 확인 → 조건부 UPDATE(1행이 아니면 409) → 같은 트랜잭션에 이력'으로 바꿔요. 동시 요청은 DB 제약 + 409예요. 스키마는 Alembic으로만 바꿔요.
- Redis가 비어도 서비스는 맞게 돌아요: 실시간이 잠깐 끊기고(화면은 다시 읽어 맞춤), 기한은 DB `jobs` 행이 남아 있어서 worker가 다시 집어요.

## 2. 이름 (헷갈리기 쉬운 것)

| 화면 말 | 코드 이름 | 뜻 |
| --- | --- | --- |
| 채팅 (`/chat` 경로) | `thread` | 고객-업체 대화. 실측이 확정되면 (공사, 업체)마다 하나 |
| AI에게 묻기 (옆 칸 · 전체 화면) | `chat` (지금 그대로) | 고객 ↔ 에이전트 대화. 경로는 없고 화면 안 칸이에요 |
| 담기 · 담은 업체 | `shortlist` | 공사 · 공종마다 3칸 |
| 실측 일정 · 요청 | `visit` | 요청 한 건(이 집 · 한 공종 · 한 업체 · 한 번째 시도) |
| 업체가 되는 기간 | `visit_window` | 기간 + 빼는 날 + 바로 확정 |
| 반나절 잡기 · 확정 | `visit_hold` | 업체 달력의 반나절 하나(잡아 둠 · 확정) |
| 다른 날 제안 | `visit_proposal` | 업체가 낸 반나절 1~3개 |
| 일정 바꾸기 요청 | `visit_change` | 확정 뒤 고객이 낸 새 반나절 |
| 기한 일 | `job` | 예약 시각(run_at)에 worker가 상태를 다시 보는 일 |
| 리뷰 · 답글 | `review` · `review_reply` | 공사 확정 한 건에 하나 · 리뷰 하나에 하나 |
| 신고 | `report` | 채팅 · 업체 · 링크 |
| 표준견적서 · 가견적 · 실측 견적서 · 업체 확정 · 공정표 | `standard_quote` · `estimate` · `vendor_quote` · `deal` · `plan`(지금 그대로) | |

## 3. 백엔드 모듈 (`backend/app/`)

| 패키지 | 층 | 하는 일 | v3에서 |
| --- | --- | --- | --- |
| `calc` | 도구 | 순수 계산(DB · HTTP · 시계 모름, 오늘 · 지금은 인자) | **고침**: 표준견적서 v3(도배지 줄 평 · 시장 평균, 부분 공사 공간 몫), 가견적 `dobae_v3` 줄(1201~1208), 기한 `deadline.py`(+48시간 · +7일 · N일 18:00 · 지남 판정), 반나절 `slots.py`(열린 반나절 세기 · 희망 기간 초안 · 날짜 추천), 리뷰 별점 반올림 |
| `refprice` | 기반 | 기준 단가 · 공휴일 · 시장 가격 · 공간 몫 · 업체 기준 단가(10배 경고) | **고침**(B6): 합지 · 실크 평당 시장 평균, 공간 몫 표, 2027 공휴일 |
| `guest` | 대상 | **새로**: 로그인 없는 표준견적서 계산(저장 안 함) | `POST /guest/standard` |
| `project` | 대상 | 기본 정보 만들기 · 고치기 · 잠금 | **고침**: 공사 범위 · 부분 공간 · 면, 동(읍면동), 예산(원), 손님 답 옮기기(멱등 키) |
| `vendor` | 대상 | 업체 가입 · 심사 · 정보 · 단가 | **고침**: 단가 `dobae_v3`(mode 3가지), 바로 확정 기본값, 외부 리뷰 링크, 정지, 거절 사유 하나 더 |
| `account` | 대상 | 탈퇴 + **관리자 회원**(목록 · 정지 · 풀기) | **고침**: 탈퇴 때 대화 닫기 |
| `quote` | 흐름 | 표준견적서 판 · 업체 실측 견적서 | **고침**: '포함됐나요?' 칩 4칸, 유효기간 알림 · 다시 받기 |
| `visit` | 흐름 | 업체 목록 · 가견적 · **담기 · 실측 일정 중계** · 견적서 보드 | **크게 고침**: shortlist · window · hold · proposal · change, 기한 일 처리 함수 |
| `schedule` | 흐름 | 업체 확정 · 공사 날짜 · 공정표 · 추가 금액 · 공사 끝 | **고침**: 날을 하나씩 고르는 공사 날짜, 추가 금액 승인 · 거절 · 묻기 + 판, 공사 끝 7일 자동 |
| `review` | 흐름 | **새로**: 리뷰 · 답글 · 사진 · 숨김 | |
| `report` | 흐름 | **새로**: 신고 받기 · 관리자 처리(경고 · 쓰기 막기 · 업체 멈추기) | |
| `thread` | 기반 | **새로**: 대화방 · 글 · 읽음 · 차단 · 시스템 카드 · 주의 줄 규칙 | 다른 기능 service가 `open()` · `post_system()`을 불러요 |
| `realtime` | 기반 | **새로**: 사용자별 이벤트 줄기 쓰기(`push`) · 읽기(`GET /stream`) | id만 보내요(본문 · 연락처 없음) |
| `jobs` | 기반 | **새로**: 기한 일 표 · 수거 · 실행 기록 | worker가 불러요 |
| `notify` | 기반 | 화면 알림(지금 그대로) | 쓸 때 `realtime.push(notif)`도 |
| `files` | 기반 | 올리기 · 위치 정보 지움 · 저장 | kind 3개 더(`chat_photo` · `review_photo` · `done_photo`) |
| `knowledge` · `agent` · `chat` | 기반 · 도구 · 흐름 | 지식 검색 · 에이전트 · AI 대화 | B5가 설계(`agents.md`) |
| `auth` · `shared` | 기반 · 공통 | 세션 · 권한 · 오류 · 시계 · 요청 제한 · 입구 보호 | `ratelimit`에 손님 · 줄기 한도(B7) |

### 층 규칙 (위는 아래를 부를 수 있고, `|`끼리는 서로 import하지 않아요)

```
조립   main.py | worker.py | mcp_server.py
흐름   chat → review | report → schedule → visit → quote
대상   account | project | vendor | guest
기반   files | refprice | jobs | thread | knowledge | notify → realtime → auth
도구   agent → calc
공통   shared → db | queue → config
```

- 다른 기능은 그 기능 service의 공개 함수로만 불러요. router끼리 import하지 않아요.
- (리드 2026-11-19, B1b 제작 반영) 층 그림에 없던 화살표 두 개가 생겼어요.
  - `report → review`: 신고 처리에서 리뷰를 숨겨요.
  - `thread → files`: 채팅 사진이에요.
  - 둘 다 위 층이 아래 · 같은 기반을 부르는 방향이라 규칙 안이에요.
  - `report → visit · vendor`: 업체 멈춤 · 링크 처리에서 `vendor.service.suspend/unsuspend/set_review_link_status` · `visit.service.close_for_vendor`를 불러요(B1a 1단계 마무리, 2026-11-19). `report/repository.py`의 옛 직접 쓰기는 지웠어요.
- `thread`는 기반이에요: 실측이 확정되면 `visit.service`가 `thread.service.open(...)`을 같은 트랜잭션에서 불러요. 채팅 위 띠의 실측 정보는 화면이 visit API로 따로 읽어요(thread는 visit을 몰라요).
- `realtime.push()`는 commit **뒤에** 불러요. 실패해도 예외를 올리지 않아요(로그만).
- `agent`는 기능 service를 import하지 않아요. 기능 데이터는 `chat/tools.py`의 도구로 받아요(B5).

## 4. 호출 흐름 (v3 핵심 7개)

```
① 비회원 표준견적서 (J1, dev-03)
  브라우저 localStorage(mj_guest_v3) → POST /api/guest/standard → guest.router(IP 요청 제한 · 4KB)
  → guest.service → calc.dobae.quote_v3 → 응답 (DB · 로그에 입력을 쓰지 않음)
  가입 → POST /auth/signup → POST /projects (Idempotency-Key = 기기 답의 key)
  → project.service.create → quote.service.ensure_standard → commit → 기기 답 지움 → /projects/{id}/vendors

② 업체 담기 · 실측 요청 (J3)
  POST /projects/{id}/shortlist → visit.service.shortlist (프로젝트 행 잠금 → 칸 · 업체 부분 UQ, 409)
  POST /projects/{id}/visits → visit.service.request
     → project.service.lock_for_visit → calc.estimate(dobae_v3) 사본 고정 → visits + visit_events
     → jobs(visit_reply_due, +48h) → notify(업체마다) → commit → realtime.push(업체: notif · state)

③ 업체 기간 답 → 고객 날짜 (J5 · J11 · J12 · J19, dev-04)
  POST /vendor/visits/{vid}/window → visit.service.answer (requested→offered 조건부 UPDATE
     → visit_windows → jobs(reply_due) 취소 · jobs(pick_due, +7일) → notify 고객) → commit → push
  POST /projects/{id}/visits/{vid}/pick → visit.service.pick (visit 행 잠금 → calc.slots 열린 반나절인지
     → visit_holds INSERT(업체 · 날 · 반나절 부분 UQ → 늦으면 409 slot_taken)
     → 바로 확정: booked + thread.open + 시스템 카드 + jobs(전날 18:00 알림, 견적서 기한)
     → 아니면: picked + jobs(accept_due, +48h)) → commit → push(양쪽)

④ 기한 (D14 A)
  worker cron(1분, unique) → jobs.claim(run_at ≤ now, FOR UPDATE SKIP LOCKED, 50개)
  → kind별 처리 함수(visit.service.on_reply_due …) → '아직 그 상태 · 지났을 때만' 조건부 UPDATE
  → 이력 · notify(dedup_key) → commit → push. 이미 바뀌었으면 skipped로 끝.
  화면의 '지남'은 calc.deadline.is_over(now, due_at)로 따로 계산(worker가 늦어도 맞게 보임)

⑤ 채팅 (J8 · J17 · J20, dev-05)
  POST /threads/{tid}/messages {client_key} → thread.service.post
     (대화 행 잠금 → last_seq+1 → 글 INSERT(UNIQUE client_key) → 주의 줄 규칙 → commit)
     → realtime.push(상대: msg{thread, seq}) · 내 다른 기기에도
  GET /stream (SSE) ← realtime.stream(user): XREAD BLOCK → event: msg → 화면이 GET messages?after_seq=로 채움

⑥ 실측 뒤 (J7 · J22): 견적서 보내기(quote) → 비교 · 확정(schedule.confirm, 다른 visit closed, 다른 대화 읽기만)
  → 공사 날짜(날 목록) → 수락 → 확정 공정표 → 추가 금액(판 · 승인) → 공사 끝냈어요 → 고객 확인 또는 7일 뒤 자동
  → POST /projects/{id}/deals/{did}/review → review.service.write → 업체에 알림

⑦ AI 칸 (B5)
  AiPanel(브라우저) → POST /api/ai/turns (SSE) → chat.router → chat.service(대화 잠금)
  → 입구 관문 → 담당 에이전트 · 도구(chat/tools.py → 기능 service 읽기) → 출력 검사(숫자는 계산 엔진 값만)
  → 글 · 카드 전송. 카드의 '보내기 · 확정 · 달력 열기'는 브라우저가 ②③의 같은 API를 불러요(AI는 쓰지 않음)
```

- 화면 읽기: Server Component → `lib/api/<영역>.ts` → `lib/backend/server.ts`(`API_INTERNAL_URL`, 쿠키 넘김).
- 화면 쓰기: 브라우저 → 같은 주소 `/api/*`(`lib/backend/client.ts`) → 개발은 Next 다시 쓰기, 운영은 Caddy. Server Action은 쓰지 않아요.
- 실시간: 탭마다 `EventSource('/api/stream')` 하나(B2 `lib/backend/stream.ts`). `state`가 오면 그 화면이 `router.refresh()`로 다시 읽어요.

## 5. 실시간 (dev-02)

| 항목 | 정한 것 |
| --- | --- |
| 길 | 쓰기는 REST POST, 받기는 `GET /stream`(SSE, 쿠키 인증) 한 줄기 |
| 저장 | 원본은 PostgreSQL. 줄기는 Redis Stream `mj:{env}:ev:{user_id}`(MAXLEN ~500, 7일) — 이벤트 kind · id만 |
| 이벤트 | `msg {thread_id, seq}` · `read {thread_id, seq}`(내 다른 기기) · `notif {unread}` · `state {kind, project_id, id}` · `resync {}` |
| 다시 잇기 | SSE `id` = Stream id. 브라우저가 `Last-Event-ID`로 다시 이으면 그 뒤부터. 잘렸으면 `resync` → 화면이 모두 다시 읽어요 |
| 살아 있음 | FastAPI가 15초마다 `: ping`(Cloudflare 125초보다 짧음). `retry: 5000` |
| 압축 | `Cache-Control: no-cache, no-transform`. Caddy `encode`에서 `/api/stream*` 빼기(B7). **개발 Next `compress: false`**(실험: 켜져 있으면 20초 동안 0바이트) |
| 한도 | 사용자마다 동시 5줄기(Redis 셈, B7). 60초마다 세션 · 정지 다시 확인해 끊음 |
| 연결 | 줄기마다 Redis 연결 하나(`socket_timeout` 없음 · 끝나면 닫음). `queue.redis`(1초 제한)는 쓰지 않아요 |
| 배포 | uvicorn graceful 20초 뒤 끊겨도 브라우저가 다시 이어요 |
| 개발 · 테스트 | 줄기 키에 `REALTIME_PREFIX`(기본 `mj:{app_env}`)를 붙여 테스트 DB끼리 섞이지 않게 해요 |

## 6. 기한 · 알림 · 작업 (dev-04)

- `jobs` 표가 기한의 원본이에요. 상태를 바꾸는 service가 같은 트랜잭션에 `jobs.add(kind, ref_id, run_at, dedup_key)`를 불러요. 이미 끝난 일을 취소할 때는 `jobs.cancel(dedup_key)`.
- worker: `cron(sweep_jobs, second={0}, unique=True)` 한 개. 50개씩 가져가 처리 함수를 부르고, 처리 함수는 새 세션 · 새 트랜잭션에서 조건부 UPDATE를 해요. 실패하면 `attempts`를 올리고 1 · 5 · 30분 뒤 다시(최대 5번), 넘으면 `failed`(오류 코드만, 개인정보 없음).
- kind → 처리 함수 표는 `worker.py`(조립 층)에 둬요. `jobs` 패키지는 흐름 기능(visit · schedule)을 import하지 않고 행 넣기 · 가져가기 · 끝내기만 해요.
- 처리 함수 표(kind → 할 일):

| kind | run_at | 할 일 |
| --- | --- | --- |
| `visit_reply_due` | 요청 + 48시간 | 아직 requested면 expired(reply) · 칸 비움 · 고객 알림 '답하지 않았어요' |
| `visit_pick_due` | 업체 답 + 7일 | 아직 offered면 expired(pick) · 칸 비움 · 업체 알림 |
| `visit_accept_due` | 고른 때 + 48시간 | 아직 picked면 잡기 풀기 · offered로(D12 최소 처리, 팀 확인) |
| `visit_proposal_due` | 제안 + 48시간 | 제안 expired · offered로(D12 최소 처리) |
| `visit_change_due` | 바꾸기 요청 + 48시간 | 요청 expired · 원래 일정 그대로(8판) |
| `visit_reminder` | 실측 전날 18:00 | 양쪽 알림 '내일 오전 실측이에요', 고객은 동 · 호 안 보냈으면 한 줄 더(I7 B) |
| `visit_quote_due` | 실측일 + 3일 18:00 | 견적서가 아직 없으면 고객 알림 '견적서가 늦어요'(기다리기 · 닫기) |
| `quote_valid_soon` | 유효기간 3일 · 1일 전 | 고객 알림(D20) |
| `deal_dates_due` | 확정 + 2일 18:00 | 공사 날짜가 아직 없으면 양쪽 알림(지난 뒤는 D12 보류) |
| `deal_request_due` | 다른 날짜 요청 + 48시간 | 업체가 새 날짜를 안 냈으면 양쪽 알림 |
| `deal_done_remind` | 공사 끝 알림 + 4일 | 고객 알림 '3일 뒤 자동으로 끝나요'(D24) |
| `deal_auto_done` | 공사 끝 알림 + 7일 | 아직 checking이면 done(자동) · 리뷰 쓰기 열림 |
| `thread_redact` | 닫힌 대화 + 보관 기간 | 글 본문 지우기(보관 기간이 정해질 때까지 만들지 않음, dev-05) |

- 알림은 화면 알림만이에요(D15 C). `dedup_key`는 `kind:ref_id:due` 꼴이라 같은 기한은 한 번만 가요.

## 7. 파일

- 올리기는 지금처럼 `POST /files`(내용으로 형식 판별 · EXIF · GPS 지움 · 크기 한도) 하나예요. kind: `photo`(요청 사진) · `license` · `portfolio` · `price_doc` · `quote_doc` · `work_photo`(추가 금액) + **`chat_photo` · `review_photo` · `done_photo`**.
- 내주기는 기능이 권한을 확인한 뒤 해요(남의 것은 404): 채팅 사진 = 대화 두 사람, 리뷰 사진 = 누구나(숨김 리뷰 빼고), 공사 끝 사진 = 그 공사 고객 · 업체, 요청 사진 = 고객 · 그 요청 업체.
- 웹은 끌어다 놓기 + '파일 고르기', 폰은 눌러서 고르기(I9). 올리는 동안 테두리 · 문구만 바뀌어요.

## 8. AI 칸이 도는 곳 (자세한 설계는 B5 `agents.md`)

- 화면: `components/ai/AiPanel`(클라이언트)을 `app/projects/[id]/layout.tsx`와 `app/start/standard`에 둬요. 웹 ≥1024px은 오른쪽에 붙고(N2 A), 폰은 'AI에게 묻기'로 전체 화면(`?ai=1` 얕은 주소, 뒤로 가기로 닫힘).
- 로그인 전: 자주 묻는 질문 칩만(C58 · D12, 정적 글). AI 호출 없음.
- 길: `POST /ai/turns`(SSE). 사용자 · 프로젝트 · 보던 화면은 서버가 세션 · 주소로 고정해요(AI 출력으로 받지 않음).
- 무료 모드(기본, `LLM_LIVE=false`): 검색 + 미리 검증한 답 카드 + 계산 엔진. 키가 있으면 같은 길이 LLM을 써요.
- 숫자는 '믿집 계산' 상자로만(계산 엔진 값). 카드 단추(보내기 · 확정 · 달력 열기 · 합지로 보기)는 브라우저가 일반 API를 불러요.

## 9. 웹 + 앱 (dev-01 · dev-08)

- 같은 Next.js 경로 하나에 CSS 기준점 두 개(768 · 1024px). 구조가 다른 조각(공사 띠 · AI 칸 · 채팅 목록 · 아래 탭 바)은 레이아웃에 두고 CSS로 숨겨요.
- 앱은 PWA: `app/manifest.ts` + 아이콘 + 작은 `public/sw.js`(오프라인 안내 한 장, 캐시 안 함). 웹 푸시 없음(D15 C). 스토어가 필요해지면 안드로이드 TWA → iOS Capacitor 순서로 다시 봐요.

## 10. 보안 경계 (자세한 것은 B7 `security.md`)

- 로그인 없는 길: `/health/*` · `/regions*` · `/auth/*` · **`/guest/standard`**. 손님 길은 IP 해시 요청 제한 · 4KB 본문 · 칸 범위 검사.
- 업체에 가는 정보: 구 · 동 · 면적 · 집 상태 · 공사 범위 · 벽지 · 예산(D03 B) · 희망 기간 · 사진(위치 정보 지움). 이름 · 휴대폰 · 동 · 호는 가지 않아요. 고객이 채팅에 직접 쓸 때만 그 업체가 봐요.
- 업체 화면의 고객 이름표는 '상계동 고객'(사본)이에요. 응답 모델에 고객 이름 · 이메일 · 휴대폰 칸을 두지 않아요.
- 줄기(SSE)는 자기 이벤트만 읽어요(키 = 세션 사용자 id). 줄기에는 id만 있어 새도 내용이 없어요.
- 상태를 바꾸는 요청은 지금처럼 Origin 확인 + SameSite=Lax 쿠키예요.

## 11. v2 → v3 바뀌는 것 한눈에

| 영역 | v2(지금) | v3 |
| --- | --- | --- |
| 첫 화면 | 가입해야 견적 | 가입 전 표준견적서(손님 계산 API) |
| 기본 정보 | 평형 구간 · 공간 · 공종 둘 | 공종(도배) · 전체/부분(공간 · 면) · 주거 종류(아파트만) · 동 · ㎡ · 예산(원) · 합지/실크 · 희망일 |
| 표준견적서 | 도배지 ㎡ × 공공/가정 단가 | 도배지 평 × 시장 평균 · 부분 공사 공간 몫(산식 판 고정) |
| 가견적 | 벽 · 천장 ㎡ 시공 단가 | 1201~1208(평 · 품 · 대) |
| 담기 | 담기 = 실측 요청 | 담기(3칸)와 요청을 나눔 |
| 실측 | 연결만(연락처 동의) | 믿집이 날짜 중계(기간 · 반나절 · 수락 · 제안 · 바꾸기 · 기한) |
| 연락 | 연락처 공개 · 연락 방법 | 실측 확정 뒤 채팅(실시간) · 고객이 직접 동 · 호 |
| 공사 날짜 | 시작 ~ 끝 범위 | 날을 하나씩 |
| 추가 금액 | 확인 · 이야기하자 | 승인 · 거절 · 채팅으로 묻기 + 판 |
| 공사 끝 | 고객 확인 | + 7일 자동 · 3일 전 알림 |
| 리뷰 · 신고 | 없음 | 리뷰 · 답글 · 신고 처리 · 회원 정지 |
| 기한 | 화면 표시만 | jobs 예약 + worker + 화면 계산 |
| 앱 | 없음 | PWA 설치 |
