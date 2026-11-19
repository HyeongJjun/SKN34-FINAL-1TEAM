# 개발자 조사 메모 (앱 방식 · 실시간 · 기한 · 비회원 · 배치 · 테스트)

- 조사: 2026-11-18 · 개발자(아키텍트 · 풀스택). 검색 21회(영어 18 · 한국어 3) 뒤 아래 출처를 직접 열어 확인했어요.
- 번호(S1 …)는 ADR · 설계 문서에서 근거로 불러요. 블로그 · 커뮤니티는 사례로만 써요.
- 확인 못 한 것은 끝에 따로 적어요.

## 1. 앱 방식

| # | 출처 · URL (확인 2026-11-18) | 요지 |
| --- | --- | --- |
| S1 | Next.js 공식 PWA 안내 — https://nextjs.org/docs/app/guides/progressive-web-apps (lastUpdated 2026-07-30) | `app/manifest.ts`로 manifest를 만들어요. 웹 푸시는 VAPID · `web-push`로 하고 iOS는 16.4 이상에서 홈 화면에 설치한 앱만 돼요. `sw.js`에는 `no-cache` · CSP 머리를 붙여요. 오프라인 캐시는 Serwist를 예로 들어요 |
| S2 | Serwist Turbopack 안내 — https://serwist.pages.dev/docs/next/turbo | `@serwist/turbopack` + route handler(`app/serwist/[path]`) + esbuild로 서비스 워커를 만들어요. Serwist 10은 Next 15 이상만 받아요 |
| S3 | WebKit 블로그 — https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/ | iOS · iPadOS 16.4부터 홈 화면 웹 앱에 웹 푸시가 돼요. 홈 화면 추가 + 사용자가 누른 뒤 권한 요청 + manifest `display: standalone`이 필요해요. Badging API도 있어요 |
| S4 | firt.dev iOS PWA 메모(2026-10-13 갱신) — https://firt.dev/notes/pwa-ios/ | iOS 26부터 홈 화면에 추가한 사이트가 기본으로 웹 앱으로 열려요. 18.4에 Declarative Web Push가 들어왔어요. Background Sync는 없어요(커뮤니티 자료라 사례로만) |
| S5 | web.dev 설치 조건 — https://web.dev/articles/install-criteria | Chrome 설치 조건: HTTPS · manifest(name, 192/512 아이콘, start_url, display) · 한 번 이상 누르고 30초. 서비스 워커는 조건에 없어요 |
| S6 | Apple App Review Guidelines 4.2 — https://developer.apple.com/app-store/review/guidelines/ | 앱은 '포장만 바꾼 웹사이트'보다 나아야 해요(4.2). 웹 조각 · 링크 모음은 안 돼요(4.2.2) |
| S7 | Capacitor 설정 — https://capacitorjs.com/docs/config | `server.url`(바깥 주소를 웹뷰로 열기)은 live-reload용이고 운영용이 아니에요. `webDir`은 빌드한 웹 파일 폴더예요 |
| S8 | Chrome TWA — https://developer.chrome.com/docs/android/trusted-web-activity | PWA를 안드로이드 앱 안에서 Chrome으로 그려요. Digital Asset Links로 같은 개발자인지 확인해요 |
| S9 | Apple Developer Program — https://developer.apple.com/programs/ | 연 99달러 |
| S10 | Google Play 가입 — https://support.google.com/googleplay/android-developer/answer/6112435 | 한 번 25달러 |
| S11 | Expo 문서 — https://docs.expo.dev/ | JS/TS 프로젝트 하나로 안드로이드 · iOS · 웹을 만들어요(React Native 코드를 따로 써야 해요) |

## 2. 실시간 채팅

