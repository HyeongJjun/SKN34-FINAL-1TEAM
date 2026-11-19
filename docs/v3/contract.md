# 믿집 v3 0단계 계약 (B1a 백엔드 흐름)

- 쓴 날: 2026-11-18(고친 날 2026-11-19: POST /projects 몸통 되돌리기 · B7 부탁 반영, 7.1) · 쓴 역할: B1a(개발자) · 기준: `plan-build.md` 5장, `data-model.md`, `api.md`, `decisions-lead.md`(L02 · L03 · L04 · L09 · L10)
- 이 문서는 **모양(계약)**이에요. 새 경로는 지금 `501 {"error":{"code":"not_ready","message":"아직 준비 중이에요."}}`를 돌려주고, 1단계에서 B1a · B1b가 동작을 채워요. 실제로 돌린 검증은 `verification/b1a.md`에 있어요.
- 한눈에: migration **8개**(0024~0030 + B7 부탁 0032, head 하나) · 표 **44 → 62**(새 표 18) · API 연산 **97 → 153**(새 뼈대 56, 그 밖에 지금 경로의 모양을 덧붙여 고침 — 3.2) · OpenAPI 모양 **234 → 330** · `frontend/lib/backend/schema.d.ts` 다시 만듦(HEAD 화면 코드 + 새 타입 typecheck 오류 0, 7장)

## 1. migration 0024~0030 · 0032

| 번호 | 표 · 칸 | 채우기(올릴 때) · 되돌리기(내릴 때) |
| --- | --- | --- |
| `0024_v3_project` | projects `emd` · `budget_won`(만 원 단위 CHECK) · `source`(v2 · guest · member, 기본 v2) · `client_key` + UNIQUE(owner, client_key) / project_trades `scope` · `faces`(전체 = 벽 + 천장 CHECK) / project_spaces `kind`(8종) + 부분 UNIQUE(공사, kind) / standard_quotes `scope` · `faces` · `space_keys` · `share_ver`(부분 ↔ 판 CHECK) | 기본값으로 채움 · 칸을 지움 |
| `0025_v3_vendor` | vendors `instant_default` · `suspended_at` · `suspend_scope`(new · all, 둘이 같이) · **`visit_capacity`(1~3, 기본 2, L03)** · **`tax_kind`에 `simplified`(L02)** · 거절 사유 `info_mismatch`(vendors · vendor_reviews CHECK) / vendor_price_sets `rows_ver`(dobae_v2 · dobae_v3 · mokgong_v1) + CHECK `(trade = 'mokgong') = (rows_ver = 'mokgong_v1')` / vendor_price_lines `mode`(price · included · excluded) + CHECK 2개(옛 `price_or_included` 지움) / vendor_portfolio `area_m2` · `paper` / vendor_quotes 칩 4칸 / **새 표 `vendor_review_links`** | 목공 묶음 → mokgong_v1, `included_in`이 있던 줄 → included · 내릴 때 간이 → general, info_mismatch → other(보낼 말 채움), excluded 줄 지움 |
| `0026_v3_visit` | visits 상태 13개 · 살아 있는 상태 8개로 부분 UNIQUE(칸 · 업체) 다시 · `shortlist_id` · `attempt` + UNIQUE(공사, 공종, 업체, 시도) · `wish_start/end`(62일) · **`work_wish_on`(공사 희망일 사본, L04)** · `reply_due_at` · `booked_day/half` · `quote_due_at` · `expired_reason` · `cancel_code/note` · `decline_note` · `visited_at` · `requote_at` / visit_events 상태 13개 + `day` · `half` · `day_to` / **새 표 `shortlists` · `visit_windows` · `visit_holds` · `visit_changes` · `visit_proposals` · `visit_proposal_slots`** | 시도 번호를 (공사, 공종, 업체)마다 만든 순서로, 살아 있는 옛 요청(requested · quoted · chosen)마다 담기 한 칸 · 내릴 때 offered~visited → requested, expired · no_show → cancelled |
| `0027_v3_jobs` | **새 표 `jobs`**(kind 13개 · 상태 6개 · `dedup_key` UNIQUE · 부분 색인 `ix_jobs_due` · `ix_jobs_stuck`) | 표를 지움 |
| `0028_v3_thread` | files.kind에 `chat_photo` · `review_photo` · `done_photo`(칸 10 → 12자) / **새 표 `threads` · `thread_messages` · `thread_reads`** | 내릴 때 새 사진 종류 → photo · work_photo |
| `0029_v3_review_report` | **새 표 `reviews` · `review_photos` · `review_replies` · `reports` · `admin_actions`** | 표를 지움 |
| `0030_v3_work` | date_proposals `days` / deals `work_days` · `done_note` · `done_posted_at` / deal_events `code` / **새 표 `deal_files`** / extra_charges 답 값 `pending · approved · rejected · asked` · `group_id` · `version` · `superseded_at` · `client_key` + UNIQUE(판) · 부분 UNIQUE(최신 판) · UNIQUE(확정, 키) | ok → approved, talk → asked, `group_id = id` · 내릴 때 거꾸로(rejected → talk) |
| `0033_v3_market_ver` (리드 결정 2026-11-19) | standard_quotes `market_ver` varchar(40)(벽지 시장 평균 가격 판, 빈 글 CHECK) / standard_quote_lines `basis`에 `market`(시장 데이터 기준) | 내릴 때 market → assumed, 칸 지움 |
| `0032_v3_file_views` (B7 부탁, 리드 지시) | **새 표 `file_views`**(사업자등록증 열람 기록: `file_id` · `owner_id` · `viewer_id` · `viewer_role`(customer · vendor · admin CHECK) · `kind` · `at`, 색인 `ix_file_views_owner_at`(owner_id, at)). 파일 · 탈퇴 뒤에도 남기려고 FK 없음 | 표를 지움 |

- 0031(안 쓰는 칸 지우기)은 만들지 않았어요(9장 '나중'). 만들 때 그때의 head 다음에 둬요(번호가 0032보다 작아도 돼요).
- 0032는 data-model.md 1장의 다른 묶음 예약 번호(0032~0035)에서 B7 몫을 B1a가 만들었어요(`down_revision = 0030_v3_work`). 0033~0035는 그대로 예약이에요.
- 리드 결정 반영 위치
  - L02 간이과세: `vendors.tax_kind` CHECK · `vendor.models.TAX_KINDS` · `ProfileIn.tax_kind`. 계산(부가세 0)은 1단계(아래 4.7).
  - L03 반나절 받는 수: `vendors.visit_capacity`(1~3, 기본 2) + `visit_holds.seat`(1~3) + **부분 UNIQUE(업체, 날, 반나절, 칸 번호) where active** · `calc.slots.free_seat` · `open_halves(capacity=)`.
  - L04 공사 희망일: `visits.work_wish_on`(요청 때 사본) · 응답 칸 `work_wish_on`(VendorVisitRow · VisitHeadOut · VisitPickOut).
  - L09 실측 시각 지남: `calc.deadline.HALF_END = {am: 13:00, pm: 18:00}` · `visited_ok()`.
  - L10 D12 최소 처리: `calc.deadline.AFTER_ACCEPT_DUE = AFTER_PROPOSAL_DUE = "release_hold"`(잡기만 풀고 offered로, 칸은 비우지 않음).

### 1.1 data-model.md와 다르게 한 것 (이유)

| 무엇 | 바꾼 것 | 이유 |
| --- | --- | --- |
| visit_holds 겹침 | UNIQUE(업체, 날, 반나절) → (업체, 날, 반나절, **칸 번호**) | L03 |
| visit_changes | `countered`도 열린 상태: 부분 UNIQUE · `closed_at` CHECK를 (open, countered)로 | 업체가 다른 날을 낸 뒤에도 고객이 고를 차례라 새 요청이 끼면 안 돼요 |
| visit_proposals.reason_code | 비울 수 있음 + CHECK `change_id is not null or reason_code is not null` | 바꾸기 요청에 낸 다른 날(V20)은 이유 칸이 없어요(api.md 6장) |
| visits | `decline_note` · `work_wish_on` 더함 | api.md decline `note?` · L04 |
| vendor_price_sets | CHECK `rows_ver_trade` 더함 | 목공 묶음에 도배 판이 붙지 않게 |
| files.kind | varchar(10) → (12) | `review_photo`가 12자 |
| jobs.dedup_key | `kind:ref_id:YYYYMMDDHHMM`(UTC 분) | ISO 시각이면 80자를 넘어요 |
| threads 색인 | (customer_id, last_message_at) · (vendor_id, …) 오름차순 | PostgreSQL이 거꾸로 읽어요. 식 색인은 alembic check가 못 견줘요 |
| 그 밖 CHECK | thread_messages 빈 글 · text는 글 필수(지운 글 빼고) · reports `(kind = 'link') = (link_sort is not null)` · deals `work_days` 1~120 · `done_note` · standard_quotes `faces` | 값 범위는 DB가 지켜요 |

