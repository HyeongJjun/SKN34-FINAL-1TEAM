# security-04 실시간 연결(채팅 · 알림 · AI 답) 인증

- 상태: 제안. 전송 방식은 개발자 역할이 정해요. 이 ADR은 어떤 방식이든 지킬 보안 규칙과 보안 쪽 추천이에요
- 날짜: 2026-11-18 · 쓴 역할: 보안 담당
- 관련 화면 · 이야기: C23~C31 · D05 · V09 · V19 · V20(채팅), C44 · V21(알림 종), C09 · D01(AI 칸), J5 · J8 · J17, 팀 확인 3(고객-업체 채팅의 새 이름, 예: `thread`)
- 관련 코드: `backend/app/main.py` `check_origin` · `backend/app/auth/deps.py` `current_user` · `backend/app/shared/request_guards.py` `BodyLimit` · `backend/app/notify/router.py` · `deploy/aws/Caddyfile`

## 배경

- v3는 고객-업체 채팅을 실시간으로 해요(지금은 없음). 알림 · AI 답도 바로 보여 줘요.
- 지금 보호 장치(Origin 확인 · 본문 한도 · 요청 제한)는 상태를 바꾸는 요청(POST 등)에만 걸려 있어요. GET으로 시작하는 연결(SSE · WebSocket)은 Origin 검사 밖이에요.
- 연결이 오래 살아 있어서 로그아웃 · 정지 · 차단 뒤에도 글을 받거나 보낼 수 있으면 안 돼요.

## 대안

| 안 | 내용 | 좋은 점 | 걸리는 점 |
| --- | --- | --- | --- |
| A | 받기는 SSE(EventSource, 같은 출처 `/api`), 보내기는 POST | 보내기에 지금 보호(Origin · 본문 한도 · 요청 제한 · 요청 키 · 409)를 그대로 써요. EventSource는 같은 출처면 쿠키를 붙이고 헤더를 따로 넣지 않아요. 다른 사이트는 CORS가 없어 응답을 읽지 못해요 | 연결마다 서버 자원을 써요. 받기 · 보내기가 나뉘어요 |
| B | WebSocket(wss) + 세션 쿠키 + 연결 때 Origin 허용 목록 | 양방향이고 빨라요 | CSWSH 위험이 있어 Origin을 꼭 확인해야 해요 [1] [2]. 보내는 글에 지금 미들웨어가 걸리지 않아 본문 한도 · 요청 제한 · 권한을 다시 만들어야 해요 |
| C | WebSocket + 짧은 표(POST로 30초 일회용 표를 받아 첫 메시지로 보냄) | 쿠키에 기대지 않아 CSWSH가 줄어요 [1] | 표 저장 · 만료 관리가 늘어요. URL에 넣으면 로그에 남으니 첫 메시지로만 보내야 해요 [1] [5] |
| D | 짧은 폴링(5~10초 GET) | 가장 단순하고 지금 보호를 그대로 써요 | 느리고 요청이 많아요. 채팅 느낌이 떨어져요 |

## 고른 것과 이유

- 고른 안(보안 쪽 추천): **A**. 개발자 역할이 B를 고르면 아래 규칙의 'B면' 부분을 꼭 지켜요.
- 규칙(공통)
  1. 인증: 세션 쿠키(HttpOnly)만 써요. URL 쿼리에 토큰을 넣지 않아요 [1] [5].
  2. Origin: 연결 요청의 Origin이 허용 목록에 없으면 403이에요. Origin이 없고 `Sec-Fetch-Site`가 `same-origin`이 아니어도 403이에요 [1] [3]. B면 WebSocket 연결(업그레이드)마다 꼭 확인해요 [2].
  3. 권한: 연결할 때 그 방의 두 당사자인지 봐요(아니면 404). 글을 보낼 때마다 정지 · 차단 · 방 닫힘을 다시 봐요 [4].
  4. 세션: 60초마다 세션 · 계정 상태를 다시 보고, 로그아웃 · 정지 · 차단이면 연결을 닫아요. 연결은 최대 1시간이고, 그 뒤 다시 연결하며 다시 인증해요 [1] [4].
  5. 한도: 사용자 연결 5개, 글 2,000자 · 분당 30 · 하루 1,000이에요. 사진은 `/files` 경로로 올려요. B면 한 메시지 4KB까지예요 [1].
  6. 같은 글 두 번: 브라우저가 만든 요청 키를 `UNIQUE(user_id, request_key)`로 한 번만 저장해요(D29 A).
  7. 놓친 글: 다시 연결하면 `Last-Event-ID`(A) 또는 마지막 글 번호(B)부터 받아요. 이때도 권한을 먼저 봐요.
  8. 보내는 내용: 본문을 같이 보내면 가림 규칙(ADR-01 · `security.md` 8.5)을 똑같이 써요. 알림 이벤트에는 본문을 넣지 않아요.
  9. 운영: wss · https만 써요. Caddy가 SSE를 버퍼에 쌓지 않고 바로 넘기는지 확인해요. 앞단 프록시 시간 초과보다 짧게 25초마다 빈 줄(heartbeat)을 보내요.