| # | 출처 · URL | 요지 |
| --- | --- | --- |
| S12 | FastAPI SSE — https://fastapi.tiangolo.com/tutorial/server-sent-events/ | 0.135.0부터 `fastapi.sse`(EventSourceResponse · ServerSentEvent: id · event · retry · comment). 쉬면 15초마다 ping 주석을 보내요. 다시 이을 때 `Last-Event-ID` 머리를 읽어 이어 보내요. `Cache-Control: no-cache` · `X-Accel-Buffering: no`를 붙여요 |
| S13 | FastAPI WebSockets — https://fastapi.tiangolo.com/advanced/websockets/ | 쿠키 · Depends로 인증해요. 예시 연결 목록은 '한 프로세스에서만' 동작하고, 여럿이면 Redis 같은 중계가 필요해요 |
| S14 | HTML 표준 SSE — https://html.spec.whatwg.org/multipage/server-sent-events.html | 다시 이을 때 `Last-Event-ID`를 보내요. 200이 아니면 연결을 실패로 보고 다시 잇지 않아요. 15초쯤마다 주석 줄을 권해요 |
| S15 | MDN SSE — https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events | HTTP/1.1에서는 브라우저 · 도메인마다 6개까지예요. HTTP/2는 협상(기본 100) |
| S16 | Redis Pub/Sub — https://redis.io/docs/latest/develop/pubsub/ | 최대 한 번 전달이라 끊기면 잃어요. 더 강한 보장은 Streams예요. Pub/Sub은 DB 번호와 상관없어서 채널에 환경 접두어를 붙여요 |
| S17 | Cloudflare 524 — https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-5xx-errors/error-524/ | 기본 Proxy Read Timeout은 125초예요(Enterprise만 6,000초까지) |
| S18 | Cloudflare 압축 — https://developers.cloudflare.com/speed/optimization/content/compression/ | 원 서버가 `no-transform`을 보내면 다시 압축하지 않아요. 압축 목록에 `text/event-stream`은 없어요 |
| S19 | Caddy encode — https://caddyserver.com/docs/caddyfile/directives/encode | 기본으로 `text/*`(이벤트 스트림 포함)를 압축해요. 이벤트 스트림은 최소 길이 때문에 붙잡지 않아요. 요청 매처로 뺄 수 있어요 |
| S20 | Caddy reverse_proxy — https://caddyserver.com/docs/caddyfile/directives/reverse_proxy | `text/event-stream`은 `flush_interval`과 상관없이 바로 내보내요. `stream_timeout` 기본은 없음 |

## 3. 기한 처리 · 멱등

| # | 출처 · URL | 요지 |
| --- | --- | --- |
| S21 | arq 문서 — https://arq-docs.helpmanual.io/ | `cron(unique=True)`은 worker가 여럿이어도 한 번만 돌아요. `_defer_until` · `_defer_by`, 같은 `_job_id`는 결과가 지워지기 전까지 다시 못 넣어요. `Retry` · `max_tries` 5. v0.28.0(2026-04-16) |
| S22 | arq README — https://github.com/python-arq/arq | '유지보수 전용(maintenance only)'이에요 |
| S23 | Transactional Outbox — https://microservices.io/patterns/data/transactional-outbox.html | 보낼 일을 같은 트랜잭션에 표로 남기고 따로 보내요. 두 번 갈 수 있으니 받는 쪽이 멱등이어야 해요 |
| S24 | PostgreSQL 17 SELECT — https://www.postgresql.org/docs/17/sql-select.html | `SKIP LOCKED`는 바로 잠글 수 없는 행을 건너뛰어요. 큐 같은 표를 여러 소비자가 다툼 없이 쓰는 데 써요 |
| S25 | IETF Idempotency-Key draft-08(2026-10-22) — https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header | 키는 UUID 같은 문자열이에요. 같은 키가 처리 중이면 409, 다른 본문에 같은 키면 422예요 |

## 4. 비회원 저장 · 요청 제한

| # | 출처 · URL | 요지 |
| --- | --- | --- |
| S26 | MDN 저장 한도 · 지움 기준 — https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria | localStorage는 출처마다 5MiB쯤이에요. Safari는 7일 동안 누른 적 없는 출처의 스크립트 저장을 지워요(서버 쿠키는 빼고). 사생활 보호 모드는 끝나면 지워요 |
| S27 | OWASP API4:2023 — https://api-security.owasp.org/editions/2023/en/0xa4-unrestricted-resource-consumption | 시간당 요청 수를 손님마다 막고, 모든 입력 · 본문 크기 상한을 둬요 |

