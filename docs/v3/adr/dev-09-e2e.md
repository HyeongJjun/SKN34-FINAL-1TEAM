# dev-09 흐름 검증 e2e: Playwright Test + 깔린 Edge, 시험마다 시연 데이터로 되돌리기

- 상태: 고름(리드 승인: `@playwright/test` 개발 의존성 하나)
- 날짜: 2026-11-19 · 쓴 역할: 개발자(B8)
- 관련 화면 · 이야기: J1 · J3 · J5 · J7 · J10 · J22(`00-prompt.md` 6장 완료 기준) · 관련 코드: `frontend/playwright.config.ts`, `frontend/e2e/**`, `frontend/package.json` · `pnpm-lock.yaml`

## 배경

- 완료 기준은 '핵심 이야기 6개가 실제 화면으로 폰 · 웹 모두 끝까지 돼요'예요. 고객 · 업체 두 사람이 번갈아 누르고(실측 일정 · 채팅), 금액은 계산 엔진(API) 값과 같아야 해요.
- 손으로 누르는 점검(앱 안 브라우저)은 되풀이할 수 없고, 고친 뒤 다시 보기 어려워요. 같은 시험을 언제든 다시 돌릴 도구가 필요해요.
- 브라우저 내려받기(수백 MB)는 하지 않기로 했어요(리드 지시). 공유 시연 DB(`mitjip_v3`)는 다른 묶음이 같이 써서 시험이 바꾸면 안 돼요.

## 대안

| 안 | 내용 | 좋은 점 | 걸리는 점 |
| --- | --- | --- | --- |
| A | Playwright Test(`@playwright/test`) + 깔린 Edge(`channel: 'msedge'`) | 문맥(BrowserContext) 여러 개로 두 사용자를 한 시험에서 동시에, `webServer` 배열로 API · 화면을 띄움, 폰 · 웹을 프로젝트 둘로, 실패 때 스크린샷 · 추적 파일 | 새 개발 의존성 1개(+ playwright · playwright-core) |
| B | 앱 안 브라우저 · 하위 에이전트가 손으로 누르기(지금 방식) | 의존성 없음 | 되풀이 · 숫자 비교가 어렵고, 결과가 사람 기록에만 남아요. CI에 넣을 수 없어요 |
| C | Cypress | 화면 시험 도구로 널리 써요 | 한 시험에 브라우저 탭 · 문맥 둘을 동시에 쓰기 어려워요(채팅 실시간 확인), 브라우저 · 실행 파일 내려받기가 따로 있어요 |

데이터 되돌리기도 셋을 견줬어요.

| 안 | 내용 | 걸리는 점 |
| --- | --- | --- |
| 1 | 폰 · 웹이 같은 DB를 그대로 씀 | 시연 단계가 한 사람씩(c06 강실측 · c09 장공사 …)이라 폰이 바꾼 상태를 웹이 다시 못 써요 |
| 2 | 폰 → (되돌리기 프로젝트) → 웹을 프로젝트 의존으로 | 의존 프로젝트에서 시험 하나라도 실패하면 뒤 프로젝트를 돌리지 않아요[3]. 실패를 기록해야 하는 검증에 안 맞아요 |
| 3 | **시험마다** 시험 DB를 기준 사본으로 되돌림(자동 fixture) + 한 줄로(workers 1) | 시험마다 2~3초 더 걸려요 |

## 고른 것과 이유

- 고른 안: **A + 3**
- 이유
  - 깔린 브랜드 브라우저는 `channel`만 주면 써요. Playwright는 브랜드 브라우저를 따로 내려받지 않아요[1][2]. 이 PC에는 Edge 157 · Chrome 157이 있어요. 그래서 `pnpm add`는 브라우저 없이 패키지만 받아요(내려받기 스크립트 없음, `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`로도 막음).
  - `webServer`는 배열로 여러 서버를 띄우고, `reuseExistingServer: !CI`로 로컬은 떠 있는 서버를 다시 써요. 준비는 `url`이 2xx · 3xx · 400~403을 주면 끝나요[4]. API는 리드 도구 `run-api-copy.sh e2e 8018`(시연 DB를 `mitjip_v3_e2e`로 복사), 화면은 `next dev --port 3108`(출력 `.next-e2e`)이에요.
  - 실패한 시험 뒤에는 일꾼이 새로 떠요[5]. `beforeAll`로 되돌리면 실패 뒤 남은 시험이 다른 데이터로 돌 수 있어서, 시험마다 도는 자동 fixture(`e2e/support/fixtures.ts` `freshDb`)로 되돌려요.
  - 되돌리기: 시험 한 번 시작할 때 `mitjip_v3`를 `pg_dump`로 기준 사본(`mitjip_v3_e2e_base`)에 한 번 떠요(공유 DB는 읽기만). 시험마다 `createdb -T 기준 사본`으로 `mitjip_v3_e2e`를 새로 만들어요(템플릿 복사라 빨라요). API는 `pool_pre_ping`으로 다시 이어 붙어요. 끝나면 기준 사본을 지워요(`e2e/tools/db.sh`).
  - 같은 시험을 되풀이하면 가입(IP 한 시간 10번) · 로그인(IP 15분 50번) · 리뷰(하루 5번) 한도가 차요. 되돌릴 때 B8 Redis db 6의 `rl:*` 한도 키만 지워요(`run-api-copy.sh`가 쓰는 db예요).
  - 비밀번호: 시연 계정은 `backend/app/demo.py`의 `DEMO_PASSWORD`(로컬 시험 값, 환경변수가 있으면 그 값)를 시험 코드가 읽어 써요. 화면 · 기록 · 로그에 찍지 않고 localhost(3108 · 8018)에만 보내요. 새로 만드는 계정(J1 고객 · J10 업체)은 시험 안에서 만든 값을 쓰고 남기지 않아요.
