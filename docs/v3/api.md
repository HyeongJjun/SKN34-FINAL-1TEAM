# 믿집 v3 API (개발자)

- 쓴 날: 2026-11-18 · 기준: 지금 API 97개(`research/00-codebase.md`), `data-model.md`, 9판 화면
- 표시: **새로** = 새 엔드포인트, **고침** = 있는 것의 요청 · 응답 · 규칙을 바꿈, 표시 없음 = 지금 그대로
- 화면 쓰기는 모두 브라우저 → 같은 주소 `/api/*`예요. 아래 경로는 `/api`를 뺀 API 경로예요.

## 0. 공통

| 항목 | 규칙 |
| --- | --- |
| 인증 | HttpOnly 세션 쿠키(`mj_sid` / https `__Host-mj_sid`). 권한은 `deps.current_user` · `require_role` |
| 오류 모양 | `{"error": {"code", "message", "fields"?}}`. message는 화면에 그대로 보여도 되는 해요체 |
| 권한 오류 | 로그인 없음 401 `login_required` · 역할이 다름 403 `forbidden` · 남의 것 404 `not_found`(있는지도 알리지 않음) |
| 상태 다툼 | 409: `stale`(다른 곳에서 먼저 바꿈) · `already` · `slots_full` · `slot_taken` · `expired` · `locked` · `read_only` · `paper_unsupported` · `no_estimate` |
| 입력 | 422(칸 오류는 `fields`), 본문 크기 413, 요청 제한 429 + `Retry-After` |
| 멱등 | `Idempotency-Key` 머리(UUID 문자열, S25): `POST /projects`. 몸통의 `client_key`: 채팅 글 · 추가 금액. 같은 키는 처음 결과를 돌려주고, 같은 키가 처리 중이면 409 |
| 상태 바꾸는 요청 | Origin 확인 + SameSite=Lax(지금 그대로) |
| 금액 · 날짜 | 모두 계산 엔진 값. 원 정수 · 서울 날짜(`YYYY-MM-DD`) · 시각(ISO, +09:00). 반나절은 `am` · `pm` |
| 목록 | 커서 방식이 필요한 곳만 `?before=` · `?after_seq=` · `limit`(기본 50, 최대 100) |

## 1. 손님 · 지역 (로그인 없음)

| 메서드 · 경로 | 권한 | 요청 → 응답 | 오류 · 규칙 |
| --- | --- | --- | --- |
| **새로** `POST /guest/standard` | 없음 | `{trade:'dobae', scope:'full'\|'partial', spaces?: kind[], faces?: ('wall'\|'ceiling')[], housing:'apt', sido, sgg, emd, area_m2, area_basis, occupied, grade:'economy'\|'basic', budget_won?, start_date?}` → `{formula_ver, price_ver, share_ver?, lines:[{key, name, qty, unit, unit_price, amount, state, basis, source}], supply, vat, total, days, man_day, budget_fit:'within'\|'over'\|null, assumptions[]}` | IP 해시 분당 20 · 하루 300(429), 본문 4KB(413), 범위 밖 422. DB · 로그에 입력을 남기지 않아요 |
| `GET /regions` | 없음 | 시 · 도 → 시 · 군 · 구 | |
| **새로** `GET /regions/{sido}/{sgg}` | 없음 | 읍면동 목록(B6 자료) | 404 |

## 2. 계정 · 인증

| 메서드 · 경로 | 권한 | 요청 → 응답 | 규칙 |
| --- | --- | --- | --- |
| `POST /auth/signup` · `/auth/login` · `/auth/logout` · `GET /me` · `PATCH /me` | | 지금 그대로 | 가입 · 로그인 뒤 손님 답 옮기기는 화면이 `POST /projects`로 해요 |
| `POST /me/withdraw` | 고객 · 업체 | 지금 그대로 | **고침**: 지우기 전에 내 대화를 read_only(`withdrawn`)로 바꾸고 대화의 고객 칸을 비워요(글 · 이름표는 남김, dev-05) |
| `POST /auth/vendor-signup` | 없음 | 지금 그대로 | |

## 3. 프로젝트 · 표준견적서 · 공정표 (고객)