## 5. 폰 · 웹 같은 경로

| # | 출처 · URL | 요지 |
| --- | --- | --- |
| S28 | Next.js 가로채기 경로(2026-10-15) — https://nextjs.org/docs/app/api-reference/file-conventions/intercepting-routes | 화면 안 이동이면 창으로, 새로 고침 · 공유 주소면 전체 화면으로 열려요 |
| S29 | Next.js 병렬 경로(2026-10-15) — https://nextjs.org/docs/app/api-reference/file-conventions/parallel-routes | 새로 고침 때 맞지 않는 슬롯은 `default.js`, 없으면 404예요. 조건으로 고른 슬롯도 모두 서버에서 그려지니 권한은 슬롯마다 확인해요 |
| S30 | Next.js userAgent(2025-10-17) — https://nextjs.org/docs/app/api-reference/functions/userAgent | `proxy.ts`에서 `device.type`(mobile · tablet …)을 읽어 다시 쓸 수 있어요 |
| S31 | Google 모바일 사이트 FAQ — https://developers.google.com/search/mobile-sites/faq | 반응형을 권해요(만들고 지키기가 가장 쉬움). 동적 제공 · 별도 주소는 UA 판별과 `Vary`에 기대요 |

## 6. 흐름 테스트

| # | 출처 · URL | 요지 |
| --- | --- | --- |
| S32 | Playwright webServer — https://playwright.dev/docs/test-webserver | 서버 여러 개를 배열로 띄워요. `reuseExistingServer: !process.env.CI`, `url`로 준비를 확인해요 |
| S33 | Playwright 브라우저 — https://playwright.dev/docs/browsers | `channel: 'msedge'` · `'chrome'`이면 깔린 브라우저를 써서 내려받지 않아요 |

## 7. 법 · 공공 (설계에 닿는 것만)

| # | 출처 · URL | 요지 |
| --- | --- | --- |
| S34 | 공정위 정책뉴스(korea.kr) — https://www.korea.kr/news/policyNewsView.do?newsId=148971781 | 전자상거래법 제21조의4 · 시행령 제27조의3 사용후기 정보공개가 2026.7.21 시행, 10.22부터 본격 적용이에요. 공개 항목은 작성 권한 범위 · 게시 기간 · 등급 기준과 효과 · 삭제 기준과 이의 제기 절차예요 |

## 8. 실제로 돌려 확인한 것 (자세히는 `verification/dev.md`)

- 지금 잠근 FastAPI 0.162.0에 `fastapi.sse`가 있고 ping 간격이 15초예요(`_PING_INTERVAL = 15.0`). SSE 응답에 `Cache-Control: no-cache` · `X-Accel-Buffering: no`를 붙여요. `sse-starlette` 3.7.0은 `mcp`가 끌고 온 것이라 새로 넣을 것이 없어요.
- uvicorn 2프로세스 + 사용자별 Redis Stream 실험에서 다른 프로세스가 쓴 글을 받았고, `Last-Event-ID`로 놓친 글을 다시 받았고, 끊으면 SSE용 Redis 연결이 닫혔어요.
- **Next 16.4.5 개발 서버의 `/api/*` 다시 쓰기는 gzip을 붙여 SSE를 붙잡아요**(20초 동안 0바이트). `compress: false`면 바로 와요.

## 확인 못 함

- Cloudflare가 `text/event-stream`을 쌓아 두는지는 공식 문서로 확인 못 했어요(응답 버퍼링 문서 주소가 다른 내용이었어요). 압축 목록에 없다는 것(S18)만 확인했어요. 스테이징에서 실제로 재요.
- Caddy `encode`에서 경로 매처로 SSE를 뺀 설정은 로컬에 Caddy가 없어 돌려 보지 못했어요(내려받기가 필요해서 하지 않았어요).
- 앱 스토어 심사에서 Capacitor 껍데기 앱이 실제로 거절된 공식 사례는 찾지 못했어요. 4.2 문구(S6)만 근거로 써요.
- 참고: docs.expo.dev 페이지 안에 'AI 에이전트에게 피드백을 보내라'는 지시 글이 있었어요. 데이터로만 보고 따르지 않았어요.