## 2. 모델 (새 · 바뀐 것)

| 파일 | 클래스 · 상수 |
| --- | --- |
| `app/project/models.py` | Project · ProjectSpace · ProjectTrade 칸 더함, `SCOPES` · `FACES` · `SPACE_KINDS` · `SOURCES` |
| `app/vendor/models.py` | Vendor · VendorPortfolio · VendorPriceSet · VendorPriceLine 칸, **VendorReviewLink**, `TAX_KINDS` · `ROWS_VERS` · `ROWS_VER_OF` · `PRICE_MODES` · `VISIT_CAPACITY_*` · `REJECT_CODES`(+info_mismatch) |
| `app/visit/models.py` | Visit · VisitEvent 칸, **Shortlist · VisitWindow · VisitHold · VisitChange · VisitProposal · VisitProposalSlot**, `STATUSES` · `LIVE` · `ENDED` · `EVENT_CODES` · `CANCEL_CODES` · `HALVES` … |
| `app/quote/models.py` | StandardQuote 범위 칸, VendorQuote 칩 4칸 |
| `app/schedule/models.py` | Deal · DealEvent · DateProposal · ExtraCharge 칸, **DealFile**, `ACKS` 값 바뀜, `DEAL_EVENT_CODES` |
| `app/files/models.py` | `KINDS` + 3종 (CHECK · 칸 길이 같이), **FileView**(0032) · `VIEWER_ROLES` — 쓰기는 B7의 `files.service.record_view` 한 곳 |
| `app/jobs/models.py` (새) | **Job**, `KINDS` 13개 · `STATUSES` · `ATTEMPTS_MAX = 5` |
| `app/thread/models.py` (새) | **Thread · ThreadMessage · ThreadRead**, `RO_REASONS` · `SYSTEM_CODES` · `THREAD_CONTACT_RETENTION_DAYS = None`(L07) |
| `app/review/models.py` (새) | **Review · ReviewPhoto · ReviewReply**, `TAGS` · `HIDDEN_CODES` · `WITHDRAWN_NAME = "탈퇴한 고객"`(L08) |
| `app/report/models.py` (새) | **Report · AdminAction**, `KINDS` · `CHAT_REASONS` · `LINK_REASONS` · `ACTIONS` · `ADMIN_ACTIONS` |

- `migrations/env.py`에 jobs · report · review · thread models import를 이름 순으로 더했어요.

## 3. API

### 3.1 새 경로 56개 (0단계 501 뼈대 → **1단계(2026-11-19)에 모두 동작**, 11장)

- 1단계 마무리 뒤 `not_ready`(501)를 돌려주는 경로는 **0개**예요(`app/`에 `not_ready()` 부르는 곳 없음). `tests/test_v3_contract.py`의 `NOT_READY`도 비었어요.

- 권한: 로그인 없음 401 `login_required` · 역할이 다름 403 `forbidden` · 업체 경로는 승인된 업체만(`approved_vendor`). 손님 경로(`/guest/standard` · `/regions/{sido}/{sgg}`)는 로그인 없이. `/guest/*`는 router 의존성 `ratelimit.guest`로 IP 한도(분당 20 · 하루 300, 넘으면 429 `too_many_attempts` + Retry-After, Redis가 멈추면 프로세스 안에서 셈)를 먼저 세요(B7 부탁).
- 몸통이 틀리면 지금도 422예요(모양 검사는 진짜). 그래서 화면 묶음은 지금 API로 몸통 모양을 맞춰 볼 수 있어요.

| 묶음 | 방법 · 경로 | 몸통 | 응답 |
| --- | --- | --- | --- |
| 손님 | POST `/guest/standard` | HomeInfoIn | GuestStandardOut |
| 프로젝트 | GET `/regions/{sido}/{sgg}` | - | EmdOut[] |
| 실시간 | GET `/stream` | - | text/event-stream (몸통 모양 StreamEventsDoc) |
| 신고 · 관리자 | POST `/reports` | ReportIn | ReportOut (201) |
| 신고 · 관리자 | GET `/admin/reports?status=open\|done&kind=` | - | ReportPageOut |
| 신고 · 관리자 | GET `/admin/reports/{report_id}` | - | ReportDetailOut |
| 신고 · 관리자 | POST `/admin/reports/{report_id}/resolve` | ResolveIn | ReportDetailOut |
| 신고 · 관리자 | GET `/admin/members?q=&status=&before=` | - | MemberPageOut |
| 신고 · 관리자 | POST `/admin/members/{user_id}/suspend` · `/unsuspend` | MemberNoteIn | MemberStateOut |
| 리뷰 | GET `/projects/{project_id}/vendors/{vendor_id}/reviews?sort=latest\|low&before=` | - | ReviewPageOut |
| 리뷰 | POST `/projects/{project_id}/deals/{deal_id}/review` | ReviewWriteIn | ReviewItemOut (201) |
| 리뷰 | PATCH · DELETE `/reviews/{review_id}` | ReviewEditIn · - | ReviewItemOut · 204 |
| 리뷰 | GET `/vendor/reviews?filter=waiting\|all` | - | VendorReviewsOut |
| 리뷰 | PUT `/vendor/reviews/{review_id}/reply` | ReplyIn | ReplyOut (처음 201 · 고치면 200) |
| 리뷰 | POST `/admin/reviews/{review_id}/hide` · `/show` | ReviewHideIn · - | ReviewStateOut |
| 공사 | POST `/projects/{project_id}/deals/{deal_id}/extras/{extra_id}/answer` | AnswerIn | TradeExtrasOut |
| 공사 | GET `/projects/{project_id}/log` · `/vendor/jobs/{deal_id}/log` | - | LogItemOut[] |
| 공사 | GET `/projects/{project_id}/plan.ics` | - | text/calendar |
| 채팅 | GET `/threads` | - | ThreadRowOut[] |
| 채팅 | GET `/threads/{thread_id}` | - | ThreadOut |
| 채팅 | GET `/threads/{thread_id}/messages?after_seq=&before_seq=&limit=` | - | MessageOut[] |
| 채팅 | POST `/threads/{thread_id}/messages` | MessageIn | MessageOut (201, 같은 키면 200) |
| 채팅 | POST `/threads/{thread_id}/read` | ReadIn | 204 |
| 채팅 | GET `/threads/{thread_id}/files/{file_id}` | - | 사진 |
| 채팅 | POST · DELETE `/threads/{thread_id}/block` (고객) | - | ThreadOut |
| 업체 | GET · PUT `/vendor/review-links` | - · ReviewLinksIn | ReviewLinkOut[] |
| 업체 | POST `/admin/vendors/{vendor_id}/links/{sort}` | LinkCheckIn | ReviewLinkAdminOut |
| 업체 | POST `/admin/vendors/{vendor_id}/suspend` · `/unsuspend` | SuspendIn · UnsuspendIn | VendorSuspendOut |
| 담기 | GET `/projects/{project_id}/shortlist?trade=` | - | ShortlistOut |
| 담기 | POST `/projects/{project_id}/shortlist` | ShortlistIn | ShortlistOut (201) |
| 담기 | DELETE `/projects/{project_id}/shortlist/{vendor_id}?trade=` | - | 204 |
| 실측(고객) | GET `/projects/{project_id}/visits/draft?trade=` | - | VisitDraftOut |
| 실측(고객) | GET `/projects/{project_id}/visits/{visit_id}` | - | VisitPickOut |
| 실측(고객) | POST `…/visits/{visit_id}/pick` · `…/proposal/pick` | SlotIn | PickOut |
| 실측(고객) | POST `…/visits/{visit_id}/repick` · `…/requote` | - | VisitStateOut |
| 실측(고객) | POST `…/visits/{visit_id}/again` | - | BoardRowOut (201) |
| 실측(고객) | POST `…/visits/{visit_id}/visited` | VisitedIn | VisitStateOut |
| 실측(고객) | POST `…/visits/{visit_id}/changes` | SlotIn | ChangeOut (201) |
| 실측(고객) | POST `…/changes/{change_id}/withdraw` · `…/changes/{change_id}/pick` | - · SlotIn | ChangeOut |
| 실측(고객) | GET `…/visits/{visit_id}/ics` | - | text/calendar |
| 실측(업체) | POST `/vendor/visits/{visit_id}/window` | WindowIn | WindowAnswerOut |
| 실측(업체) | POST `/vendor/visits/{visit_id}/accept` | - | VendorVisitStateOut |
| 실측(업체) | POST `/vendor/visits/{visit_id}/propose` | ProposeIn | VendorVisitStateOut |
| 실측(업체) | POST `/vendor/visits/{visit_id}/changes/{change_id}/accept` · `/propose` | - · SlotsIn | VendorVisitStateOut |
| 실측(업체) | GET `/vendor/schedule?from=&to=` | - | VendorScheduleOut |