| 메서드 · 경로 | 요청 → 응답 | 오류 · 상태 변화 |
| --- | --- | --- |
| **고침** `POST /projects` | 머리 `Idempotency-Key`. 몸통 = 1장 손님 계산과 같은 칸 → 201 `ProjectOut` | 같은 키 → 200 같은 공사. `source = guest`(손님 답) · `member` |
| `GET /projects` | 내 공사 목록 + 단계 띠 6칸 + 지금 할 일 + 기한 | **고침**: 업체별 요약(날짜 고를 차례 · 답 기다림 + 기한) |
| `GET /projects/{id}` · **고침** `PATCH /projects/{id}` | v3 칸(범위 · 공간 · 면 · 동 · 예산 · 벽지) | 첫 요청 뒤 409 `locked`(C50) |
| `GET /projects/{id}/overview` | **고침**: 요약 탭(C43) — 지금 할 일 · 실측 뒤 작은 단계 5칸 · 업체 · 서류 | |
| **새로** `GET /projects/{id}/log` | 기록 탭(C63, I2): `[{at, actor:'customer'\|'vendor'\|'mijip', vendor_name?, code, day?, half?, day_to?, amount?}]` 시간 순 | visit_events + deal_events + 견적서 보냄 |
| `GET /projects/{id}/standard` | **고침**: v3 줄(도배지 평 · 시장 평균, 부분이면 `scope · spaces · share_ver`) · `budget_fit` | |
| `GET /projects/{id}/plan` · `POST /projects/{id}/plan` | 예상 · 확정 공정표 | **고침**: 확정 공정표는 공사 날 목록(`work_days`) 기준. 건조 · 청소 칸은 응답에 남기고 화면이 숨겨요(D22 B) |
| `PUT /projects/{id}/checks/{key}` | 공사 전 할 일 | |
| **새로** `GET /projects/{id}/plan.ics` | `text/calendar`(확정 공정표 공사 날, I1) | 확정 전 404 |

## 4. 업체 보기 · 담기 (고객)

| 메서드 · 경로 | 요청 → 응답 | 오류 · 상태 변화 |
| --- | --- | --- |
| **고침** `GET /projects/{id}/vendors?trade=dobae` | `{local:[card], nearby:[card], nearby_sgg[], standard_total, shortlist:{count, left}}`. card = `{vendor_id, name, estimate_total?, vs_standard_pct, rating, review_count, done_count, visit_fee, instant_badge, state:'ok'\|'no_estimate'\|'paper_unsupported'\|'blocked_retry', shortlisted}` | 가견적 낮은 순. 0곳이면 가까운 구(C12) |
| **고침** `GET /projects/{id}/vendors/{vid}?grade=` | 자세히: 가견적 줄 1201~1208(`code, key, name, qty, unit, unit_price, amount, mode`) · 공급가 · 부가세 · 합계 · 사례 · 리뷰 요약 · 외부 리뷰 링크(보여요만) · 사업자 정보. `grade`를 주면 그 벽지로 미리 보기(C11 '합지 −31만 1,850원') | 목록 밖 업체 404 |
| `GET /projects/{id}/vendors/{vid}/photos/{file_id}` | 시공 사진 | |
| **새로** `GET /projects/{id}/vendors/{vid}/reviews?sort=latest\|low&before=` | 리뷰(별점 · 칩 · 글 · 사진 · 지역 사본 · 수정됨 · 답글) + 외부 링크 | 숨긴 리뷰 빠짐 |
| **새로** `GET /projects/{id}/shortlist?trade=` | 담은 업체 · 칸 | |
| **새로** `POST /projects/{id}/shortlist` | `{trade, vendor_id}` → 201 | 409 `already` · `slots_full` · `no_estimate` · `paper_unsupported` · `blocked_retry`(두 번째도 답 없던 업체) · `locked`(확정 뒤) |
| **새로** `DELETE /projects/{id}/shortlist/{vendor_id}?trade=` | 204 | 요청이 살아 있으면 409(요청 취소부터) |

## 5. 실측 일정 — 고객

