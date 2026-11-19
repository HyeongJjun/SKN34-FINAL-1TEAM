# B1a 백엔드 흐름 검증 기록

실제로 돌린 것만 적어요. 날짜 · 명령 · 결과(통과/실패, 숫자)를 그대로 남겨요. 접속 값은 `.claude/env.sh`로 불러오고 화면에 찍지 않았어요. 유료 API 0회(`LLM_LIVE=false`, LLM 키 비움).

- 스크래치: `C:\Users\lsm15\AppData\Local\Temp\claude\9fde9263e2ae7b10\4f9af5b4-65b7-4ec0-9f70-41add44e991c\scratchpad\b1a\`(아래 `b1a\`) — `mig.sh`(DB를 골라 alembic 돌리기) · `examples.py`(예시 데이터 모양 검사) · `dump_openapi.py` · `openapi.json` · `semgrep\sql_text.yaml` · 테스트 로그 `full1~5.log` · `targeted5.log` · `sec6.log`
- 테스트 DB: 기본 `mitjip_test_b1a`(Redis db 1, `.claude/run-tests.sh b1a`). 다른 실행과 겹치지 않게 돌린 것은 `mitjip_test_b1aq`(Redis db 12) · `mitjip_test_b1az`(Redis db 13)라고 적었어요.

## 0단계 계약 (2026-11-18)

| 날짜 | 무엇 | 명령 · 방법 | 결과 | 남은 일 |
| --- | --- | --- | --- | --- |
| 2026-11-18 | migration 올리기 · alembic check (빈 DB) | `bash b1a\mig.sh mitjip_scratch_b1a recreate` → `… upgrade head` → `… check` | 0001 → 0030_v3_work 통과, **No new upgrade operations detected** | |
| 2026-11-18 | 0030 → 0023 내리기 → 다시 올리기 | `… downgrade 0023_reference_simplify` → `… upgrade head` → `… check` | 통과, 다시 올린 뒤 check 차이 없음 | |
| 2026-11-18 | 내린 스키마가 처음 0023과 똑같은지 | 새 DB `mitjip_scratch_b1a_base`를 0023까지만 올리고, 내린 DB와 칸 · 제약(`pg_get_constraintdef`) · 색인(`indexdef`)을 글로 뽑아 견줌 | 852줄 대 852줄, **다른 줄 0** | |
| 2026-11-18 | 개발 DB 올리기 · alembic check (지시대로) | `.claude/env.sh` 불러온 셸, `DATABASE_URL=…/mitjip_v3` → `uv run alembic upgrade head && uv run alembic check` · `alembic current` · `alembic heads` | 통과, **No new upgrade operations detected**, current = heads = `0030_v3_work (head)` 하나, 표 **61개**(alembic_version 빼고) | 0032는 아래 |
| 2026-11-18 | 지시한 테스트 명령 그대로 | `bash .claude/run-tests.sh b1a tests/ -q -x -p no:cacheprovider` | **모으기에서 멈춤: ERROR 1(test_data_ingest), 7.81초.** B7이 새로 둔 `tests/security/conftest.py`가 `conftest` 이름으로 올라가 `from conftest import query`를 쓰는 지금 테스트 6개(test_data_ingest · test_knowledge_search · test_reference_migration · test_reference_schema · test_v2_ask · test_v2_ask_chat)가 못 모아져요 | 리드에 부탁(contract.md 8장). 아래는 `--ignore=tests/security` + 보안 폴더 따로 |
| 2026-11-18 | 지금 테스트 전부 1회차 (새 v3 테스트 쓰기 전) | `bash .claude/run-tests.sh b1a tests/ --ignore=tests/security -q -p no:cacheprovider` | **7 failed · 646 passed**, 1299.97초. 실패: test_agent_gate 4 · test_v2_ask 1 · test_v2_ask_chat 1(아래 Jev 줄) · **test_visit_inbox 1(B1a 탓: 요약에 `sched` 칸을 더해 사전 비교가 달라짐)** | inbox는 고침(아래) |
| 2026-11-18 | 실패 6개가 B1a와 상관없는지 | 같은 테스트를 `JEV_ENABLED=true`로: `pytest tests/test_agent_gate.py` · `tests/test_v2_ask.py tests/test_v2_ask_chat.py tests/test_visit_inbox.py` (DB `mitjip_test_b1aq`, LLM 키 비움 · `LLM_LIVE=false`라 유료 0) | **24 passed** · **52 passed**(inbox 고친 뒤). 원인은 그때 테스트 환경의 `JEV_ENABLED=false`(Jev 스텁을 부르는 테스트가 Jev를 기대해요) | 리드가 `.claude/env.sh`에서 지움(2026-11-19) |
| 2026-11-18 | 바뀐 테스트 | `tests/test_visit_request.py` 날 SQL에 `attempt + 1`(같은 업체 다시 요청 = 새 시도), `tests/test_visit_inbox.py` 요약 기대값에 `"sched": 0` | 두 파일 통과(88 passed · 52 passed 안) | 테스트 뜻은 그대로 |
| 2026-11-18 | 새 v3 테스트 (제약 · 계산 · jobs · 계약) | `bash .claude/run-tests.sh b1aq tests/test_v3_calc_deadline.py tests/test_v3_calc_slots.py tests/test_v3_jobs_service.py tests/test_v3_contract.py tests/test_v3_schema_visit.py tests/test_v3_schema_misc.py -q` | **51 passed**, 134.82초 (그 뒤 52번째 `test_profile_and_portfolio_v3_fields_are_saved` 1 passed) | |
| 2026-11-18 | 지금 테스트 전부 2회차 (v3 테스트 · inbox 고침 포함. POST /projects 몸통 되돌리기 · B7 부탁 반영 **전** 코드) | `bash .claude/run-tests.sh b1a tests/ --ignore=tests/security -q -p no:cacheprovider` (그때 env.sh는 `JEV_ENABLED=false`) | **6 failed · 702 passed**, 1595.63초. 실패 6개는 위 Jev 줄과 같은 것(test_agent_gate 4 · test_v2_ask 1 · test_v2_ask_chat 1) | |
| 2026-11-18 | 같은 것을 `JEV_ENABLED=true`로 | DB `mitjip_test_b1aq` · Redis db 12 · `pytest tests/ --ignore=tests/security -q` | **708 passed · 0 failed**, 1602.88초 | |
| 2026-11-18 | 백엔드 린트 (B1a 파일 67개) | `uv run ruff check <B1a 파일>` · `uv run ruff format --check <B1a 파일>` | **All checks passed!** · **67 files already formatted** | 다시 돌림(아래) |
| 2026-11-18 | OpenAPI · 모양 이름 | `APP_ENV=local uv run python b1a\dump_openapi.py b1a\openapi.json` | 연산 **153**(이전 97, 새 뼈대 56), 모양 **330**(이전 234), 같은 이름 다른 모양(`__`) 0개, 새로 갈린 `-Input/-Output` 0개 | |
| 2026-11-18 | 예시 데이터 모양 (contract.md 6장) | `uv run python b1a\examples.py` (13개를 `model_validate` · 칸 빠짐 확인) | **13/13 통과** | |
| 2026-11-18 | 프런트 타입 검사 (처음 바꾸기 전 · 뒤) | `pnpm exec tsc --noEmit -p .` 바꾸기 전 · 뒤, 그리고 `pnpm typecheck` · `pnpm lint` | 전 **오류 0** · 뒤 **오류 0** · typecheck · lint exit 0 | 마지막 확인은 아래 |

## 몸통 되돌리기 · B7 부탁 반영 (리드 지시, 2026-11-19)

| 날짜 | 무엇 | 명령 · 방법 | 결과 | 남은 일 |
| --- | --- | --- | --- | --- |
| 2026-11-19 | migration 0032 (빈 DB) | `b1a\mig.sh mitjip_scratch_b1a recreate` → `upgrade head` → `check` → `heads` → `downgrade 0030_v3_work` → `upgrade head` → `check` → `downgrade 0023_reference_simplify` → `upgrade head` → `check` | 모두 통과, check마다 **No new upgrade operations detected**, head 하나 `0032_v3_file_views` | |
| 2026-11-19 | 개발 DB에 0032 | `b1a\mig.sh mitjip_v3 current` → `upgrade head` → `check` → `current` · `heads` | 0030 → 0032 통과, **No new upgrade operations detected**, current = heads = `0032_v3_file_views (head)`, 표 **62개**, 제약 `ck_file_views_viewer_role` · `pk_file_views`, 색인 `ix_file_views_owner_at` | |
| 2026-11-19 | semgrep 오탐 2건 | semgrep 1.186.0(uv 캐시, `--offline`)에 레지스트리와 같은 긴 이름의 규칙 `avoid-sqlalchemy-text`를 로컬 파일(`b1a\semgrep\sql_text.yaml`)로 만들어 `app/visit/models.py` 등 models 8개에 돌림 | 주석 전 **2건(163 · 171줄, b7.md와 같은 줄)** → `# nosemgrep: avoid-sqlalchemy-text` 뒤 **0건**, `--error` exit 0 | 레지스트리 규칙 원본(`p/python`)은 내려받지 않아 CI `audit` 일에서 최종 확인 |
| 2026-11-19 | 바뀐 곳 테스트 (입구 순서 · 손님 한도 · 열람 표 · 인증 · 파일 · 보안) | DB `mitjip_test_b1az` · Redis db 13 · `pytest tests/test_v3_contract.py tests/test_v3_schema_misc.py tests/test_guards.py tests/test_auth.py tests/test_files.py tests/security -q` | **168 passed · 0 failed**, 254.72초 | |
| 2026-11-19 | 보안 폴더 (마지막 코드) | 같은 DB · `pytest tests/security -q` | **110 passed · 0 failed**, 127.45초 | |
| 2026-11-19 | 백엔드 린트 (B1a 파일 68개) | `uv run ruff check <B1a 파일>` · `uv run ruff format --check <B1a 파일>` (`b1a\mine.txt`) | **All checks passed!** · **68 files already formatted** | |
| 2026-11-19 | 백엔드 린트 (전체, 지시대로) | `uv run ruff check` · `uv run ruff format --check` | check **7건** · format **10파일** — 모두 B5가 고치는 중인 `app/agent/v3/*` · `app/knowledge/*`. B1a 파일은 0건 | B5 |
| 2026-11-19 | OpenAPI 다시 · `schema.d.ts` 다시 만들기 | `dump_openapi.py` → `pnpm exec openapi-typescript b1a\openapi.json -o lib/backend/schema.d.ts` (frontend), 한 번 더 만들어 견줌 | 연산 153 · 모양 330 · `__` 0 그대로. 되돌린 POST/PATCH `/projects` 몸통은 `ProjectCreate`만 + 머리 `Idempotency-Key`. **9,823줄 → 15,326줄**, 두 번 만든 결과 **바이트까지 같음** | 2단계에 B1a + B1b 합친 API로 다시(리드) |
| 2026-11-19 | 새 타입이 지금 화면 코드를 깨는지 | `git archive HEAD frontend`를 임시 폴더(`frontend/node_modules/.b1a-head`, 끝나고 지움)에 풀고 새 `schema.d.ts`를 넣어 `tsc --noEmit -p .` | **exit 0 · 오류 0**(파일 244개, `Schemas[...]`를 쓰는 파일 39개) | |
| 2026-11-19 | 작업 폴더 그대로 프런트 | `pnpm typecheck` · `pnpm lint` | typecheck **exit 2 · 오류 5**: `.next-b4/types/validator.ts` 2 · `app/admin/members/page.tsx` 1 · `app/admin/vendors/page.tsx` 2 — 다른 묶음이 고치는 중인 `lib/api/admin.ts`(반환 모양 · `ReviewTab`에 `all`)와 B4 개발 서버 생성 파일 때문(바로 위 줄로 B1a 타입 탓이 아님을 확인). 한 번 전(같은 날)에는 `lib/api/vendor.ts` 쪽 오류 10개였다가 그쪽이 고쳐짐. lint **exit 0** | 화면 묶음 (contract.md 7.2) |
| 2026-11-19 | B6가 넘긴 이름 (data-sources.md 맨 위) | `b1a\b6_names.py`(읽기만): `paper_market` · `price_warning` · `vendor_base` · `emd_list` · `is_emd` · `neighbors` · `HOLIDAYS` | 문서와 같음: 실크 10,749 · 합지 4,577 · 판 `paper-market-2026.11`, `price_warning("1206", 2,800,000)` too_high · 300,000 없음 · 26,000 too_low, 1204 단위 '벽지 평', 노원구 법정동 5개 · 상계동 True · 강남구 False, 공휴일 4일 들어 있음 | 1단계 계산에 씀(contract.md 4.8) |
| 2026-11-19 | 9판 C07 합계가 바뀌는 것 (사용자 결정 '평균', 리드 확인) | `b1a\c07_check.py`: 지금 계산 엔진 `calc.dobae.quote`(공급 69.4㎡ · 실크 · 천장 · 빈 집)에서 도배지 줄만 바꿔 셈(파일 안 씀) | 지금 실크 9,500원: 63.0평 → 598,500 · 공급가 1,794,608 · 부가세 179,461 · **합계 1,974,069원**. 시장 평균 10,749원: 677,187 · 1,873,295 · 187,330 · **합계 2,060,625원**(+86,556). B6 `engine_impact.py`와 같은 숫자. **0단계는 계산을 바꾸지 않았어요**(1단계에서 표준견적서 기대값이 2,060,625원이 되는 것은 맞는 변화) | 1단계 B1a |
| 2026-11-19 | 지시한 테스트 명령 그대로 (마지막) | `bash .claude/run-tests.sh b1a tests/ -q -x -p no:cacheprovider` | **모으기에서 멈춤: 1 error, 4.49초**(`test_data_ingest.py` ImportError: `conftest`가 `tests/security/conftest.py`로 잡힘). 처음과 같은 원인 | 리드 (contract.md 8장) |
| 2026-11-19 | 지금 테스트 전부 3회차 (마지막 코드, 리드가 고친 env.sh) | `bash .claude/run-tests.sh b1a tests/ --ignore=tests/security -q -p no:cacheprovider` | **735 passed · 0 failed**, 1,260.67초 | |