- `/ai/*`는 만들지 않았어요(B5가 `backend/app/chat/`에서).
- `/admin/members*`는 account 기능인데, 0단계에서 B1a가 account를 고치지 않아 `report/router.py`에 뒀어요. B1b가 옮겨도 경로 · 모양은 그대로예요.
- 같은 깊이에서 글자 경로(`visits/draft`)를 `{visit_id}`보다 먼저 등록했어요(뒤에 오면 422).

### 3.2 고친 경로 (옛 몸통 · 응답은 그대로 + v3 칸을 덧붙임)

- 응답의 v3 칸은 기본값(빈 목록 · null)으로 나가고 1단계에서 채워요. 옛 칸(연락처 동의 · 연락처 공개 · `ack` ok/talk 등)은 0031에서 지울 후보예요.
- **v3 몸통 · 값을 보내면 지금은 501**이에요(옛 길로 잘못 들어가지 않게).
- `POST · PATCH /projects`만 두 몸통을 함께 받지 않았어요: 함께 받으면(Union) 422의 `fields[].loc`에 모양 이름이 붙어(`["ProjectCreate", "sido"]`) 지금 `components/start/Wizard.tsx`의 칸별 오류가 깨져요. 화면 묶음은 `Schemas["HomeInfoIn"]`을 바로 쓰면 돼요.

| 경로 | v3에서 더한 것 | 지금 501이 되는 입력 |
| --- | --- | --- |
| POST `/projects` | 머리 `Idempotency-Key`(1단계: 같은 키 → 200 같은 공사, 처리 중 409 `in_progress`). 몸통 `ProjectCreate \| HomeInfoIn`(v3 칸이 있으면 HomeInfoIn으로 검사, 422 `loc`는 옛 몸통과 같음) | - |
| PATCH `/projects/{id}` | 몸통 `ProjectCreate \| HomeInfoIn`(1단계), 첫 실측 요청 뒤 409 `locked` | - |
| GET `/projects/{id}` | ProjectOut `source` · `emd` · `budget_won` · `home`(HomeInfoOut) | - |
| GET `/projects` | MyProjectOut `emd` · `vendors`(VendorStepOut[]) | - |
| GET `/projects/{id}/overview` | OverviewOut `after_steps`(5칸) · `vendors` | - |
| GET `/projects/{id}/standard` | StandardOut `scope` · `spaces` · `faces` · `share_ver` · `budget_fit`, 줄 `basis` | - |
| GET `/projects/{id}/vendors` | VendorListOut `local` · `nearby`(VendorCardOut[]) · `nearby_sgg` · `shortlist` | - |
| GET `/projects/{id}/vendors/{vid}` | `?grade=`, VendorDetailOut `estimate_v3` · `grade_diff` · `state` · `instant_badge` · `rating` · `review_links` · `shortlisted` | `grade` 값 |
| POST `/projects/{id}/visits` | VisitCreateIn `wish_start` · `wish_end` · `photo_file_ids`, FailedOut 코드 4개 더 | 희망 기간 · 사진 |
| GET `/projects/{id}/visits` | VisitListOut `head`(VisitHeadOut) · `board`(BoardRowOut[]) | - |
| POST `/projects/{id}/visits/{vid}/cancel` | 몸통 CancelIn(선택) | 몸통이 있으면 |
| GET `/vendor/visits` · `/summary` | `tab=sched` · `sort=due\|new`, 줄 `area_label` · `home` · `wish_*` · `work_wish_on` · `estimate_total` · `budget_won` · `state`(StateTagOut) · `next`(VendorNextOut) · `attempt`, 요약 `sched` | `tab=sched` · `sort` |
| GET `/vendor/visits/{vid}` · POST `…/decline` | 자세히 `photos` · `capacity` · `window` · `booked` · `proposal` · `change` · `taken` · `other_windows` · `open_count` · `reply_due_at` · `thread_id`, DeclineIn `note` | decline `note` |
| GET · PUT `/vendor/visits/{vid}/quote` | 칩 4칸(`incl_removal` · `incl_waste` · `paper_spec` · `warranty_months`) — **지금도 저장 · 응답됨** | - |
| GET `/projects/{id}/quotes` | 비교 줄 `diff_vs_estimate` · `visit_day` · `valid_soon` · `requote_at` · `rating` | - |
| 공사 (`/schedule` · `/vendor/jobs/{did}` · `…/dates` · `…/extras` · `…/done`) | DealOut · JobOut `work_days` · `done_note` · `done_posted_at` · `auto_done_at` · (`review_open` · `review_id` · `thread_id` · `done_photos`), ProposalOut `days`, DatesIn `days`(start · end는 선택, method 기본 app), ExtraIn `client_key` · `replaces`, ExtraOut `answer` · `group_id` · `version` · `superseded`, 몸통 DoneIn(선택) | dates `days` · extras `client_key`/`replaces` · done 몸통 |
| 업체 정보 · 단가 (`/vendor/profile` · `/portfolio` · `/prices`) | ProfileIn/Out `tax_kind`(+simplified) · `instant_default` · `visit_capacity` · `suspended_at` — **지금도 저장됨**, 시공 사진 `area_m2` · `paper` — **지금도 저장됨**, PricesOut `v3`(PricesV3Out), confirm 몸통 ConfirmPricesIn(선택) | confirm 몸통 |
| 관리자 업체 (`/admin/vendors/{id}` · `/review`) | 자세히 `review_links` · `same_name` · `suspended_at` · `suspend_scope`, 거절 사유 `info_mismatch` — **지금도 됨** | - |

- api.md와 이름이 다른 것(지금 이름을 그대로 둠): 추가 금액 `entered_amount` · `file_ids`(api.md `amount` · `photo_file_ids`), 공사 끝 확인 `result: done | fixing`(api.md `ok | fix`), 날짜 고르기 응답의 업체 제안은 `VisitProposalOut`(공사 날짜 `ProposalOut`과 이름이 겹쳐서).

### 3.3 1단계에 새로 생긴 · 옮긴 경로