| 메서드 · 경로 | 요청 → 응답 | 오류 · 상태 변화 |
| --- | --- | --- |
| **새로** `GET /projects/{id}/visits/draft?trade=` | `{wish_start, wish_end, basis_start, vendors:[{vendor_id, name, estimate_total, grade}]}` — 계산 엔진: 시작 희망일 − 28일 ~ − 14일. 희망일이 없으면 기간 null(UC-VIS-01 A2) | AI 초안 카드 · 요청서가 같이 써요 |
| **고침** `POST /projects/{id}/visits` | `{trade, vendor_ids[], wish_start, wish_end, photo_file_ids?[]}` → 201 `{created:[visit], failed:[{vendor_id, code}]}` | 담긴 업체만. 상태: (없음) → requested, 프로젝트 잠금, 가견적 고정, jobs reply_due, 업체 알림. 409 `already` · `stale` |
| **고침** `GET /projects/{id}/visits?trade=` | 상태판(C14 · D03): 요청 머리(보낸 날 · 희망 기간 · 고정 가견적 · 사진) + 업체별 `{visit_id, vendor, status, next:{kind, due_at}, window?, booked?, proposal?, change?, can:{pick, cancel, again, visited}}` | 화면 '지남'은 서버가 계산한 `overdue` |
| **새로** `GET /projects/{id}/visits/{vid}` | 날짜 고르기 화면(C16 · C19 · C21 · C22 · D15~D17): 내 희망 · 업체 기간 · 빼는 날 · 열린 반나절(`[{day, am:bool, pm:bool}]`) · 마감(다른 고객) · 내 다른 실측 · 바로 확정 · 추천 `{day, half, basis}`(계산 엔진, AI가 설명만) · 겹침 없음이면 길 3개 | |
| **새로** `POST /projects/{id}/visits/{vid}/pick` | `{day, half}` → `{status:'booked'\|'picked', hold_until?}` | offered → booked(바로 확정) · picked. 409 `slot_taken`('방금 다른 고객이 골랐어요') · `stale` · `expired` |
| **새로** `POST /projects/{id}/visits/{vid}/proposal/pick` | `{day, half}` → booked | proposed → booked. 409 `slot_taken` |
| **새로** `POST /projects/{id}/visits/{vid}/repick` | → offered | proposed → offered(제안 repicked) |
| **고침** `POST /projects/{id}/visits/{vid}/cancel` | `{code:'changed'\|'other_vendor'\|'late_quote'\|'other', note?}` | requested ~ visited → cancelled · 칸 비움 · 업체 알림 · 대화 읽기만 |
| **새로** `POST /projects/{id}/visits/{vid}/again` | → 201 새 요청(시도 2) | 앞 요청이 expired(reply · pick) · cancelled일 때만. 두 번째 뒤 409 `blocked_retry` |
| **새로** `POST /projects/{id}/visits/{vid}/visited` | `{result:'visited'\|'no_show'}` | booked → visited · no_show. 실측 시각 전 409 |
| **새로** `POST /projects/{id}/visits/{vid}/changes` | `{day, half}`(업체 가능 달력에서) → 201 change | booked에서만, 열린 요청 하나(409 `already`). 시스템 카드 · 업체 알림 · jobs change_due |
| **새로** `POST /projects/{id}/visits/{vid}/changes/{cid}/withdraw` | → withdrawn | |
| **새로** `POST /projects/{id}/visits/{vid}/changes/{cid}/pick` | 업체가 다른 날을 냈을 때 고르기 `{day, half}` | change countered → accepted, 반나절 바꿈 |
| **새로** `POST /projects/{id}/visits/{vid}/requote` | 유효기간 지난 견적서 '다시 받기'(D20) | 업체 알림 |
| **새로** `GET /projects/{id}/visits/{vid}/ics` | 실측 확정 `.ics`(I1, 주소 없음) | 확정 전 404 |
| `POST /projects/{id}/visits/reselect` | 지금 그대로(다시 고르기) | |

## 6. 실측 일정 — 업체

