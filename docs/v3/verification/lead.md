# 리드 검증 기록

실제로 돌린 것만 적어요. 사용자 허락(2026-11-19)에 따라 localhost에서 시연 시험 계정으로 로그인한 점검도 여기에 적어요. 비밀번호 값은 적지 않아요.

| 날짜 | 무엇 | 명령 · 방법 | 결과 |
| --- | --- | --- | --- |
| 2026-11-18 | 테스트 도구 시험 | `bash .claude/run-tests.sh lead tests/test_health.py tests/test_guards.py -q` | 14 passed |
| 2026-11-19 | 테스트 모으기(보안 폴더 패키지로 둔 뒤) | `run-tests.sh lead tests/ --collect-only -q` | 921 collected, 오류 0 |
| 2026-11-19 | 뜻 채점 집계 | `uv run --no-sync python ../evaluation/v3/judge_score.py --doc` | `evaluation/v3/results/judge_summary.md`, 정리 `verification/agents-final.md` |
| 2026-11-19 | LLM 흉내 출력 검사 | `uv run --no-sync python ../evaluation/v3/llm_sim/check_outputs.py --pack` | 18몫 모두 통과(떨어짐 0 · 인용 빠짐 0 · 개인정보 0), 채점 묶음 30 |
| 2026-11-19 | 공유 서버 | preview `v3-api`(8030) · `v3-web`(3030) | `/health/live` ok, `/health/ready` db · redis ok, 홈 200 · 9판 글 그대로 |
| 2026-11-19 | 프런트 마지막 확인 | `pnpm typecheck` · `pnpm lint` · `NEXT_DIST_DIR=.next-lead pnpm build` | 오류 0 · 0 · 빌드 통과 |
| 2026-11-19 | 백엔드 린트 · 저장소 점검 | `uv run ruff check` · `ruff format --check` · `check_repo.py` | 통과 · 391파일 · 통과 |
| 2026-11-19 | 업체 작업함 실제 데이터(시연 업체 마루와벽, localhost) | 앱 안 브라우저 `vendor.localhost:3030/vendor`, 폰 폭(268px) · 웹 1280×800 | 아래 표 |
| 2026-11-19 | 백엔드 전체 테스트(마지막) | `bash .claude/run-tests.sh lead tests/ -q -p no:cacheprovider` | **1231 passed · 실패 0**(32분 49초). 경고 4개: `/ai/*` 연산 이름이 겹친다는 FastAPI 경고 |
| 2026-11-19 | 위 경고 원인 · 고침 | FastAPI 0.162는 붙인 router를 펼치지 않아요(`app.routes`에 `_IncludedRouter`로 남아요). 그래서 `test_v3_ai_api.py`의 '없으면 붙이기' 검사가 AI 경로를 못 보고 한 번 더 붙였어요. `main.py` ROUTERS에 이미 있으니 임시 붙이기를 지웠어요. 운영 앱은 처음부터 한 번만 붙어 있어요(openapi 146경로) | `run-tests.sh lead tests/test_v3_ai_api.py tests/test_v3_contract.py` **24 passed · 경고 0**, ruff 통과 |
| 2026-11-19 | B8 e2e 보고 뒤 고침 | E2E-01(C12 가까운 구 카드 구 이름) · C38 알림 날(`done_remind_at`) · `.gitignore` · `tsconfig.json` — 자세히는 `verification/e2e.md` 8장 | 백엔드 25 passed · typecheck 0 · lint 0 · 걸린 여정 셋 e2e **14 passed**(3.4분) |
| 2026-11-19 | e2e 마지막 | `pnpm exec playwright test` 전체 **20 passed**(4.8분) → C38 날짜 + 조사 줄바꿈 고친 뒤 J7 · J22 **10 passed**(2.6분). 공유 화면 서버 3030은 lock 바뀐 뒤라 다시 켰어요(홈 200) | `verification/e2e.md` 8장 |
| 2026-11-19 | 마지막 고침 뒤 백엔드 | `run-tests.sh lead` 공사(deal)를 다루는 19파일 + `test_v3_ai_api.py` | **222 passed · 실패 0**(14분 15초) |
| 2026-11-19 | 마지막 고침 뒤 린트 · 빌드 | `ruff check` · `ruff format --check` · `check_repo.py` · `NEXT_DIST_DIR=.next-e2e pnpm build` | 통과 · 391파일 · 통과 · 빌드 통과(정적 34/34), `tsconfig.json` 그대로 |
| 2026-11-19 | 확정 공정표 두 보기(사용자 요청) | `PlanViewTabs`(날짜별로 보기 · 공정별로 보기) + `ScheduleChart` `view`(auto · list · table). 처음에는 폰 날짜별 · 웹 공정별, 누르면 폭과 상관없이 바꿔요. 폰 공정별 표는 이름 칸 96px | typecheck 0 · lint 0 · e2e J7 · J22 **10 passed**(2.6분) |
| 2026-11-19 | 위 화면 직접 확인(localhost 시연 고객 장공사) | 앱 안 브라우저 390×844 · 1280×800, 탭 누르기 | 폰: 처음 날짜별(aria-selected) → 공정별 표 318px가 상자 318px에 딱 맞음, 화면 넘침 0, 40px보다 작은 누를 곳 0. 웹: 처음 공정별(표 800px) → 날짜별 목록, 넘침 0. 탭 높이 44px. 콘솔 오류는 서버 다시 켤 때 남은 HMR 연결뿐 |
| 2026-11-19 | 초보 질문 고칠 것 1~7(사용자 요청) | 관문 · 범위 밖 · 공종 낱말 · 합치기 · 추천 글 · 카드 열쇠 87개 · 쉬운 말(카드 6 · 요약 1). 자세히는 `evaluation/v3/results/beginner_eval.md` 5장 | 에이전트 테스트 **119 passed**, ruff 통과, `cards_check.py` 416장 오류 0 · 경고 0, `summaries_check.py --installed` 624 통과 |
| 2026-11-19 | 같은 227개 다시 재기 | `beginner_eval.py`(고치기 전 판은 스크래치 '고치기 전 코드 사본'으로 다시 돌려 아침 결과와 227개 같음을 확인) | 근거로 답함 dev 30 → 85 · **held-out 13 → 12**, 되풀이 12 → 0, 일반 메뉴 되묻기 7 → 2, 범위 밖 2/11 → 8/11. 열쇠는 dev만 늘림(외운 몫) |
| 2026-11-19 | 회귀: 질문 은행 · 여러 공종 | `e3_answers.py --no-grid [--final] --tag _pre_beginner · _post_beginner` · `e4_multi.py [--final]` | 은행 dev 77 → 76/290 · held-out 18 → 18/133, 범위 밖 · 되묻기 · 지어낸 숫자 그대로. E4 덮기 그대로(dev 0.26 · held-out 0.136), 묶음 수 2.39 → 1.36. B5 기록 0.66보다 오늘 고치기 전부터 낮음(원인 못 찾음) |

## 업체 작업함 실제 데이터 점검 (시연 업체 마루와벽)

| 확인 | 결과 |
| --- | --- |
| 탭 숫자 | 할 일 2 · 기다림 2 · 일정 1 · 공사 3 · 끝남 5 (시연 표 · API와 같음) |
| 면적 표기 | '노원구 상계동 · 공급 69.4㎡' (기준 붙음) |
| 공사 희망일 보이기(L04) | '공사 시작 희망 1.6(수)' |
| 기한(D15 C, 48시간) | '기간 답하기 · 모레 07:51까지' |
| 가견적 | 318만 6,150원 (9판 C11과 같음) |
| 위치 안내 글(CF-01) | '위치는 동네(구 · 동)까지만 보여요. 동 · 호수 · 연락처는 고객이 채팅으로 알려 줘요.' |
| 고객 이름 · 전화 | 보이지 않음 |
| 폰 폭 | 가로 넘침 없음(253/268), 40px보다 작은 누를 곳 0, 영어 상태값 0 |
| 웹 1280 | 표 + 옆 자세히 칸(N4 C), 가로 넘침 없음(1265/1280), 40px보다 작은 누를 곳 0 |
