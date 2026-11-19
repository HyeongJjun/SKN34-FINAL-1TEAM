# dev-02 실시간 방식: 쓰기는 POST, 받기는 사용자별 SSE 한 줄기(Redis Stream)

- 상태: 고름
- 날짜: 2026-11-18 · 쓴 역할: 개발자
- 관련 화면 · 이야기: C23~C31 · C62 · D05 · V09 · V19 · V20(채팅), 머리 알림 수(C44 · V21), J5 · J8 · J12 · J17 · 관련 코드: 새 `backend/app/realtime/`, 새 `backend/app/thread/`, `backend/app/queue.py`, `frontend/next.config.ts`, `deploy/aws/Caddyfile`

## 배경

v3는 실측이 확정되면 고객과 업체가 실시간으로 채팅해요. 알림 수 · 실측 일정 카드도 새로 고침 없이 바뀌어야 해요. 운영 API는 uvicorn 2프로세스이고(`backend/Dockerfile`), 앞에 Cloudflare(무응답 125초에 끊음) · Caddy가 있어요. 로그인은 HttpOnly 쿠키예요.

## 대안

| 안 | 내용 | 좋은 점 | 걸리는 점 |
| --- | --- | --- | --- |
| A | 쓰기는 REST POST, 받기는 SSE(`GET /stream`) + 사용자별 Redis Stream | 쿠키 그대로 · 브라우저가 알아서 다시 잇고 `Last-Event-ID`로 놓친 것을 받아요 · 프로세스 여럿이어도 됨 · 새 의존성 없음(FastAPI 내장) | 한 연결이 Redis 연결 하나를 쥐어요. 개발 서버 다시 쓰기에서 압축을 꺼야 해요 |
| B | A인데 Redis Pub/Sub | 가벼워요 | 끊긴 동안 온 것을 잃어요(최대 한 번). 다시 잇기를 따로 만들어야 해요 |
| C | WebSocket | 양방향 · 입력 중 표시 | 다시 잇기 · 다시 인증을 직접 만들어요. 연결 목록이 한 프로세스에서만 돼서 중계가 따로 필요해요. Next 개발 다시 쓰기로 못 넘겨요 |
| D | 짧은 폴링(10초) | 가장 단순 | 채팅이 늦고 요청이 많아요 |
| E | PostgreSQL LISTEN/NOTIFY | Redis 없이 | 연결마다 DB 연결을 쥐어요(프로세스당 10개 한도). 다시 잇기 없음 |

## 고른 것과 이유

- 고른 안: **A**. 원본은 언제나 DB이고, 실시간 줄기는 '깨우는 신호'만 보내요(본문 · 연락처는 Redis에 넣지 않아요).
- 이유
  - FastAPI 0.135+에 SSE가 들어 있고(S12) 잠근 0.162.0에서 `fastapi.sse`와 15초 ping을 확인했어요. Cloudflare 125초(S17)보다 훨씬 짧아요.
  - SSE는 브라우저가 다시 이을 때 `Last-Event-ID`를 보내요(S14). Redis Stream id를 SSE `id`로 쓰면 그 뒤부터 그대로 읽어요. Pub/Sub은 끊기면 잃어요(S16).
  - WebSocket 연결 목록은 한 프로세스에서만 돼요(S13). 우리는 2프로세스라 어차피 Redis가 필요해요. 채팅 화면에 입력 중 표시가 없어서 양방향이 필요 없어요.
  - Caddy는 `text/event-stream`을 바로 내보내요(S20). Cloudflare 압축 목록에 이벤트 스트림이 없고 `no-transform`이면 손대지 않아요(S18).
  - 실험: 2프로세스에서 다른 프로세스가 쓴 글을 받고, `Last-Event-ID`로 놓친 2개를 다시 받고, 끊으면 Redis 연결이 닫혔어요(`verification/dev.md`).

## 정한 세부