| 메서드 · 경로 | 요청 → 응답 | 오류 · 상태 변화 |
| --- | --- | --- |
| **고침** `GET /vendor/visits?tab=todo\|waiting\|sched\|jobs\|done&sort=due` | 작업함(V03 · D04): 줄 = `{visit_id\|deal_id, received_at, area_label('노원구 상계동 · 69.4㎡'), home('아파트 · 도배 전체 · 빈 집'), wish, estimate_total, budget_won, state:{icon:'todo'\|'wait'\|'ok'\|'done'\|'late', label}, next:{label, due_at}}` | 고객 이름 · 연락처 없음. 탭 '일정' 새로 |
| **고침** `GET /vendor/visits/summary` | 탭별 수(할 일 · 기다림 · 일정 · 공사 · 끝남) | |
| **고침** `GET /vendor/visits/{vid}` | 기간 답하기(V04 · D14): 요청 내용 · 사진 · 예산 · 가견적 · 내 달력(잡힌 반나절 · 잡아 둠 · 다른 요청 기간) · 열린 반나절 세기 | 남의 요청 404 |
| **새로** `POST /vendor/visits/{vid}/window` | `{start, end, excluded[], instant}` → `{open_halves}` | requested → offered. 기한 지남 409 `expired` · 고객이 취소함 409 `stale`. 고객 알림 '날짜를 골라 주세요' |
| **고침** `POST /vendor/visits/{vid}/decline` | `{code:'full'\|'out_of_area'\|'other', note?}` | requested → declined · 칸 비움 |
| **새로** `POST /vendor/visits/{vid}/accept` | → booked | picked → booked. 잡아 둔 기한 지남 409 `expired` |
| **새로** `POST /vendor/visits/{vid}/propose` | `{reason_code, note?, slots:[{day, half}] 1~3}` | picked → proposed. 희망 기간 밖 422 |
| **새로** `POST /vendor/visits/{vid}/changes/{cid}/accept` | → 반나절 바꿈 | change open → accepted. 그 반나절이 차 있으면 409 `slot_taken` |
| **새로** `POST /vendor/visits/{vid}/changes/{cid}/propose` | `{slots 1~3}` | change open → countered + 제안 |
| `POST /vendor/visits/{vid}/seen` | '새 요청' 지움 | |
| **새로** `GET /vendor/schedule?from&to` | 일정 탭(V08): 반나절별 확정 · 잡아 둠 + 지역 · 면적 | |
| `GET · PUT /vendor/visits/{vid}/quote` · `POST …/quote/send` | 실측 견적서(V10) | **고침**: 칩 4칸(`incl_removal · incl_waste · paper_spec · warranty_months`), 기한 표시(실측 + 3일 18:00). booked · visited에서 보내면 quoted |

## 7. 채팅 (`thread`, 고객 · 업체 같은 길)

| 메서드 · 경로 | 요청 → 응답 | 오류 · 규칙 |
| --- | --- | --- |
| **새로** `GET /threads` | `[{thread_id, title(고객: 업체 상호 / 업체: '상계동 고객'), visit_label('실측 12.15(화) 오전'), last:{kind, preview, at}, unread, status}]` 최근 순 | 내 대화만 |
| **새로** `GET /threads/{tid}` | 머리: 상대 이름표 · 공사 요약(area_label) · `visit_id` · `deal_id?` · `status` · `can:{write, change_request, cancel, report}` · 링크(견적서 보기 · 공사 보기) | 남의 대화 404 |
| **새로** `GET /threads/{tid}/messages?after_seq=&before_seq=&limit=` | `[{seq, id, from:'me'\|'them'\|'system', kind, body?, file_id?, system_code?, ref_id?, warn?, at}]` | 고객 화면에만 `warn` |
| **새로** `POST /threads/{tid}/messages` | `{client_key, kind:'text'\|'photo', body?, file_id?}` → 201 글(같은 키면 200 같은 글) | read_only 409 `read_only` · 막힘 403 · 1,000자 넘으면 422. 상대에게 `msg` 이벤트 |
| **새로** `POST /threads/{tid}/read` | `{seq}` → 204 | 줄지 않음(greatest). 내 다른 기기에 `read` 이벤트 |
| **새로** `GET /threads/{tid}/files/{file_id}` | 사진(두 사람만) | 404 |
| **새로** `POST /threads/{tid}/block` · `DELETE /threads/{tid}/block` | 고객이 업체 차단 · 풀기(C31) | read_only(blocked) ⇄ open |