| 방법 · 경로 | 누가 | 응답 · 규칙 |
| --- | --- | --- |
| GET `/vendor/visits/{vid}/photos/{file_id}` | 그 요청을 받은 업체 | 요청 사진 파일(남의 것 404 · 고객 403) |
| GET `/vendor/visits/{vid}?start&end&excluded` | 업체 | `open_count`: 기간 답하기 전에 열린 반나절 미리 세기(틀리면 422) |
| GET `/projects/{pid}/deals/{did}/photos/{file_id}` · GET `/vendor/jobs/{did}/photos/{file_id}` | 고객 · 업체 | 공사 끝 사진(done_photo) |
| GET `/vendor/jobs/{did}/extras/preview?entered_amount&vat_mode` | 업체 | `ExtraPreviewOut`(공급가 · 부가세 · 합계 · 승인 뒤 공사 금액, 저장 안 함, 간이 0) |
| POST `/admin/vendors/{vid}/links/{sort}` | 관리자 | vendor 뼈대 → **report router**(B1b 파일). 몸통 `LinkCheckIn{status, note?, url?}` — `url`은 관리자가 본 주소, 그사이 바뀌었으면 409 `stale`, 같은 상태 409 `already` |
| GET `/reviews/{rid}/photos/{file_id}` | 고객 · 업체 | B1b 리뷰 사진 |
| `/ai/*` 4개 | 고객 | B5 AI 칸(`app/chat/router.py`, main.py ROUTERS `ai_router`) |
| POST `/admin/vendors/{vid}/suspend` · `/unsuspend` | 관리자 | vendor 뼈대 지움, report router만(B1b). 멈춤 all은 진행 중 실측 요청도 닫아요(`closed_visits`) |

- 업체에게 가는 응답에서 `customer`(이름 · 전화 · 주소) 칸을 **뺐어요**(B3 · B7, 10장). 업체는 구 · 동 · 면적까지만 봐요.

## 4. 함수 계약 (다른 묶음 · 1단계가 부르는 것)

### 4.1 `app/thread/service.py` (B1b가 넘겨받음, 0단계에도 동작하고 테스트 있음)

```python
async def open(s, *, project_id, vendor_id, customer_id, visit_id,
               customer_label, vendor_label, area_label) -> uuid.UUID
# (공사, 업체) 대화가 없으면 만들고, 있으면 visit_id를 바꾸고 다시 연다(blocked · admin으로 닫힌 것은 그대로)
async def post_system(s, thread_id, *, code: str, ref_id=None, body=None) -> int
# 대화 행 UPDATE로 seq + 1 → 시스템 카드 한 줄. code는 thread.models.SYSTEM_CODES. 돌려주는 값: 새 seq
async def set_read_only(s, *, reason, thread_id=None, project_id=None, vendor_id=None) -> uuid.UUID | None
# open일 때만 read_only(사유). 바뀐 대화 id, 없거나 이미면 None
async def find(s, project_id, vendor_id) -> uuid.UUID | None
```

- 모두 부르는 쪽 트랜잭션 안에서 돌아요(commit · push는 부르는 쪽이 commit 뒤에). 사유: `other_chosen` · `cancelled` · `declined` · `withdrawn` · `blocked` · `admin`.

### 4.2 `app/realtime/service.py` (쓰기만, 읽기 `GET /stream`은 B1b)

```python
async def push(user_ids, event: "msg"|"read"|"notif"|"state"|"resync", data: dict) -> int
async def push_state(user_ids, kind, ref_id, project_id=None) -> int   # state {kind, project_id, id}
def stream_key(user_id) -> str   # f"{REALTIME_PREFIX 또는 mj:{app_env}}:ev:{user_id}"
```

- Redis Stream 항목 칸: `e`(이벤트) · `d`(JSON). MAXLEN ~500 · 7일. Redis가 안 되면 0을 돌려주고 로그만(예외 없음). **commit 뒤에** 불러요.
- `notify.service.push_unread(s, user_ids)`: commit 뒤에 안 읽은 수를 `notif {unread}`로 보내요.
- 설정 `realtime_prefix`(환경변수 `REALTIME_PREFIX`, 비우면 `mj:{app_env}`)를 `config.py`에 더했어요.

### 4.3 `app/jobs/service.py` (기한 일, 동작하고 테스트 있음)

```python
def key(kind, ref_id, run_at) -> str                  # "kind:ref_id:YYYYMMDDHHMM"(UTC), 80자 안
async def add(s, *, kind, ref_id, run_at, dedup_key=None) -> bool     # 같은 키면 False (멱등)
async def cancel(s, *, now, kind=None, ref_id=None, dedup_key=None) -> int   # pending만 cancelled
async def claim(s, now, limit=50, kinds=None) -> list[Job]   # FOR UPDATE SKIP LOCKED → running(+2분)
async def finish(s, job_id, *, now, skipped=False) -> None   # done · skipped
async def fail(s, job_id, *, now, error) -> None   # 1 · 5 · 30분 뒤 다시, 5번 넘으면 failed
```

- `worker.py`: `JOB_HANDLERS: dict[kind, handler]`(지금 비어 있음) · `sweep_jobs(ctx, now)`. 처리 함수 모양 `async def h(s, job, now) -> bool`(바꿨으면 True = done, 이미 바뀌었으면 False = skipped). **cron은 1단계에서 켜요**(지금 켜면 처리 함수 없는 일이 쌓이지 않게 막아 둠).

### 4.4 `app/calc/deadline.py` (순수 함수, 지금 시각은 인자)

| 함수 | 값 |
| --- | --- |
| `reply_due(sent_at)` · `accept_due(picked_at)` · `proposal_due(at)` · `change_due(at)` · `date_request_due(at)` | + 48시간 |
| `pick_due(answered_at)` | + 7일 |
| `quote_due(visit_day)` · `reminder_at(visit_day)` · `dates_due(confirmed_at)` · `valid_soon_at(valid_until)` | 실측일 + 3일 18:00 · 전날 18:00 · 확정 + 2일 18:00 · 3일 · 1일 전 18:00 (서울) |
| `done_remind_at(posted)` · `auto_done_at(posted)` | + 4일 · + 7일 (D24) |
| `half_end(day, half)` · `visited_ok(now, day, half)` | 오전 13:00 · 오후 18:00 (L09) |
| `is_over(now, due)` · `is_soon(now, due, hours=12)` | 화면 '지남' · '곧 지나요' |

### 4.5 `app/calc/slots.py` (순수 함수)

| 함수 | 하는 일 |
| --- | --- |
| `open_halves(start, end, excluded, taken, capacity, today) -> list[DayOpen]` | 날마다 남은 칸(오늘 · 빼는 날은 0) |
| `taken_count(holds)` · `count_open(days)` · `is_open(days, day, half)` | 잡힌 수 세기 · 'N칸' · 고를 수 있는지 |
| `free_seat(used, capacity) -> int \| None` | 빈 가장 작은 칸 번호(없으면 409 `slot_taken`) |
| `overlaps(a_start, a_end, b_start, b_end)` | 겹침 없음(C22) 판정 |
| `draft_wish(work_start, today) -> (start, end) \| None` | 공사 시작 희망일 − 28일 ~ − 14일(내일보다 이르면 내일로) |
| `recommend(work_start, days) -> Pick \| None` | 희망일 − 20일에 가장 가까운 열린 칸(같으면 이른 날 · 오전) |

### 4.6 오류 코드 · 알림 목록 (코드 상수)

- `app/shared/errors.py`: `CODES`(code → 상태 · 기본 해요체 문장), `app_error(code, message=None)`, `not_ready()`. api.md 0장 409 9개 + `blocked_retry` · `in_progress`, 401 · 403 · 404 · 413 · 422 · 429 · 501.
- `CODES` 밖에서 입구가 같은 모양으로 내는 코드: `bad_origin` 403(OriginGuard) · `server_error` 500 · `unavailable` 503(CatchAll) · `bad_request` 400 · `method_not_allowed` 405(`_HTTP`). 화면은 이것도 code로 나눠요.
- `app/notify/catalog.py`: `KINDS`(kind → 받는 사람 · 링크 꼴 · 본문 예) 46개, `link(kind, **ids)`. 지금 코드가 쓰는 kind 18개를 다 담았어요. 링크는 routes.md 1장 대상(`/projects/{pid}/visits/{vid}` · `/vendor/requests/{vid}` · `/chat/{tid}` · `/projects/{pid}/schedule` · `/projects/{pid}/review` · `/vendor/jobs/{did}` · `/vendor/reviews` …).

### 4.7 1단계에 B1a가 채울 계산 (계약만)