## 0단계 마지막 실행 (2026-11-19)

- 백엔드 전체(보안 폴더 빼고): `bash .claude/run-tests.sh b1a tests/ --ignore=tests/security -q -p no:cacheprovider` → **735 passed · 0 failed**(1,260.67초). B1a v3 테스트 57개(계산 14 · jobs 7 · 계약 12 · 제약 24)가 들어 있어요. 지난 Jev 실패 6개는 리드가 env.sh를 고친 뒤 통과해요.
- 보안 폴더 따로: `pytest tests/security -q`(DB `mitjip_test_b1az` · Redis db 13) → **110 passed**(127.45초).
- 지시한 명령 그대로(`tests/ -x`): 모으기 1 error(위 conftest 이름 겹침) → 리드에 부탁.
- alembic: 빈 DB · `mitjip_v3` 모두 head `0032_v3_file_views` 하나, check 차이 없음, 표 62개.
- 린트: B1a 파일 68개 ruff check · format 통과. 전체는 B5 파일만 7건 · 10파일.
- 프런트: HEAD 화면 코드 + 새 `schema.d.ts` tsc 오류 0. 작업 폴더 그대로는 다른 묶음 파일 때문에 오류 5(contract.md 7.2), lint 통과.

## 0단계 못 한 것과 이유

