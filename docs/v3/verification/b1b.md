# B1b 백엔드 채팅 · 실시간 · 리뷰 · 신고 · 관리자 검증 기록

- 날짜: 2026-11-19 · 쓴 역할: B1b(개발자) · 폴더: `C:\Workspace\SKN34\wt-v3`(커밋 · 푸시 안 함)
- 실제로 돌린 것만 적어요. 테스트는 `bash .claude/run-tests.sh b1b …`(DB `mitjip_test_b1b` · Redis db 2 · `LLM_LIVE=false`)로 돌렸어요. 유료 API 0회, `.env`는 열지 않았어요(`.claude/env.sh`로만 불러옴).
- 스크래치: `C:\Users\lsm15\AppData\Local\Temp\claude\9fde9263e2ae7b10\4f9af5b4-65b7-4ec0-9f70-41add44e991c\scratchpad\b1b\`(아래 `b1b\`) — `dump_openapi.py` · `openapi.json` · `schema.before.d.ts` · `final_main.log` · `final_related.log`
- migration은 더하지 않았어요(B1a의 0028 · 0029 표 그대로 씀). `main.py` ROUTERS에는 B1a가 이미 `realtime` · `report` · `review` · `thread`를 넣어 두었어요.

## 1. 만든 것

| 영역 | 파일 | 한 것 |
| --- | --- | --- |
| 채팅 | `app/thread/{service,repository,router,rules}.py` | 목록 · 머리 · 글(쪽 나누기) · 보내기 · 읽음 · 사진 · 차단 · 풀기. seq는 대화 행 UPDATE 잠금 아래에서만 +1, `client_key` UNIQUE로 같은 글 한 번(동시에 와도 200 같은 글). 주의 줄(업체 글 → 고객 화면만 `warn`) · 동 · 호 꼴(`address_sent_at`) 규칙은 `rules.py` 순수 함수. 계약 함수 `open`은 고객이 차단한 대화(`blocked_at`)도 다시 열지 않게 했고, `notify_message` · `close_for_user` · `mute_vendor` · `close_for_vendor` · `reopen_for_vendor` · `push_parties` · `redact`(L07이라 지금은 아무것도 안 함)를 더했어요 |
| 실시간 | `app/realtime/{service,router}.py` | `GET /stream`: 줄기마다 Redis 연결 따로(`client_name=mj-stream`) · 연결 때 마지막 id를 잡아 XREAD BLOCK · `Last-Event-ID`부터 이어 보냄 · 꼴이 틀림 · 7일보다 오래됨 · 그 뒤가 잘림(`max-deleted-entry-id`) · 줄기가 지워짐이면 `resync` · 15초 `: ping` · `retry: 5000` · 60초마다 세션 · 정지 다시 확인 + `keep_slot` · 30분마다 끝냄(브라우저가 이어 받음) · B7 `take_slot`(6번째 429) · `free_slot`. 머리 `Cache-Control: no-cache, no-transform` · `X-Accel-Buffering: no` |
| 리뷰 | `app/review/{service,repository,router}.py` | 쓰기(끝난 공사만 403 · 두 번째 409 · 하루 5) · 고치기('수정됨') · 지우기 · 업체 목록 · 답글(I4, 처음 201 + 고객 알림) · 고객 목록(숨김 빠짐 · 별점 · 링크 '보여요'만) · **새 경로** `GET /reviews/{rid}/photos/{fid}` |
| 신고 · 관리자 | `app/report/{service,repository,router}.py` | 신고(대상 확인 · 글 사본 · 차단 · 같은 글 처리 전 한 번 · 하루 10) · 관리자 목록(처리 기다림 · 처리함 · 종류 수) · 자세히(이름 없는 `reporter_label` · `link_label` · `link_url`, B3 부탁) · 처리(경고 · 쓰기 막기 · 업체 멈춤 new/all · 링크 숨김 · 문제없음) · 회원 목록 · 정지 · 풀기 · 업체 멈춤 · 풀기 · 리뷰 숨김 · 보이기. 처리마다 `admin_actions` |
| 계정 | `app/account/{service,repository}.py` | 탈퇴 전에 내 대화를 읽기만(`withdrawn`), 상대 화면에 state. 관리자 회원 상태 바꾸기(정지하면 세션 모두 지움) |
| 테스트 | `tests/test_v3_thread_api.py`(11) · `test_v3_thread_rules.py`(38) · `test_v3_realtime_stream.py`(7) · `test_v3_review_api.py`(5) · `test_v3_report_api.py`(6) · `test_v3_admin_members.py`(4) | **71개**. 준비 데이터는 바뀌는 중인 실측 흐름(B1a)에 기대지 않게 가입 · 승인 API + SQL 행 + `thread.service.open`으로 만들어요 |

- service · repository · router · 규칙 2,889줄(B1a가 0단계에 쓴 thread 계약 함수 · 지금 탈퇴 코드 포함, models · schemas 754줄은 뺌) · 테스트 1,464줄.

## 2. 돌린 것과 결과

| 날짜 | 무엇 | 명령 · 방법 | 결과 | 남은 일 |
| --- | --- | --- | --- | --- |
| 2026-11-19 | 채팅 규칙 · API | `bash .claude/run-tests.sh b1b tests/test_v3_thread_rules.py tests/test_v3_thread_api.py -q` | **48 passed** (60초). 그 뒤 `redact` 시험을 더해 49 | |
| 2026-11-19 | 줄기 첫 실행 | `… tests/test_v3_realtime_stream.py -q` | **3 failed · 4 passed**. ① 테스트가 `Reader(r)`를 버리면 줄 읽개가 응답을 닫아 줄기가 끝남(테스트 잘못 — 줄기마다 Reader 하나로 고침) ② **코드 잘못**: 읽지 않는 연결을 닫으면 취소가 Starlette `send`에서 나서 생성기가 `yield`에 멈춘 채 남고 `finally`(자리 비우기 · Redis 연결 닫기)가 안 돌았어요 → `ClosingStream`(끝나면 생성기를 꼭 `aclose()`)으로 고침 | |
| 2026-11-19 | 줄기 다시 | 같은 명령 | **7 passed** (29초): 401 · 머리 · `ready`(id `0-0`) · 줄기가 열려 있는 동안 DB `idle in transaction` 0 · 두 연결 모두 `msg` · 남의 대화 글은 안 옴 · 읽음은 내 다른 기기에 · 끊고 다시 잇기(놓친 seq 3 · 4) · resync 4가지 · 6번째 429 · 닫으면 Redis 연결 0 · 자리 0 · 로그아웃 · 정지 뒤 4초 안에 닫힘 · 최대 길이 | |
| 2026-11-19 | 리뷰 · 신고 · 관리자 | `… tests/test_v3_review_api.py` · `… tests/test_v3_report_api.py` · `… tests/test_v3_admin_members.py` | **5 passed** · 첫 실행 **2 failed**(목록 수 SQL: `GROUP BY status IN (…)`의 값 자리가 둘로 갈려 PostgreSQL 거절 → 상태별로 세어 더함) → **5 passed** · **4 passed**. 하루 한도 시험을 더해 신고 6 | |
| 2026-11-19 | 동시 시험 | `test_two_posts_at_once_have_no_gap_and_same_key_is_one_message`(service를 두 세션으로 `asyncio.gather`) | 첫 실행 실패(`MissingGreenlet`: rollback이 세션 객체를 모두 만료시켜 `user.id`를 다시 읽음) → 값을 먼저 잡아 두게 고침(채팅 보내기 · 답글) → **통과**: 세 글 동시 seq 2 · 3 · 4, 같은 키 둘 → 글 1개(하나 201 · 하나 200), seq 1~5 빈틈 없음 | |
| 2026-11-19 | 리드가 준 명령 | `bash .claude/run-tests.sh b1b tests/test_v3_thread_*.py tests/test_v3_realtime_*.py tests/test_v3_review_*.py tests/test_v3_report_*.py tests/test_v3_admin_*.py tests/security -q` | **179 passed** (128초, redact · 신고 한도 시험 더하기 전) | 마지막 실행은 아래 |
| 2026-11-19 | 관련된 지금 테스트 | `… tests/test_account.py tests/test_auth.py tests/test_files.py tests/test_guards.py tests/test_v3_schema_misc.py tests/test_v3_contract.py -q` | **60 passed · 2 failed**. 실패 2개는 B1a 0단계 계약 시험(`test_new_routes_answer_not_ready_for_their_role` · `test_guest_routes_count_ip_limit`)이 B1a의 `/guest/standard`가 이제 200이라 깨진 것(첫 줄에서 멈춰 B1b 경로까지 안 감). **권한 시험 `test_new_routes_need_login_and_the_right_role`은 통과** — B1b 경로도 401 · 403 그대로 | 부탁 1 |
| 2026-11-19 | 업체 · 알림 테스트 | `… tests/test_vendor_review.py tests/test_v3_vendor_review_links.py tests/test_notify.py tests/test_vendor.py -q` | **35 passed** | |
| 2026-11-19 | **마지막: 리드가 준 명령** (redact · 신고 한도 시험 포함) | 위와 같은 명령 → `b1b\final_main.log` | **181 passed · 0 failed** (205초) = B1b 71 + 보안 110 | |
| 2026-11-19 | **마지막: 관련된 지금 테스트** | `… tests/test_account.py tests/test_auth.py tests/test_files.py tests/test_guards.py tests/test_notify.py tests/test_vendor.py tests/test_vendor_review.py tests/test_v3_schema_misc.py tests/test_v3_contract.py tests/test_v3_jobs_sweep.py tests/test_v3_visit_flow.py tests/test_v3_visit_changes.py tests/test_v3_work_deal.py tests/test_v3_vendor_review_links.py -q` → `b1b\final_related.log` | **128 passed · 2 failed** (418초). 실패 2개는 위와 같은 B1a 0단계 계약 시험(첫 실패가 `POST /guest/standard` 200). B1a 실측 · 공사 · jobs 시험(대화 열기 · 시스템 카드 · `thread_redact` 일)은 모두 통과 | 부탁 1 |
| 2026-11-19 | 린트 | `uv run ruff check` · `ruff format --check` (B1b 패키지 5개 + 테스트 6개) | **All checks passed!** · **33 files already formatted** | |
| 2026-11-19 | OpenAPI · 화면 타입 | `PYTHONPATH=. uv run python b1b\dump_openapi.py b1b\openapi.json` → `pnpm exec openapi-typescript … -o lib/backend/schema.d.ts` | 연산 **156** · 모양 **330** · `__` 0. `schema.d.ts` 다시 만듦(15,336 → 15,561줄, 작업 폴더 API 그대로라 B1a가 바꾸는 중인 칸도 들어감) | contract.md 10 · 11장에 한 줄씩 |
| 2026-11-19 | 화면 타입 검사 | `pnpm typecheck` | **실패 9건**: B1b 탓은 1건 — `lib/mock/v3c/admin.ts`(B3 예시)에 새 칸 `link_label` · `link_url`이 없음(B3가 부탁한 칸, `reporter_label`은 이미 있음). 나머지 8건은 B1a 새 칸(`done_photos` · `in_standard` · `paper_ok` · `work_days` · 기록 kind `visit`) | 부탁 5 |

- 첫 실행들 사이에 다른 묶음 파일이 고치는 중이라 앱을 못 불러온 때가 세 번 있었어요(`project/router.py` `ProjectCreate` · `vendor/service.py` `PricesV3Out` · `quote/service.py` `Money`, 모두 B1a). 그 파일은 고치지 않고 다시 불러올 수 있을 때 돌렸어요.

## 3. 정한 것 (이 묶음 안)

- **줄기는 `get_session`을 쓰지 않아요.** FastAPI의 yield 의존성은 응답이 끝날 때 닫혀서, 로그인 확인에 쓴 DB 연결을 줄기가 열려 있는 내내(최대 30분) 쥐어요(프로세스당 10개). 짧은 세션으로 확인하고 닫아요(시험: `idle in transaction` 0).
- **업체 쪽 응답**: 고객 이름 · 휴대폰 · 이메일 칸이 없어요(대화 '상계동 고객', 리뷰 '고객', 탈퇴는 '탈퇴한 고객'). 고객이 채팅에 직접 쓴 동 · 호 · 번호는 그대로 보여요(D05 A). 고객 화면 리뷰 쓴 사람은 '김○○'.
- **차단**: `blocked_at`은 고객의 차단 표시, `status`/`ro_reason`은 대화 상태예요. 열린 대화를 차단하면 읽기만(blocked), 이미 다른 사유로 닫혔으면 사유는 그대로. 풀면 차단 때문에 닫힌 대화만 열려요. 차단한 대화는 실측이 다시 확정돼도(`open`) 안 열려요.
- **업체 멈춤**: new는 vendors 칸만(새 요청 막기는 B1a 목록 · 요청이 이미 봐요). all은 그 업체의 열린 대화를 읽기만(admin)으로 닫고, 풀면 admin으로 닫은 대화만 다시 열어요(고객이 차단한 것은 그대로). new → all 넓히기는 되고, 같은 것 두 번은 409.
- **신고**: 업체 · 링크 신고는 고객만, 채팅 신고는 둘 다(차단은 고객만). 업체가 낸 채팅 신고에는 대상 업체가 없어 업체 조치는 422(문제없음만). 링크 신고는 그때 주소를 `evidence`에 사본으로 남겨요.
- **별점**: 숨김 빼고 평균을 `calc.common.m2`(소수 한 자리 반올림)로, 믿집 공사 수 = 끝난(done) 공사.
- **층**: 관리자 리뷰 숨김 · 보이기는 `admin_actions`와 같은 트랜잭션이라 report가 review를 불러요(`report → review`). 채팅 사진 확인 · 보내기 때문에 `thread → files`. 대화 머리 · 목록의 실측 날짜 · 단추 · 링크는 visit · schedule 표를 읽기 조인으로만 봐요.
- **남의 표에 쓰는 곳 (주인 함수가 생기면 바꿈)**: `report/repository.py`가 `vendors.suspended_at · suspend_scope` · `vendor_review_links.status`를, `account/repository.py`가 `users.status` · `user_sessions`를 바꿔요. 맡은 파일 밖을 고치지 않으려고 그렇게 했어요(부탁 3 · 6).

## 4. 부탁

| 누구 | 부탁 | 이유 |
| --- | --- | --- |
| 1 B1a · 리드 | `tests/test_v3_contract.py` ROUTES에서 B1b 경로(채팅 9 · `/stream` · 신고 · 관리자 · 리뷰 · 업체 멈춤)를 빼 주세요(contract.md 11장에 옮겨 적었어요) | 이제 501이 아니에요. `/stream`은 테스트에서 2초 뒤 끝나서 그 시험이 멈추지는 않아요 |
| 2 B1a | `vendor/router.py`의 `POST /admin/vendors/{vendor_id}/suspend` · `/unsuspend` 뼈대 두 개를 지워 주세요 | report router가 먼저 등록돼 요청은 B1b로 와요. 그런데 OpenAPI 문서에는 뒤에 등록된 뼈대(요약 '0단계 뼈대')가 보여요 |
| 3 B1a | `visit.service.close_for_vendor(s, vendor_id, now) -> int`(진행 중 실측 닫기 + 고객 '다시 고르기' 알림, 부르는 쪽 트랜잭션 안)를 만들어 주시면 `report.service._suspend`(scope all)에서 대화 닫기 **앞에** 불러 `closed_visits`로 돌려줄게요. 함께 `vendor.service`에 멈춤 칸 · 링크 상태를 바꾸는 함수를 주시면 report가 그것을 불러요 | 지금 all은 대화만 닫고 `closed_visits = 0`이에요 |
| 4 B1a | 시스템 카드(`post_system`)를 넣고 commit한 뒤 `thread.service.notify_message(s, thread_id, seq)`를 불러 주세요 | 열린 채팅 화면이 새 카드를 바로 받아요(두 사람 줄기에 `msg`) |
| 5 B3 | `lib/mock/v3c/admin.ts` 신고 자세히 예시에 `link_label` · `link_url`(링크 신고가 아니면 null)을 더해 주세요 | 부탁하신 칸이 응답에 생겼어요(`reporter_label`은 '수유동 고객' 꼴) |
| 6 리드 · B7 | 원하시면 `auth.service`에 `set_status(s, user_id, status)` · `delete_sessions(s, user_id)`를 두면 account가 그것을 불러요 | 지금은 account/repository가 auth 표를 바로 바꿔요 |
| 7 B2 | 줄기: 탭마다 `EventSource('/api/stream')` 하나. `resync`를 받으면 그 화면을 모두 다시 읽어요. 30분마다 서버가 끝내도 브라우저가 `Last-Event-ID`로 이어 받아 놓치지 않아요(401이면 다시 잇지 않음). 사진은 채팅 `GET /threads/{tid}/files/{fid}` · 리뷰 `GET /reviews/{rid}/photos/{fid}` | |
| 8 B1a | 업체 카드 · 자세히의 별점은 review를 부를 수 없으니(층) `review.models.Review`를 읽기 조인해 같은 규칙(숨김 빼고 · `calc.common.m2` · 끝난 공사 수)으로 세어 주세요. 계산 엔진에 별점 함수를 두면 review도 그것으로 바꿀게요 | 두 곳 숫자가 같게 |
| 9 리드 | `architecture.md` 층 그림에 `report → review` · `thread → files`를 반영해 주세요 | 3장 '층' |

## 5. 못 한 것과 이유

| 무엇 | 이유 | 다음 |
| --- | --- | --- |
| 업체 멈춤(all) 때 진행 중 실측 닫기 · 고객 다시 고르기 안내 | 실측 상태는 visit 기능 몫이에요 | 부탁 3 |
| 멈춤 풀기 알림 | 알림 목록(`notify/catalog.py`)에 kind가 없어요 | 필요하면 kind를 더해요 |
| 스테이징에서 Cloudflare → Caddy를 지나 2분 넘게 열어 두기(dev-02 검증 4) | 배포 안 함 | 스테이징 배포 때 |
| 백엔드 전체 테스트 | 다른 묶음이 동시에 고치는 중이라 관련 테스트만 돌렸어요 | 리드가 합친 뒤 |
| CI | 커밋 · 푸시를 하지 않았어요 | 검증 대기 |