- 가견적 v3: `calc.estimate.PRICE_ROWS["dobae_v3"]`(1201~1208) → `EstimateV3Out`. 간이 · 면세 업체는 부가세 0(L02: `exempt=tax_kind in ("exempt", "simplified")`).
- 실측 견적서 · 추가 금액의 간이 업체 금액: `from_entered(amount, "included", rate=0)`(부가세 0, 낸 금액 = 합계). 지금은 간이를 골라도 일반처럼 계산돼요.
- 표준견적서 v3(도배지 평 × 시장 평균 · 부분 공간 몫, `share_ver`): `GuestStandardOut` · `StandardOut` v3 칸.

### 4.8 B6가 넘긴 이름 (data-sources.md 맨 위, 1단계 계산 엔진이 불러요)

| 이름 | 1단계에 쓰는 곳 |
| --- | --- |
| `refprice.wallpaper_market.paper_market(grade).per_py` (basic 실크 10,749 · economy 합지 4,577원/벽지 평, 사용자 결정 '평균') · `.version = "paper-market-2026.11"` | 표준견적서 도배지 줄을 '시장 평균 가격 · 벽지 평 × per_py'로(수량 = 도배 면적 × 1.2 ÷ 3.3058, 소수 한 자리). 판 이름을 견적에 고정. 줄 `basis` = `market`(0033, 리드 결정) · 판은 `market_ver` |
| `refprice.vendor_baseline.price_warning(code, value)` · `vendor_base(code)` (1201~1208, 10배 · 10분의 1 경고) | 단가표 저장 · 확인(`PriceRowV3Out` 경고 칸). 금액 계산에는 안 써요 |
| `shared.regions.emd_list` · `is_emd` · `neighbors` (서울 5개 구) | `GET /regions/{sido}/{sgg}`(EmdOut) · `HomeInfoIn.emd` 검사 · 업체 목록 `nearby` · `nearby_sgg` |
| `refprice.holidays.HOLIDAYS` (평일 4일 더함) | 공정표(`schedule.service.days_off` · 달력 공휴일)는 고치지 않아도 건너뛰어요. 실측 열린 반나절(`calc.slots.open_halves`)은 넘겨받은 `excluded`만 빼서, 공휴일을 함께 뺄지는 1단계에 정해요(service가 `excluded`에 넣으면 돼요) |

- **합계가 바뀌는 것은 맞아요(리드 확인)**: 9판 C07 집(공급 69.4㎡ · 실크 · 빈 집)은 지금 엔진(실크 9,500원)이 1,974,069원, 도배지 줄만 10,749원으로 바꾸면 **2,060,625원**(+86,556)이에요. B1a가 지금 계산 엔진으로 다시 셈해 같은 숫자를 확인했어요(`b1a.md`). 0단계는 계산을 바꾸지 않았어요.
- 리드 결정(2026-11-19): 벽지 시장가 판은 `price_ver`를 늘리지 않고 **따로 `market_ver`**(0033)로 고정해요. 줄 근거에 **`market`**(시장 데이터 기준)을 더했어요(0033 CHECK · `GuestLineOut.basis`).

## 5. 에이전트 도구가 부를 읽기 함수 (B5 `chat/tools.py`)

- 규칙: 읽기만 · 사용자 · 프로젝트는 세션으로 고정(AI 출력으로 받지 않음) · Pydantic 모양 그대로 · 숫자는 이 값만.

| 함수 | 있음 / 1단계 | 돌려주는 모양 |
| --- | --- | --- |
| `project.service.get_for(s, user, project_id)` | 있음 | ProjectOut |
| `quote.service.standard_for(s, user, project_id)` | 있음 (v3 칸은 1단계) | StandardOut |
| `visit.service.vendors_for(s, user, project_id, trade)` | 있음 (v3 칸은 1단계) | VendorListOut |
| `visit.service.vendor_detail(s, user, project_id, vendor_id, trade, today)` | 있음 | VendorDetailOut |
| `visit.service.visits_for(s, user, project_id, trade, today)` | 있음 (`board`는 1단계) | VisitListOut |
| `visit.service.compare(s, user, project_id, trade, today)` | 있음 | CompareOut |
| `schedule.service.plan_for(s, user, project_id, today, kind=None)` · `schedule_for(…)` · `overview_for(…)` | 있음 | PlanOut · ScheduleOut · OverviewOut |
| `visit.service.shortlist_for(s, user, project_id, trade)` | 1단계 | ShortlistOut |
| `visit.service.draft_for(s, user, project_id, trade, today)` | 1단계 | VisitDraftOut (AI 초안 카드) |
| `visit.service.pick_view(s, user, project_id, visit_id, now)` | 1단계 | VisitPickOut (추천 · 열린 칸) |
| `guest.service.standard(data: HomeInfoIn, today)` | 1단계 | GuestStandardOut (로그인 전 칩은 AI 없음) |
| `schedule.service.log_for(s, user, project_id)` | 1단계 | LogItemOut[] |
| `calc.slots.draft_wish` · `recommend` · `calc.deadline.*` | 있음 | 순수 함수 |

## 6. 예시 데이터 모양 (화면 묶음 `lib/mock/`)

- 타입은 `lib/backend/client.ts`의 `Schemas["이름"]`(= `components["schemas"]["이름"]`)을 써요. 아래 이름과 같은 모양으로 예시를 두면 1단계에서 API로 바꿀 때 고칠 곳이 없어요.
- 금액 = 원 정수, 날짜 = `YYYY-MM-DD`, 시각 = ISO(+09:00), **Decimal(㎡ · 평 · % · 품)은 문자열**(`"69.4"`), 반나절 = `am` · `pm`.

| 화면 (routes.md) | 모양 이름 |
| --- | --- |
| C02 · D11 기본 정보 · C57 손님 표준견적서 | HomeInfoIn → GuestStandardOut (GuestLineOut) |
| C07 · C60 표준견적서 | StandardOut (+ scope · spaces · share_ver · budget_fit) |
| C10 · C12 · D06 업체 보기 · 담기 띠 | VendorListOut.local/nearby (VendorCardOut) · ShortlistCountOut · ShortlistOut |
| C11 · D07 업체 상세 | VendorDetailOut.estimate_v3 (EstimateV3Out · EstimateV3LineOut) · RatingOut · ReviewLinkOut |
| C13 · D08 요청서 | VisitDraftOut · VisitCreateIn |
| C14 · D03 상태판 | VisitListOut.head (VisitHeadOut) · board (BoardRowOut · VisitNextOut · WindowOut · BookedOut · VisitProposalOut · ChangeOut · VisitCanOut) |
| C16 · C19 · C21 · C22 · D15~D17 날짜 고르기 | VisitPickOut (DayHalvesOut · RecommendOut · MyVisitOut · SlotOut) → PickOut |
| C23~C31 · C62 · D05 · V09 · V19 채팅 | ThreadRowOut · ThreadOut · MessageOut · MessageIn |
| 실시간 줄기 | StreamMsgOut · StreamReadOut · StreamNotifOut · StreamStateOut · StreamResyncOut |
| C39 · C48 · V24 · V25 리뷰 | ReviewWriteIn · ReviewPageOut · ReviewItemOut · VendorReviewsOut · ReplyIn |
| C31 신고 · A02 · A03 | ReportIn · ReportPageOut · ReportDetailOut · MemberPageOut |
| C63 · V23 기록 | LogItemOut |
| V03 · V08 · D04 · D14 작업함 · 일정 · 기간 답하기 | VendorVisitRow v3 칸 (StateTagOut · VendorNextOut) · VendorVisitDetailOut · VendorScheduleOut (VendorSlotOut) · WindowIn · ProposeIn |
| D02 단가표 | PricesOut.v3 (PricesV3Out · PriceRowV3Out) · ConfirmPricesIn |
| V18 · A01 링크 · 심사 | ReviewLinksIn · ReviewLinkOut · VendorAdminDetailOut (+ review_links · same_name) |

- 아래 예시는 `model_validate`로 모양을 확인했어요(13개 모두 통과, 칸 빠짐 없음).