- `pytest tests/`를 보안 폴더와 한 번에: `tests/security/conftest.py` 이름 겹침으로 모으기에서 멈춰요 → `--ignore=tests/security` 전체 + `tests/security` 따로 돌렸어요(리드에 부탁).
- CI: 커밋 · 푸시를 하지 않아 못 봤어요 → 검증 대기. semgrep 레지스트리 규칙 · bandit · pip-audit도 CI `audit` 일에서.
- `pnpm build`: 다른 묶음이 같은 폴더에서 화면을 고치는 중이고 이번 계약은 타입만 바꿔서 돌리지 않았어요 → 검증 대기(리드 합칠 때).
- 새 경로 56개의 동작 테스트(상태 전이 · 409 · 동시 요청): 0단계는 뼈대(501)라 1단계에서 B1a · B1b가 더해요. 0단계는 '모든 새 경로가 맞는 역할에 501 · 로그인 없이 401 · 다른 역할 403'만 확인했어요(`test_v3_contract.py`).

## 1단계 (2026-11-19) — 흐름 동작

B1a 본체가 일을 셋으로 나눠 동시에 맡겼어요(맡은 파일 · 테스트 DB · Redis 번호를 따로). 일꾼 보고는 리드가 옮겨 적었어요: [일꾼 A](b1a-worker-a.md)(계산 엔진 v3 · 표준견적서 · 손님 · 프로젝트 · 단가표 v3 · 실측 견적서) · [일꾼 B](b1a-worker-b.md)(담기 · 실측 일정 전부) · [일꾼 C](b1a-worker-c.md)(jobs · worker · 기한 당기기 · 업체 확정 · 공사 · 작업함). 본체는 migration · main.py · 계약 시험 · contract.md · `schema.d.ts` · 마무리 연결을 맡았어요.