- 빠른 답('도착 전에 연락 주세요' 등)은 화면 상수예요(API 없음). '+ 메뉴'는 사진 · 실측 일정 두 가지예요(C26).

## 8. 실시간 스트림

| 메서드 · 경로 | 응답 | 규칙 |
| --- | --- | --- |
| **새로** `GET /stream` | `text/event-stream`. 처음 `event: ready`, 이어서 `msg` · `read` · `notif` · `state` · `resync`. `id:` = 줄기 id, 15초 `: ping`, `retry: 5000` | 로그인 필요(401이면 브라우저가 다시 잇지 않아요). `Last-Event-ID`부터 이어 보내요. 사용자마다 동시 5줄기. 60초마다 세션 다시 확인. 머리 `Cache-Control: no-cache, no-transform` |

이벤트 몸통(모두 JSON, 개인정보 없음):

```
msg    {"thread_id": "…", "seq": 12}
read   {"thread_id": "…", "seq": 12}
notif  {"unread": 3}
state  {"kind": "visit|deal|quote|extra|review|vendor_app", "project_id": "…"|null, "id": "…"}
resync {}
```

## 9. 알림 (지금 그대로 + 실시간)

- `GET /notifications` · `GET /notifications/unread` · `POST /notifications/{nid}/read` · `POST /notifications/read-all`.
- 알림을 쓰면 그 사람에게 `notif {unread}`가 가요. 알림 `link`는 `routes.md`의 v3 경로를 써요(예: `/projects/{id}/visits/{vid}`, `/vendor/requests/{vid}`, `/chat/{tid}`).

## 10. 실측 견적서 비교 · 확정 (고객)

| 메서드 · 경로 | 요청 → 응답 | 규칙 |
| --- | --- | --- |
| **고침** `GET /projects/{id}/quotes?trade=` | 비교(C33 · D18): 업체별 합계 · 업체가 적은 금액 · 가견적과 차이 · 공사 기간 · 칩 4개 · 유효기간(+지남) · 실측일 · 받은 날 · 리뷰 · 파일 | 금액 차이는 계산 엔진 |
| **고침** `POST /projects/{id}/quotes/{visit_id}/confirm` | `{seen_ver}` | 유효기간 지남 409 `expired`(D20). quoted → chosen, 다른 요청 closed, 다른 대화 read_only(other_chosen) |
| `GET /projects/{id}/quotes/{quote_id}/files/{file_id}` | 지금 그대로 | |
| `POST /projects/{id}/deals/{did}/reselect` · `GET /projects/{id}/deals` | 지금 그대로 | |

## 11. 공사 (고객 · 업체)

| 메서드 · 경로 | 요청 → 응답 | 규칙 |
| --- | --- | --- |
| `GET /projects/{id}/schedule` | 공사 날짜 · 추가 금액 · 공사 끝(C35 · C37 · C38) | **고침**: 날 목록 · 추가 금액 판 · 자동 끝 날짜 |
| `POST /projects/{id}/deals/{did}/dates/{pid}/accept` | 지금 그대로 | 확정 공정표 새 판 |
| **고침** `POST /projects/{id}/deals/{did}/date-requests` | `{reason, wish_dates 1~3}` | 업체 기한 = 요청 + 48시간(지금 다음 날 18:00에서 바꿈), 2번까지 |
| **고침** `POST /projects/{id}/deals/{did}/extras/{eid}/answer` | `{answer:'approve'\|'reject'\|'ask'}`(지금 `/ack` 대신) | 최신 판만. ask면 채팅에 시스템 카드 |
| **고침** `POST /projects/{id}/deals/{did}/check` | `{result:'ok'\|'fix', note?}` | checking → done · fixing. done이면 리뷰 쓰기 열림 |
| **고침** `GET /vendor/jobs/{did}` | 공사 한 건(V23): 상태 · 날 · 견적서 판 · 추가 금액 · 연락 메모 · 기록 | |
| **고침** `POST /vendor/jobs/{did}/dates` | `{days:[date], crew}` | 날 수 = 견적서 공사 기간 · 공휴일 · 겹침은 계산 엔진(422) |
| `GET /vendor/jobs/{did}/dates/preview` | **고침**: 날 목록 미리 보기 | |
| **고침** `POST /vendor/jobs/{did}/extras` | `{client_key, title, reason, amount, vat_mode, photo_file_ids?, replaces?}` | `replaces`(앞 판 id)면 새 판 · 앞 판 superseded |
| **고침** `POST /vendor/jobs/{did}/done` | `{done_on, note?, photo_file_ids?}` | → checking, jobs `deal_done_remind`(+4일) · `deal_auto_done`(+7일) |
| **새로** `GET /vendor/jobs/{did}/log` | 기록(V23) | |