```json
{"HomeInfoIn": {"trade": "dobae", "scope": "full", "spaces": [], "faces": ["wall", "ceiling"], "housing": "apt", "sido": "seoul", "sgg": "노원구", "emd": "상계동", "area_m2": "69.4", "area_basis": "supply", "occupied": false, "grade": "basic", "budget_won": 3000000, "start_date": "2027-01-04"}}
{"VendorCardOut": {"vendor_id": "0193b2a0-0000-7000-8000-000000000001", "name": "마루와벽", "sgg": "노원구", "estimate_total": 3186150, "vs_standard_pct": "61.4", "rating": "4.8", "review_count": 12, "done_count": 31, "visit_fee": 0, "instant_badge": true, "state": "ok", "shortlisted": false}}
{"BoardRowOut": {"visit_id": "0193b2a0-0000-7000-8000-0000000000b1", "vendor_id": "0193b2a0-0000-7000-8000-000000000001", "vendor_name": "마루와벽", "attempt": 1, "status": "offered", "next": {"kind": "pick", "who": "customer", "due_at": "2026-12-09T14:00:00+09:00", "overdue": false, "soon": false}, "window": {"start": "2026-12-13", "end": "2026-12-18", "excluded": ["2026-12-14"], "instant": true, "answered_at": "2026-12-02T14:00:00+09:00", "pick_due_at": "2026-12-09T14:00:00+09:00"}, "booked": null, "proposal": null, "change": null, "can": {"pick": true, "cancel": true, "again": false, "visited": false, "change": false, "requote": false}, "estimate_total": 3186150, "thread_id": null, "quote": null, "cancel_code": null, "expired_reason": null}}
{"VisitPickOut": {"visit_id": "0193b2a0-0000-7000-8000-0000000000b1", "project_id": "0193b2a0-0000-7000-8000-0000000000aa", "trade": "dobae", "vendor_id": "0193b2a0-0000-7000-8000-000000000001", "vendor_name": "마루와벽", "status": "offered", "next": {"kind": "pick", "who": "customer", "due_at": "2026-12-09T14:00:00+09:00", "overdue": false, "soon": false}, "wish_start": "2026-12-07", "wish_end": "2026-12-21", "work_wish_on": "2027-01-04", "window": {"start": "2026-12-13", "end": "2026-12-18", "excluded": ["2026-12-14"], "instant": true, "answered_at": "2026-12-02T14:00:00+09:00", "pick_due_at": "2026-12-09T14:00:00+09:00"}, "days": [{"day": "2026-12-15", "am": true, "pm": false, "am_left": 1, "pm_left": 0}], "full": [{"day": "2026-12-15", "half": "pm"}], "mine": [], "instant": true, "recommend": {"day": "2026-12-15", "half": "am", "target": "2026-12-15", "basis": "start_minus_20"}, "overlap": true, "ways": [], "booked": null, "proposal": null, "change": null, "thread_id": null}}
{"PickOut": {"visit_id": "0193b2a0-0000-7000-8000-0000000000b1", "status": "booked", "thread_id": "0193b2a0-0000-7000-8000-0000000000c1", "booked": {"day": "2026-12-15", "half": "am", "kind": "booked", "hold_until": null}}}
{"VendorVisitRow(v3 칸만)": {"area_label": "노원구 상계동 · 공급 69.4㎡", "home": "아파트 · 도배 전체 · 빈 집", "wish_start": "2026-12-07", "wish_end": "2026-12-21", "work_wish_on": "2027-01-04", "estimate_total": 3186150, "budget_won": 3000000, "state": {"icon": "todo", "label": "기간을 보내 주세요"}, "next": {"label": "기간 답하기", "due_at": "2026-12-03T10:00:00+09:00", "overdue": false}, "attempt": 1}}
{"ThreadRowOut": {"thread_id": "0193b2a0-0000-7000-8000-0000000000c1", "title": "마루와벽", "visit_label": "실측 12.15(화) 오전", "last": {"kind": "text", "preview": "도착 전에 연락 드릴게요", "at": "2026-12-14T18:10:00+09:00"}, "unread": 1, "status": "open", "ro_reason": null}}
{"MessageOut": {"seq": 3, "id": "0193b2a0-0000-7000-8000-0000000000d3", "from": "them", "kind": "text", "body": "계좌로 먼저 보내 주시면 할인해 드려요", "file_id": null, "system_code": null, "ref_id": null, "warn": "offsite", "at": "2026-12-14T18:12:00+09:00"}}
{"StreamStateOut": {"kind": "visit", "project_id": "0193b2a0-0000-7000-8000-0000000000aa", "id": "0193b2a0-0000-7000-8000-0000000000b1"}}
```

- 실시간 줄기: `event: ready` → `event: msg` `data: {"thread_id","seq"}` · `event: notif` `data: {"unread":2}` · `event: state` `data: {"kind","project_id","id"}` · `event: resync` `data: {}`. `id:`는 줄기 id, 15초 `: ping`, `retry: 5000`.

## 7. 지금 코드에 맞춘 것 (0단계 호환)

- 새 제약 때문에 지금 service를 조금 고쳤어요: 단가 줄 `mode` · 묶음 `rows_ver`(vendor) · 다시 요청 `attempt = 가장 큰 시도 + 1`(visit, `repository.attempts`) · 추가 금액 첫 판 `group_id = id` · 답 값 바꿔 쓰기 `ACK_NEW` / `ACK_OLD`(schedule).
- 지금 테스트 두 곳을 고쳤어요(테스트 뜻은 그대로):
  - `tests/test_visit_request.py`의 날 SQL(`VISIT_ROW`)에 `attempt + 1`. 같은 업체 다시 요청은 새 시도 번호여야 해서예요(`uq_visits_attempt`).
  - `tests/test_visit_inbox.py`의 요약 기대값에 `"sched": 0`. `InboxSummaryOut`에 v3 칸 `sched`(기본 0)를 더해서예요.
- 저장까지 지금 되는 v3 칸: 견적서 칩 4칸, 업체 `instant_default` · `visit_capacity`, 시공 사진 `area_m2` · `paper`, 거절 사유 `info_mismatch`.

### 7.1 B7 부탁 반영 (리드 지시, b7.md 3장 · 5장)

| 부탁 | 한 것 | 확인 |
| --- | --- | --- |
| `main.py` 입구 순서 | `check_origin`(BaseHTTPMiddleware) · `_UNSAFE`를 지우고 바깥부터 SecurityHeaders → CatchAll → BodyLimit → OriginGuard. 스테이징 문서도 닫음: `_public_docs = app_env in ("local", "test")` (타입 생성은 `app.openapi()`라 그대로) | `test_v3_contract.py` 새 4개(b7.md W1 · W2): 나눠 온 1,088KB 본문 413(옛 400) · `Sec-Fetch-Site: cross-site` 403 `bad_origin` · `/stream` 다른 Origin 403(로그인 확인 전) · JSON 응답 `no-store` · CSP · XFO · CORP, 파일 응답 머리는 그대로 |
| 손님 계산 요청 제한 | `guest/router.py` `APIRouter(..., dependencies=[Depends(ratelimit.guest)])` | 같은 IP 21번째 429 `too_many_attempts` + Retry-After |
| 열람 기록 표 | 0032 `file_views` + `files.models.FileView`(b7.md 5장 모양 그대로) | `test_v3_schema_misc.py::test_file_views_keep_rows_without_fk`, alembic check |
| 로그 · SQL 값 | `migrations/env.py` `fileConfig(..., disable_existing_loggers=False)`. `db.py` 엔진의 `hide_parameters=True`는 초기 세팅부터 이미 있어요 | 전체 테스트 |
| semgrep 오탐 2건 | `visit/models.py` 부분 UNIQUE 두 곳에 이유 한 줄 + `# nosemgrep: avoid-sqlalchemy-text` | semgrep 1.186.0(캐시, 오프라인)에 같은 긴 이름의 규칙을 로컬로 돌려 고치기 전 2건(163 · 171줄) → 뒤 0건(`--error` exit 0) |

- 남은 것: bandit Low 2건(`schedule/service.py` 226 · 307줄 `assert`)은 초기 세팅부터 있던 줄이고 CI는 `-ll`(중간 이상)이라 그대로 뒀어요.

### 7.2 화면 타입 (`schema.d.ts`)