- 이유
  - OWASP WebSocket 치트시트: 연결 때 Origin 허용 목록, URL 토큰 금지, 글마다 권한, 64KB 이하, 세션이 끝나면 연결 닫기 [1].
  - Include Security 2025: SameSite만 믿으면 나중에 쿠키 설정이 바뀔 때 다시 뚫려요. 연결 때 Origin 확인이 가장 좋은 방어예요 [2].
  - OWASP CSRF: Sec-Fetch-Site를 1차 신호로 보고, Origin이 없으면 Referer, 둘 다 없으면 거절해요 [3].
  - ASVS 3.5.3 Sec-Fetch 검증, 7.4.1 끝난 세션 못 씀, 8.2.2 데이터별 권한 [4]. 14.2.1 URL에 민감 값 금지 [5].
  - A는 보내기에 이미 검증한 보호 장치를 다시 써서 새로 만드는 보안 코드가 가장 적어요. AI 칸도 SSE로 같은 규칙을 써요.

## 근거 (직접 열어 확인한 것만)

1. OWASP WebSocket 보안 치트시트 — https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html (확인 2026-11-18) — Origin 허용 목록, 토큰은 URL이 아니라 첫 메시지로, 글마다 권한, 64KB 이하, 세션 만료 · 로그아웃 때 닫기, wss만
2. Include Security, Cross-Site WebSocket Hijacking Exploitation in 2025(2025.4.17) — https://blog.includesecurity.com/2025/04/cross-site-websocket-hijacking-exploitation-in-2025/ (확인 2026-11-18) — SameSite=Lax가 기본이어도 연결 때 Origin 확인이 가장 좋은 방어
3. OWASP CSRF 방지 치트시트 — https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html (확인 2026-11-18) — Sec-Fetch-Site, Origin이 없으면 Referer, 둘 다 없으면 거절
4. OWASP ASVS 5.0 V3 · V7 · V8 — https://raw.githubusercontent.com/OWASP/ASVS/v5.0.0/5.0/en/0x12-V3-Web-Frontend-Security.md · https://raw.githubusercontent.com/OWASP/ASVS/v5.0.0/5.0/en/0x16-V7-Session-Management.md · https://raw.githubusercontent.com/OWASP/ASVS/v5.0.0/5.0/en/0x17-V8-Authorization.md (확인 2026-11-18) — 3.5.3 · 7.4.1 · 8.2.2
5. OWASP ASVS 5.0 V14 — https://raw.githubusercontent.com/OWASP/ASVS/v5.0.0/5.0/en/0x23-V14-Data-Protection.md (확인 2026-11-18) — 14.2.1 민감 값은 URL에 넣지 않음

- 조사: 검색 4회(영어 4). SSE 쿠키 인증 · CSWSH와 SameSite · FastAPI 보안 헤더 · OWASP Top 10:2025
- 한국어 검색(웹소켓 · SSE 인증 비교)을 하려 했지만, 이번 턴의 웹 검색 한도(모든 에이전트 공유)가 다 차서 못 했어요. 지시문의 '결정마다 5회 · 한국어 함께'에 모자라요. 다음 세션에서 보태요.

## 검증

- 방법
  - T10(`security.md` 9장): 다른 Origin의 연결은 거절되는지 봐요.
  - T12: 남의 방 구독은 404인지 봐요. 연결 중 로그아웃 · 정지 · 차단이면 60초 안에 끊기는지 봐요. 글이 너무 크면 413, 너무 빠르면 429인지 봐요.
  - 부하(개발자와 함께): 연결 200개에서 메모리 · 지연을 재요.
- 결과: 검증 대기(코드는 다음 단계)

## 다시 볼 조건

- 개발자가 전송 방식을 B · C로 정하면 다시 봐요.
- 앱을 PWA에서 네이티브로 바꾸면 다시 봐요(쿠키 대신 토큰).
- 동시 연결이 1,000을 넘거나, 브라우저 SameSite · 쿠키 정책이 바뀌면 다시 봐요.