| 날짜 | 무엇 | 명령 · 방법 | 결과 | 남은 일 |
| --- | --- | --- | --- | --- |
| 2026-11-19 | 일꾼 1차 (각자 DB) | A `mitjip_test_b1a_calc`(Redis 7) · B `mitjip_test_b1a_visit`(13) · C `mitjip_test_b1a_work`(12) | A 내 영역 27파일 248 passed · 2 failed / B 전체 `tests/` 1142 passed · 2 failed(1,413.91초) / C 대상 348개 346 passed · 2 failed(1,160.65초). 실패는 모두 `test_v3_contract`의 501 기대(동작하게 된 경로) → 본체가 고침 | |
| 2026-11-19 | 일꾼 2차 (화면 · B1b · B5 부탁) | 같은 DB | A 내 영역 31파일 283 passed · 닿는 곳 10파일 90 passed / B 전체 `tests/` 1210 passed · 1 failed(1,769초, `test_finish` — C가 도중에 고침, 다시 6 passed) / C 15파일 174 passed · 1 failed(같은 `test_finish`, 고친 뒤 6 passed) · 다른 영역 23파일 186 passed | |
| 2026-11-19 | migration 0033 · 0034 · 0035 (빈 DB) | `b1a\mig.sh mitjip_scratch_b1a recreate` → `upgrade head` → `check` → `downgrade 0034_v3_stage1` → `upgrade head` → `check` → `downgrade 0023_reference_simplify` → `upgrade head` → `check` | 모두 통과, check마다 **No new upgrade operations detected**, head 하나 `0035_v3_vendor_stopped` | |
| 2026-11-19 | 개발 DB `mitjip_v3` | `b1a\mig.sh mitjip_v3 upgrade head`(`.claude/env.sh` 셸 + DATABASE_URL만 바꿈) → `check` → `current` | 0033 → 0034 → 0035 통과, **No new upgrade operations detected**, current = `0035_v3_vendor_stopped (head)` | |
| 2026-11-19 | 마무리 연결 테스트 | DB `mitjip_test_b1az` · Redis 13 · `pytest tests/test_v3_vendor_stop.py tests/test_v3_vendor_suspend.py tests/test_v3_contract.py tests/test_v3_admin_members.py -q` | **23 passed**(36.16초) | |
| 2026-11-19 | 백엔드 린트 (전체) | `uv run ruff check` · `uv run ruff format --check` | **All checks passed!** · **388 files already formatted** | |
| 2026-11-19 | 저장소 점검 | `python .github/scripts/check_repo.py` | Repository checks passed | |
| 2026-11-19 | OpenAPI · `schema.d.ts` | `dump_openapi.py`(APP_ENV=local) → `pnpm exec openapi-typescript … -o lib/backend/schema.d.ts` | 연산 **162** · 모양 **339** · 같은 이름 다른 모양 0, **16,195줄**(B7 가입 휴대폰 선택 · B5 `/ai/*` 포함) | |
| 2026-11-19 | 프런트 타입 (작업 폴더 그대로) | `pnpm typecheck` | exit 2 · **오류 40개, 모두 예시 데이터**(`lib/mock/v3a` 4 · `v3b/story.ts` 31 · `v3c` 5): 1단계에 생긴 필수 칸(`done_photos` · `in_standard` · `paper_ok` · `attempt` · `days`)과 바뀐 값(`AfterStepOut.key`에서 visit 빠짐)이 예시에 없어요. 화면 코드 오류는 0 | 예시 파일 주인(B2a · B2b · B3, 리드) |
| 2026-11-19 | 백엔드 전체 (지시한 명령, 한 번에 — 보안 폴더 포함) | `bash .claude/run-tests.sh b1a tests/ -q -p no:cacheprovider` | **1215 passed · 1 failed**(1,517.53초). 실패는 `test_v3_visit_screens.py::test_close_for_vendor_closes_live_requests` — 0035로 일부러 바꾼 값(`reselected` → `vendor_stopped`, 알림 `visit_declined` → `visit_vendor_stopped`)을 옛 기대값으로 봄 → 기대값을 고침 → 그 파일 **10 passed**(67.52초). 코드는 그 뒤 바꾸지 않았어요 | |