- HEAD 화면 코드(`git archive HEAD frontend`) + 새 `schema.d.ts`로 `tsc --noEmit`: **오류 0**(파일 244개, `Schemas[...]`를 쓰는 파일 39개) → 새 타입이 지금 화면 코드를 깨는 곳은 없어요.
- 같이 쓰는 작업 폴더 그대로 `pnpm typecheck`는 다른 묶음이 고치는 중인 파일 때문에 오류가 나요(시각마다 달라요). 마지막 확인 때 5개: `.next-b4/types/validator.ts` 2(B4 개발 서버 생성 파일) · `app/admin/members/page.tsx` 1 · `app/admin/vendors/page.tsx` 2(바뀌는 중인 `lib/api/admin.ts`의 `listMembers` 반환 · `ReviewTab`에 `all`). 모두 B1a 타입 탓이 아니고, B1a는 화면 코드를 고치지 않았어요.

## 8. 다른 묶음에 부탁

| 누구 | 부탁 | 이유 |
| --- | --- | --- |
| 리드 (B7 끝남) | `tests/security/conftest.py`가 `conftest` 이름으로 올라가 지금 테스트 6개(`from conftest import query`: test_data_ingest · test_knowledge_search · test_reference_migration · test_reference_schema · test_v2_ask · test_v2_ask_chat)를 모으지 못하게 해요. `tests/security/__init__.py`를 두거나 이름을 바꿔 주세요 | `pytest tests/`(CI도)가 모으기에서 멈춰요. B1a는 `--ignore=tests/security` + `tests/security` 따로 돌려 확인했어요 |
| 리드 (B7 끝남) | `.env.example`에 `REALTIME_PREFIX=`(비우면 mj:{APP_ENV}) 한 줄 + 한국어 주석 | 새 설정 (B1a 파일 밖) |
| B7 · 리드 | `files.service.record_view`를 `s.add(FileView(...))`로 바꾸고 b7.md W9 테스트 | 0032 표가 생겼어요(7.1) |
| B1b | `thread` · `realtime` · `review` · `report` 폴더를 넘겨받아 1단계 service를 붙여요. `thread.service` 세 함수는 이미 동작해요(테스트 `test_v3_contract.py`). `/admin/members`를 account로 옮겨도 돼요(경로 · 모양은 그대로) | 0단계 범위 |
| B1b | 탈퇴(`account.service`)에서 지우기 전에 `thread.service.set_read_only(reason="withdrawn")` | dev-05 · C53 |
| B5 | 도구는 5장 읽기 함수만, worker 일은 `agent/jobs.py`의 `FUNCTIONS`를 `WorkerSettings.functions`에 붙이기(B1a가 1단계에 합침) | architecture 6장 |
| B6 | 시연 데이터가 service를 쓰면 바꿀 것이 없어요(시도 · 줄 판 · mode를 service가 채움). v3 시연은 새 표(shortlists · visit_* · threads · reviews)를 채워 주세요. 공간 몫 표 판 이름은 `standard_quotes.share_ver`(20자)로 | 0024 · 0026 |
| B2 · B3 · B4 | `schema.d.ts`를 이번에 다시 만들었어요(HEAD 화면 코드 + 새 타입 오류 0, 7.2). 새 화면은 3.2의 v3 칸만 쓰고 옛 칸(연락처 동의 · `ack` ok/talk · `vendors`)은 쓰지 않아요. admin 화면 두 곳은 바뀐 `lib/api/admin.ts`에 맞춰 주세요(7.2) | 0031에서 지울 후보 |
| 리드 | `data-model.md` 6장 확인 숫자(실크 9,500 → 1,974,069원)를 사용자 결정 '평균'(10,749 → 2,060,625원)으로 맞춰 주세요(4.8) | 문서 맞추기 |
| 리드 | `data-model.md`에 1.1 표(바꾼 점)를 반영해 주세요(문서 주인은 개발자 역할이지만 B1a는 contract · b1a만 고쳐요). 새 백엔드 의존성은 없어요(pyproject · uv.lock 그대로) | 문서 맞추기 |

## 9. 못 한 것 · 1단계로 넘긴 것

- 새 경로 56개의 동작(service) · 고친 경로의 v3 칸 채우기 · 표준견적서 v3 · 가견적 dobae_v3 · 간이과세 계산 · 손님 계산 · 담기 · 실측 전이 전부 · 처리 함수 13개와 cron · 공사 날 목록 · 추가 금액 판 · 자동 끝 → B1a 1단계.
- 채팅 글 · 읽음 · 차단 · `GET /stream` · 리뷰 · 신고 · 회원 → B1b 1단계.
- 0031(안 쓰는 칸 지우기)은 v3 코드에서 옛 칸을 다 뺀 뒤에.

## 10. 바뀐 것 (스키마 · 경로, 날짜 순)

화면 묶음(B2a · B2b · B3)은 이 표를 보고 따라와요. 스키마를 바꿀 때마다 `frontend/lib/backend/schema.d.ts`를 다시 만들고 한 줄 더해요.

| 날짜 | 바뀐 것 | `schema.d.ts` |
| --- | --- | --- |
| 2026-11-18 | 0단계 계약 처음 (1 ~ 9장) | 다시 만듦 |
| 2026-11-19 | 입구 순서(B7) · 손님 IP 한도 · 0032 `file_views` (API 모양은 그대로) | 다시 만듦(설명 글만) |
| 2026-11-19 | 0033: `StandardOut.market_ver` · `GuestStandardOut.market_ver` 새 칸, `GuestLineOut.basis`에 `market`, 도배지 줄 단위 '벽지 평' | 다시 만듦 |
| 2026-11-19 | B1a 1단계 1차(일꾼 A · B · C, `verification/b1a-worker-*.md`): 501 뼈대를 실제 동작으로(11장). 모양: `POST · PATCH /projects` 몸통 `ProjectCreate \| HomeInfoIn`(422 `loc` 그대로, 같은 키 200) · `EstimateV3LineOut.in_standard` · `EstimateV3Out.paper_ok` · `PriceRowV3Out.warn_high · warn_low` · `DealOut.done_photos` · `InboxRowOut.work_days · deal_total` · `VendorStepOut.total` · `AfterStepOut.key` 값(quote · confirm · dates · work · check) · 공사 사진 경로 2개 | 다시 만듦 |
| 2026-11-19 | 0034: 요청 사진 `VisitPhotoIn{file_id, label?}` · `VisitCreateIn.photos`(옛 `photo_file_ids`도, 둘 다면 422) · 고른 벽지 `ShortlistIn.grade` · `VisitCreateIn.grade` · 사례 `PortfolioMeta.area_basis` · `PortfolioOut.area_text`('공급 79.3㎡') · `chats.project_id`(B5) | 다시 만듦 |
| 2026-11-19 | 1단계 2차(화면 · B1b 부탁): **업체 응답에서 `customer` 뺌**(`VendorVisitRow` · `VendorVisitDetailOut` · `InboxRowOut` · `JobOut.visit`, `CustomerContactOut` 지움) · `area_label` '노원구 상계동 · 공급 69.4㎡'. A: `ReapplyIn.biz_no` · `ProfileIn/Out.intro` · `StandardOut.days` · `PricesV3Out.example_home`. B: `VendorDetailOut.grade · reply_hours · rating` · `VisitPickOut.attempt · no_overlap_reason` · `VendorVisitDetailOut.photos · photo_labels · propose_options · open_count` · `CompareOut.gap_total` · `CompareRowOut.valid_soon_at` 등 · `grade_diff` = 다른 벽지 − 보여 준 벽지. C: `JobOut.grand_total · day_no`(1부터) · `ExtraOut.after_total` · `DealOut.grand_total` · `TradeExtrasOut.deal_total · grand_total` · `ScheduleOut.request_due_preview` · `TodoOut.days` · `LogItemOut.half_to · days` · `MyProjectOut.current`(1~6) · `ExtraPreviewOut`, 알림 kind 3개(`visit_change_withdrawn` · `visit_repicked` · `visit_visited`) · 업체 알림 끝 ' · 노원구 상계동 도배' | 다시 만듦 |
| 2026-11-19 | B5 `/ai/*` 4개를 main.py에 붙임 · B7 `SignupIn.phone` 선택(빈 값 됨) | 다시 만듦 |
| 2026-11-19 | 1단계 마무리: 0035 `visits.close_reason`에 `vendor_stopped`(칸 16자) + 고객 알림 kind `visit_vendor_stopped`, 업체 멈춤(all)이 진행 중 요청을 닫고 `closed_visits`에 수, `LinkCheckIn.url`, `POST /admin/vendors/{vid}/links/{sort}` → report router, `visit_repicked` 예시 글 | 다시 만듦(16,195줄 · 연산 162 · 모양 339) |
| 2026-11-19 | B2b 부탁: `BoardRowOut.expired_due_at`(기한이 지나 끝난 줄의 그 기한 시각 — 답 없음 = 업체 답 기한, 고르기 없음 = 고르기 기한, 그 밖 null) · 알림 글 '동 · 호' → '동 · 호수'(CF-02, 실측 전날 알림 '동 · 호수는 채팅으로 알려 주세요') | 다시 만듦(16,200줄) |
| 2026-11-19 | B1b: `ReportDetailOut`에 `reporter_label`(이름 없이 '상계동 고객') · `link_label` · `link_url` 새 칸(B3 부탁), 새 경로 `GET /reviews/{review_id}/photos/{file_id}`(리뷰 사진). 관리자 리뷰 숨김 · 보이기 · 업체 멈춤 · 풀기는 report router로 옮김(경로 · 몸통 · 응답 그대로) | 다시 만듦(작업 폴더 API 그대로라 B1a가 바꾸는 중인 칸도 함께 들어감, `verification/b1b.md`) |