- 줄기 키: `mj:{env}:ev:{user_id}`(Redis Stream, `MAXLEN ~ 500`, 7일 뒤 지움). 이벤트: `msg`(thread · seq) · `read` · `notif`(안 읽은 수) · `state`(kind · project · id) · `resync`.
- 쓰는 곳: 상태를 바꾼 service가 commit **뒤에** `realtime.push(...)`를 불러요. Redis가 안 되면 버리고 로그만 남겨요(원본은 DB).
- 읽는 곳: `GET /stream`이 연결 때 마지막 id를 잡아 두고(`$`를 고리 안에서 다시 쓰지 않아요) `XREAD BLOCK`으로 기다려요. 받은 id가 이미 잘렸으면 `resync`를 보내요.
- Redis 연결: `queue.redis`는 `socket_timeout=1`이라 오래 기다리는 읽기에 못 써요. 줄기마다 따로 연결하고 끝나면 닫아요.
- 머리: `Cache-Control: no-cache, no-transform`. Caddy는 `/api/stream`만 `encode`에서 빼요(B7). **개발 `next.config.ts`는 `compress: false`**(실험으로 확인한 것).
- 연결 한도: 사용자마다 동시 5줄기(B7 요청 제한). 로그아웃 · 정지되면 다음 확인(60초) 때 닫아요.
- 채팅 글 순서: 대화마다 `seq`를 대화 행 잠금으로 하나씩 올려요(같은 대화의 글은 commit 순서 = seq 순서). 화면은 `after_seq`로 REST에서 빠진 것을 채워요.

## 근거 (직접 열어 확인한 것만)

1. S12 FastAPI SSE — https://fastapi.tiangolo.com/tutorial/server-sent-events/ (확인 2026-11-18)
2. S13 FastAPI WebSockets — https://fastapi.tiangolo.com/advanced/websockets/ (확인 2026-11-18) — 한 프로세스 한계
3. S14 HTML 표준 SSE — https://html.spec.whatwg.org/multipage/server-sent-events.html (확인 2026-11-18) — Last-Event-ID · 200 아니면 다시 잇지 않음
4. S15 MDN SSE — https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events (확인 2026-11-18) — HTTP/1.1 6개 한도
5. S16 Redis Pub/Sub — https://redis.io/docs/latest/develop/pubsub/ (확인 2026-11-18) — 최대 한 번, Streams 권함
6. S17 Cloudflare 524 — https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-5xx-errors/error-524/ (확인 2026-11-18) — 125초
7. S18 Cloudflare 압축 — https://developers.cloudflare.com/speed/optimization/content/compression/ (확인 2026-11-18)
8. S19 · S20 Caddy encode · reverse_proxy — https://caddyserver.com/docs/caddyfile/directives/encode · https://caddyserver.com/docs/caddyfile/directives/reverse_proxy (확인 2026-11-18)

## 검증

- 방법: (1) 스크래치 실험(uvicorn 2프로세스, Redis db 13) (2) Next 개발 다시 쓰기 통과 여부 (3) B1b가 만든 뒤 pytest: 두 사용자 · 두 연결 · 끊고 다시 잇기 · 권한(남의 줄기 못 읽음) (4) 스테이징에서 Cloudflare → Caddy를 지나 2분 넘게 열어 두기.
- 결과: (1) · (2)는 했음 — 6/6 전달, 다른 프로세스가 쓴 글 2~4개, 다시 잇기 정확, 끊은 뒤 연결 0개. 다시 쓰기는 압축이 켜져 있으면 20초 동안 0바이트, `compress: false`면 바로 옴. (3) · (4)는 검증 대기.

## 다시 볼 조건

- 동시 접속이 수천을 넘어 Redis 연결 수가 부담될 때 → 프로세스마다 줄기 하나를 읽어 나눠 주는 방식으로 바꿔요.
- 입력 중 표시 · 음성 같은 양방향 기능이 들어올 때 → C(WebSocket)를 그 기능에만.
- 9판 D15를 바꿔 웹 푸시를 켤 때(dev-01과 함께).