### 1단계 마무리에 본체가 한 것

- 업체 멈춤 · 링크(리드 지시 1): report가 `vendor.service.suspend · unsuspend · set_review_link_status`를 불러요(`report/repository.py`의 `suspend` · `unsuspend` · `hide_link` 지움). 멈춤 all은 `visit.service.close_for_vendor`를 대화 닫기(`thread.close_for_vendor`)보다 **먼저** 부르고, commit 뒤 `visit.service.flush_later`로 화면 신호를 보내요. `closed_visits`에 닫은 수가 나와요.
- 0035: `visits.close_reason`에 `vendor_stopped`(칸 12 → 16자) + 고객 알림 kind `visit_vendor_stopped`(지금까지 빌려 쓰던 `reselected` · `visit_declined` 대신). 업체 작업함 글 '업체 기능 멈춤으로 닫힘'.
- `review.service.rating_of`가 `calc.rating.summary`를 써요(업체 카드 · 자세히와 같은 계산).
- `visit_repicked` 예시 글: '고객이 제안한 날 대신 업체 기간에서 다시 고르기로 했어요'(보내는 때와 맞춤).
- `POST /admin/vendors/{id}/links/{sort}`: vendor 501 뼈대를 지우고 report router에 실제 처리(`LinkCheckIn.url` = 관리자가 본 주소, 그사이 바뀌면 409 `stale`, 같은 상태 409 `already`, admin_actions `link_shown · link_hidden`, 업체 알림 `link_checked`).
- 다른 묶음이 부를 함수: `visit.service.close_for_vendor(s, vendor_id, now) -> int` · `visit.service.flush_later(s)` · `vendor.service.suspend(s, vendor_id, scope, at)` · `unsuspend(s, vendor_id)` · `set_review_link_status(s, vendor_id, sort, status, *, by, at, note=None, url=None)` · `calc.rating.summary(total, count, done, tags)`.
- 글 점검(면적 기준): 업체 화면 `area_label`이 '노원구 상계동 · 공급 69.4㎡'처럼 기준을 붙여요(`calc.visit_view.area_label`, 일꾼 B · C).