## 12. 리뷰

| 메서드 · 경로 | 권한 | 요청 → 응답 | 규칙 |
| --- | --- | --- | --- |
| **새로** `POST /projects/{id}/deals/{did}/review` | 고객(그 공사) | `{rating 1~5, tags[], body?, photo_file_ids?[]}` → 201 | done이 아니면 403, 두 번째 409 `already`. 업체 알림 |
| **새로** `PATCH /reviews/{rid}` · `DELETE /reviews/{rid}` | 쓴 고객 | 고치기 → `edited_at`('수정됨') · 지우기 | |
| **새로** `GET /vendor/reviews?filter=waiting\|all` | 업체 | 내 리뷰 + 답글 · 답글 기다림 수(V24) | |
| **새로** `PUT /vendor/reviews/{rid}/reply` | 업체(그 리뷰) | `{body}` → 처음이면 201 · 고치면 200 | 처음 달 때 고객 알림(I4) |

## 13. 신고 · 관리자

| 메서드 · 경로 | 권한 | 요청 → 응답 | 규칙 |
| --- | --- | --- | --- |
| **새로** `POST /reports` | 고객 · 업체 | `{kind:'chat'\|'vendor'\|'link', thread_id?, message_id?, vendor_id?, link_sort?, reason_code, note?, block?}` → 201 | 대상이 내 대화 · 볼 수 있는 업체인지 확인. 채팅이면 글 사본 남김. `block`이면 대화 read_only(blocked) |
| **새로** `GET /admin/reports?status=open\|done&kind=` · `GET /admin/reports/{id}` | 관리자 | A02 목록 · 자세히(신고된 글은 데이터로만, 차단 여부) | |
| **새로** `POST /admin/reports/{id}/resolve` | 관리자 | `{action:'warn'\|'mute_chat'\|'suspend_new'\|'suspend_all'\|'hide_link'\|'none', note?}` | open → resolved · dismissed(none). 업체 멈춤 · 쓰기 막기 실행 · `admin_actions` · 신고한 사람 알림 · 상대 알림. suspend_all이면 진행 중 요청 닫고 고객에게 다시 고르기 안내 |
| `GET /admin/vendors` · `GET /admin/vendors/summary` · `GET /admin/vendors/{id}` | 관리자 | 지금 그대로 | **고침**: 외부 리뷰 링크 · 같은 상호 · 등록번호 · 대표자 표시 |
| **고침** `POST /admin/vendors/{id}/review` | 관리자 | `{decision, code?, note?}` | 거절 사유 `info_mismatch` 더함(A04) |
| **새로** `POST /admin/vendors/{id}/links/{sort}` | 관리자 | `{status:'shown'\|'hidden', note?}` | `admin_actions` |
| **새로** `POST /admin/vendors/{id}/suspend` · `/unsuspend` | 관리자 | `{scope:'new'\|'all', note}` | 신고 없이도 멈출 때 |
| **새로** `GET /admin/members?q=&status=` | 관리자 | 이름 · 이메일 · 가입일 · 공사 수 · 상태(A03, 지금 화면은 예시 데이터) | 이메일 일부 가림은 B7 결정 |
| **새로** `POST /admin/members/{uid}/suspend` · `/unsuspend` | 관리자 | `{note?}` | users active ⇄ suspended, 세션 지움 |
| **새로** `POST /admin/reviews/{rid}/hide` · `/show` | 관리자 | `{code}` | 공개한 기준 코드만 |

## 14. 업체 정보 · 단가 · 링크 (업체)