- 버전: `@playwright/test` **1.64.1**(2026-10-14 배포, 한 달 넘음). 그때 가장 새 판 1.65.1은 2026-11-13 배포로 일주일이 안 돼 고르지 않았어요. Node 엔진 요구 `>=20`(이 PC v24.18.1).

## 따라 바뀌는 것 (알려 둘 것)

- `next@16.4.5`가 `@playwright/test`를 선택 peer로 둬서(`peerDependenciesMeta` optional)[6] `pnpm-lock.yaml`의 next 줄 이름에 `(@playwright/test@1.64.1)`가 붙어요. node_modules의 next 링크가 새 자리로 바뀌어서, 그때 떠 있던 `next dev`는 다시 켜는 것이 안전해요(설치 때는 떠 있는 dev 서버가 없었어요).
- `next dev`를 `NEXT_DIST_DIR=.next-e2e`로 처음 켜면 Next가 `frontend/tsconfig.json` include에 `.next-e2e/types/**/*.ts` · `.next-e2e/dev/types/**/*.ts` 두 줄을 더해요(다른 묶음의 `.next-*` 줄과 같은 동작). B8 파일이 아니라 지우지 않았어요.

## 근거 (직접 열어 확인한 것만)

1. Playwright 'Browsers' — https://playwright.dev/docs/browsers (확인 2026-11-19) — 브랜드 브라우저(msedge · chrome)는 기본으로 내려받지 않아요. 없을 때만 `npx playwright install msedge`. CI는 `install --with-deps chromium`
2. Microsoft Learn 'Use Playwright to automate and test in Microsoft Edge' — https://learn.microsoft.com/en-us/microsoft-edge/playwright/ (확인 2026-11-19) — 설정 `use.channel: 'msedge'`(msedge · beta · dev · canary), Edge가 없을 때만 설치
3. Playwright 'Projects' — https://playwright.dev/docs/test-projects (확인 2026-11-19) — 의존 프로젝트의 시험이 실패하면 그 프로젝트에 기대는 시험은 돌지 않아요
4. Playwright 'Web server' — https://playwright.dev/docs/test-webserver (확인 2026-11-19) — `webServer` 배열, `reuseExistingServer`(`!process.env.CI`), 준비 상태 코드, 끝날 때 프로세스 묶음을 끔
5. Playwright 'Parallelism' — https://playwright.dev/docs/test-parallel (확인 2026-11-19) — `workers: 1`로 한 줄, 실패 뒤에는 일꾼을 끄고 새로 띄워 깨끗한 환경을 지켜요
6. npm 레지스트리(이 PC에서 `pnpm view`, 2026-11-19) — `@playwright/test@1.64.1` 의존 `playwright@1.64.1`(설치 스크립트 없음) · 1.64.1 배포 2026-10-14 · 1.65.1 배포 2026-11-13, `next@16.4.5` peer `@playwright/test ^1.51.1`(optional)
- 한국어 검색('Playwright 설치된 Edge channel msedge 브라우저 다운로드 없이 테스트')에서는 공식 한국어 자료를 찾지 못했어요. 위 영어 공식 문서만 근거로 써요.
- 사례: `docs/v3/research/dev.md` S32 · S33(개발자 조사, 같은 문서)

## 검증

- 방법: 폰(390×844) · 웹(1280×800) 두 프로젝트로 이야기 6개(시험 10개 × 2)를 `pnpm exec playwright test`로 끝까지 돌려요. 결과는 `docs/v3/verification/e2e.md`.
- 결과(2026-11-19 최종 실행): 시험 20 · 통과 18 · 실패 2(둘 다 C12 화면 버그 E2E-01 — 도구 · 데이터 문제가 아니에요), 5.4분, 가로 넘침 확인 126줄 넘침 0, 브라우저 내려받음 0. 시험마다 DB 되돌리기가 돼서 폰 · 웹이 같은 시연 단계에서 따로 끝까지 돌았어요. 끝난 뒤 8018 · 3108 서버가 꺼지고 기준 사본이 지워졌어요. 자세히는 `verification/e2e.md`.

## 다시 볼 조건

- CI에 넣을 때: `docker exec`(로컬 컨테이너)를 쓰는 DB 되돌리기를 CI 서비스 컨테이너 방식으로 바꾸고, CI만 `npx playwright install --with-deps chromium`을 써요(`verification/e2e.md` 5장 계획).
- 시험이 늘어 한 줄 실행이 길어지면(30분 넘음): 이야기마다 다른 시험 DB · API 포트를 두고 일꾼을 늘려요.
- Edge가 이 PC에서 없어지거나 판이 크게 바뀌어 맞지 않으면 `E2E_CHANNEL=chrome`으로 바꿔요.