### 사용자 · 팀 확인 필요

- 부분 공사 공간 몫 표: B6 자료에 없어 일꾼 A가 잠정값(`calc/space_share.py`, 판 `space-share-2026.11`, 공개 평면도 20곳 가운뎃값)을 뒀어요. 9판 C60 그림 638,501원은 지금 엔진 466,065원과 달라요.
- `V2_FALLBACK = True`(visit.service): v3 단가 묶음이 없어도 v2 가견적이 있으면 담을 수 있어요. D06 A를 엄격히 하려면 False.
- 실측 열린 반나절에서 공휴일 자동 제외는 하지 않았어요(D13 보류).

### 1단계 마지막 실행

- 백엔드 전체(`tests/` 한 번에, 1,216개): 1215 passed · 1 failed → 실패한 시험의 기대값(0035 변화)만 고쳐 그 파일 10 passed. 남은 실패 0.
- 501 남은 경로 0개(`app/`에 `not_ready()` 부르는 곳 없음, `tests/test_v3_contract.py`의 `NOT_READY` 빈 집합).
- alembic: 빈 DB · `mitjip_v3` 모두 head `0035_v3_vendor_stopped` 하나, up → down → up · check 차이 없음.
- ruff 전체 통과 · 저장소 점검 통과. 프런트 typecheck는 예시 데이터 40개(화면 코드 0) — 예시 주인 몫.
- 못 한 것: CI(커밋 · 푸시 안 함 → 검증 대기), `pnpm build`(다른 묶음 화면 · 예시 수정 뒤 리드가 합칠 때).

### 화면 합치기 부탁 (B2b, 2026-11-19)

- 상태판 '답 없음' · '고르기 없음' 줄에 지난 기한 시각 `BoardRowOut.expired_due_at`(답 기한 · 고르기 기한, 산 줄은 null). 시험 `tests/test_v3_visit_board_due.py` 3개.
- 알림 글 '동 · 호' → '동 · 호수'(CF-02): 실측 전날 알림 '… · 동 · 호수는 채팅으로 알려 주세요', 알림 목록 설명.
- `schema.d.ts` 다시 만듦(16,200줄), contract.md 10장 한 줄.