| 메서드 · 경로 | 요청 → 응답 | 규칙 |
| --- | --- | --- |
| `GET · PUT /vendor/profile` | **고침**: `instant_default` 더함 · 지역 칩 | 연락 방법 칸은 팀 확인 11 결과를 따라요 |
| `POST /vendor/portfolio` · `DELETE /vendor/portfolio/{id}` | **고침**: 공간 · 벽지 · ㎡ · 찍은 때(V16) | 20장 |
| **고침** `GET /vendor/prices?trade=dobae` | v3 줄 1201~1208 `{code, key, name, unit, mode, unit_price?, included_in?, example_qty, example_amount, warn?:'too_high'\|'too_low'}` + 예시 집 가견적(부가세 포함) + 지금 판 | 옛 v2 묶음만 있으면 빈 v3 표 + 안내 |
| **고침** `POST /vendor/prices/{trade}/confirm` | `{base_version, lines:[{key, mode, unit_price?, included_in?}]}` → 새 확인 묶음 | '확인하고 저장' 하나로(D02). 본 판 + 1이 아니면 409 `stale`. 빈 단가 422(`fields`). 10배 경고는 저장됨 |
| `PUT /vendor/prices/{trade}` | 임시 저장(지금 그대로, 화면에서 안 써도 둠) | |
| `POST · DELETE /vendor/price-files` | 지금 그대로 | |
| **새로** `GET · PUT /vendor/review-links` | `[{sort, label, url}]` 3개까지 → 바뀐 링크는 확인 중으로 | |
| `GET /vendor/application` · `POST …/resubmit` · `POST …/reapply` | 지금 그대로(V14 · V22) | |

## 15. 파일

- `POST /files`(multipart `file` + `kind`): **고침** kind에 `chat_photo` · `review_photo` · `done_photo`. 사진은 위치 정보를 지운 새 그림만 저장(지금 그대로). 한도는 B7(`request_guards.LIMITS`).
- `GET /files/{id}`: 올린 사람 · 관리자(지금 그대로). 기능별 내주기는 각 기능 경로(채팅 · 리뷰 · 공사)에서 권한을 본 뒤예요.

## 16. AI (B5가 자세히 정함 — `agents.md`)

| 메서드 · 경로 | 권한 | 요청 → 응답 |
| --- | --- | --- |
| **새로** `POST /ai/turns` | 고객 | `{client_key, text, context:{screen:'standard'\|'vendors'\|'vendor'\|'visits'\|'pick'\|'quotes'\|'plan', project_id?, ids?}}` → SSE(`event: token` · `card` · `done` · `error`). 카드 = `{kind:'calc'\|'visit_draft'\|'open_calendar'\|'grade_preview'\|'faq', …}` |
| **새로** `GET /ai/threads?project_id=` | 고객 | 같은 공사 AI 대화(F7 A) |

- 사진(#181 2단계): `POST /ai/turns`에 `file_ids`(먼저 `POST /files` kind=`photo`로 올린 내 사진, 3장까지)를 붙이면 답의 `photo`에 사진에서 본 것이 와요. 설계는 [agent-09](adr/agent-09-photo.md).
- 사용자 · 프로젝트는 세션으로 고정, 카드의 숫자는 계산 엔진 값, AI는 쓰기 · 확정을 하지 않아요. 지금 `/v2/ask*`는 v3 화면이 옮겨 가면 지워요(B5).

## 17. 바뀌는 지금 엔드포인트 요약

| 지금 | v3 |
| --- | --- |
| `POST /projects/{id}/visits`(담기 = 요청, 연락처 동의) | 담기는 `/shortlist`, 요청은 희망 기간 · 사진만. 연락처 동의 칸 없앰 |
| `POST /projects/{id}/deals/{did}/extras/{eid}/ack`(ok · talk) | `…/answer`(approve · reject · ask) |
| `POST /vendor/jobs/{did}/dates`(start · end) | `days[]` |
| `POST /vendor/prices/{trade}/confirm`(draft 확인) | 몸통에 줄 + 본 판(한 번에) |
| `/v2/ask` · `/v2/ask/{turn}` | `/ai/turns`(B5) |
| 업체 연락처 공개(`contact_visible` · `contact`) | 응답에서 뺌(채팅으로) |