## 11. 동작함 (501 → 실제 동작)

1단계에서 경로가 실제로 동작하기 시작하면 여기에 날짜와 함께 옮겨 적어요. **2026-11-19 1단계 마무리로 501 남은 경로는 0개**예요.

| 날짜 | 경로 | 비고 |
| --- | --- | --- |
| 2026-11-19 | 채팅 `GET /threads` · `GET /threads/{tid}` · `GET · POST …/messages` · `POST …/read` · `GET …/files/{fid}` · `POST · DELETE …/block` | B1b. 같은 `client_key` 200 · 읽기만 409 `read_only` · 쓰기 막힘 403 · 남의 대화 404 · 분당 30 429. 업체 응답에 고객 이름 · 연락처 없음 |
| 2026-11-19 | `GET /stream` | B1b. `ready`(retry 5000) → `msg` · `read` · `notif` · `state` · `resync`, 15초 `: ping`, 60초마다 세션 · 정지 다시 봄, 30분마다 끝내고 브라우저가 `Last-Event-ID`로 다시 이음, 사용자마다 5줄기(6번째 429) |
| 2026-11-19 | 리뷰 `GET /projects/{pid}/vendors/{vid}/reviews` · `POST /projects/{pid}/deals/{did}/review` · `PATCH · DELETE /reviews/{rid}` · `GET /reviews/{rid}/photos/{fid}` · `GET /vendor/reviews` · `PUT /vendor/reviews/{rid}/reply` · `POST /admin/reviews/{rid}/hide · show` | B1b. 끝난 공사만(403) · 한 번(409) · 하루 5 · 업체 화면에 쓴 사람 이름 없음 · 탈퇴한 고객(L08) |
| 2026-11-19 | 신고 · 관리자 `POST /reports` · `GET /admin/reports` · `GET · POST /admin/reports/{id}(/resolve)` · `GET /admin/members` · `POST /admin/members/{uid}/suspend · unsuspend` · `POST /admin/vendors/{vid}/suspend · unsuspend` | B1b. 같은 글 처리 전 한 번(409) · 두 번째 처리 409 · 정지하면 세션 지움 · 업체 멈춤 all은 그 업체 대화를 읽기만(admin) + 진행 중 실측 요청을 `vendor_stopped`로 닫고 고객에게 `visit_vendor_stopped`(1단계 마무리, B1a) |
| 2026-11-19 | 손님 · 지역 `POST /guest/standard` · `GET /regions/{sido}/{sgg}` | B1a(A). 저장 안 함 · 지역 밖 · 지난 희망일 · 모르는 칸 422 · IP 분당 20 |
| 2026-11-19 | 프로젝트 · 표준견적서 `POST · PATCH /projects`(HomeInfoIn · `Idempotency-Key`) · `GET /projects/{id}` · `GET /projects/{id}/standard`(시장 평균 · 부분 공사 · `days`) · `GET /projects` · `GET /projects/{id}/overview` · `GET /projects/{id}/log` · `GET /projects/{id}/plan.ics` | B1a(A · C). 같은 키 200 · 처리 중 409 `in_progress` · 첫 요청 뒤 PATCH 409 `locked` · C07 2,060,625원 |
| 2026-11-19 | 업체 보기 · 담기 `GET /projects/{id}/vendors`(local · nearby · 별점) · `GET /projects/{id}/vendors/{vid}?grade=` · `GET · POST /projects/{id}/shortlist` · `DELETE …/shortlist/{vid}` | B1a(B). 3칸 · `already` · `slots_full` · `no_estimate` · `paper_unsupported` · `blocked_retry` · `locked`, 같은 칸 동시 409 |
| 2026-11-19 | 실측 일정(고객) `GET …/visits/draft` · `POST …/visits`(희망 기간 · 사진 · 벽지) · `GET …/visits`(head · board) · `GET …/visits/{vid}` · `POST …/pick · proposal/pick · repick · again · visited · requote · cancel · changes · changes/{cid}/withdraw · changes/{cid}/pick` · `GET …/ics` | B1a(B). 전이 표 하나하나 허용 · 409, 같은 반나절 두 고객 → 하나 409 `slot_taken`(L03 칸 번호) |
| 2026-11-19 | 실측 일정(업체) `GET /vendor/visits/{vid}`(미리 세기 `open_count`) · `GET …/photos/{fid}` · `POST …/window · accept · propose · decline · changes/{cid}/accept · changes/{cid}/propose` · `GET /vendor/schedule` · `GET /vendor/visits?tab=todo\|waiting\|sched\|jobs\|done&sort=` · `GET /vendor/visits/summary` | B1a(B · C). 업체 응답에 고객 이름 · 연락처 · 동호수 없음 |
| 2026-11-19 | 견적서 · 확정 `PUT · POST /vendor/visits/{vid}/quote(/send)`(booked · visited → quoted, 간이 부가세 0, 유효기간 알림 일) · `POST /projects/{id}/quotes/{vid}/confirm` · `POST …/deals/{did}/reselect` | B1a(A · B · C). 확정하면 다른 요청 닫기 · 다른 대화 읽기만(other_chosen) |
| 2026-11-19 | 공사 `POST /vendor/jobs/{did}/dates`(날 목록) · `POST …/dates/{pid}/accept` · `POST …/date-requests` · `POST /vendor/jobs/{did}/extras`(client_key · replaces) · `GET …/extras/preview` · `POST …/extras/{xid}/answer` · `POST /vendor/jobs/{did}/done` · 공사 사진 2개 · `GET /vendor/jobs/{did}/log` | B1a(C). 같은 키 200 같은 줄 · 고친 판 · 자동 끝 7일(`auto_done`) |
| 2026-11-19 | 업체 정보 · 단가 `GET /vendor/prices`(v3) · `POST /vendor/prices/{trade}/confirm`(ConfirmPricesIn, 두 번 동시 409 `stale`) · `GET · PUT /vendor/review-links` · `POST /vendor/application/reapply`(biz_no) · `GET · PUT /vendor/profile`(intro) · `POST /vendor/portfolio`(area_basis) · `POST /admin/vendors/{vid}/links/{sort}`(report) | B1a(A · 본체) |
| 2026-11-19 | 기한 일: worker cron 1분 · 처리 함수 13개(실측 7 · 견적 1 · 공사 4 · 대화 가리기 1) · 개발 전용 `python -m app.run_due --now 2026-11-21T10:00+09:00`(local · test만, 그 밖 exit 2) | B1a(A · B · C). 처리 함수는 멱등(두 번째 skipped). `thread_redact`는 B1b 가리기 함수가 없으면 skipped |
| 2026-11-19 | AI `/ai/*` 4개 | B5(main.py에 B1a가 붙임) |
