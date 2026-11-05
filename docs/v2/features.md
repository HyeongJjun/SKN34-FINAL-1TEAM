# v2 기능 표

디자인 시안 v2의 판을 기능 단위 커밋으로 나눈 순서다. 상담 챗(상담실 · 묻기 창)은 보류라 넣지 않는다.

| # | 커밋 | 백엔드 · migration | 화면(시안 판) |
| --- | --- | --- | --- |
| 1 | docs: v2 ERD · 기능 표 · 구조와 작업 지침 수정안 | `docs/v2/*`, AGENTS.md 1 · 2 · 3장 | — |
| 2 | feat: 도배 · 목공 계산 엔진과 기준 단가 | calc · refprice(공휴일 포함) | — |
| 3 | feat: 일정 계산 | calc/schedule: 하루 단위 · 휴일 · 기한 · 연락처 기한 | — |
| 4 | feat: 공통 머리 · 바닥글 · 상태 화면 | — | 역할별 머리 · 알림 종, WFooter, WStatus |
| 5 | feat: 첫 화면 · 자주 묻는 질문 · 약관 화면 | — | WHome, WGuide, WLegal |
| 6 | feat: 휴대폰 칸과 카카오 · 비밀번호 재설정 화면 | 0002_v2_phone | WSignup, WPhone, WLogin, WResetPw(화면만) |
| 7 | feat: 알림 저장과 화면 | 0003_v2_notify | WNotify |
| 8 | feat: 견적 받기 v2 · 집 정보 고치기 | 0004_v2_project | WWizard |
| 9 | feat: 표준견적서 버전 저장과 화면 | 0005_v2_standard | WStandard |
| 10 | feat: 예상 공정표 저장과 화면 | 0006_v2_plan | WPlan |
| 11 | feat: 업체 정보 · 연락 방식 · 자주 묻는 5가지 | 0007_v2_vendor_profile | WVProfile 01 · 02 · 04 · 05 |
| 12 | feat: 가견적 단가 직접 넣기 · 다시 확인 | 0008_v2_vendor_price | WVProfile 03 |
| 13 | feat: 업체 심사 보완 · 다시 신청 · 이력 | 0009_v2_vendor_review | WAdmin, WVHome, WVSignup, WVFirst |
| 14 | feat: 업체 고르기 · 업체 자세히 | 이 집 기준 가견적 목록 | WVendors, WVendorDetail |
| 15 | feat: 실측 요청 · 연락처 동의 · 요청 문구 | 0010_v2_visit | WVendors 확인 창, WVisit |
| 16 | feat: 실측 요청 취소 · 업체 못 받아요 · 작업함 할 일 | visit 전이 | WVisit 상태, WVInbox 할 일 |
| 17 | feat: 실측 견적서 임시 저장 · 보내기 | 0011_v2_vendor_quote | WVQuote |
| 18 | feat: 실측 견적서 다시 올리기 · 비교 화면 | 0012_v2_quote_code · 버전 · 파일 내주기 | WCompare |
| 19 | feat: 업체 확정 | 0013_v2_deal | WConfirm |
| 20 | feat: 다시 고르기 · 연락처 가림 | deal · visit 전이 | WCompare · WConfirm 상태 |
| 21 | feat: 공사 날짜 올림 · 수락 · 다른 날짜 요청 | 0015_v2_dates | WVCalendar, WSchedule |
| 22 | feat: 확정 공정표 · 날짜 바꾸기 | plans final · 0016_v2_date_change | WPlanDone, WVCalendar |
| 23 | feat: 추가 금액 기록 | 0017_v2_extra | WPlanDone · WVCalendar |
| 24 | feat: 공사 끝냈어요 · 확인 · 연락처 1년 | deal 전이 | WPlanDone · WVCalendar |
| 25 | feat: 내 공사 지금 할 일 · 목록 · 서류 · 작업함 탭 | 0018_v2_checks | WProjectB, WMy, WDocs, WVInbox |
| 26 | chore: 예시 데이터와 옛 화면 정리 | — | lib/mock, 옛 라우트 |

## 화면 경로

| 판 | 경로 |
| --- | --- |
| WHome · WGuide · WLegal | `/` · `/faq` · `/legal` |
| WSignup · WPhone · WLogin · WResetPw | `/signup` · `/signup/phone` · `/login` · `/reset-password` |
| WWizard · WMy · WAccount · WNotify | `/start` · `/my` · `/account` · `/notifications` |
| WProjectB | `/projects/[id]` |
| WStandard · WPlan(→ WPlanDone) | `/projects/[id]/standard` · `/projects/[id]/plan` |
| WVendors · WVendorDetail | `/projects/[id]/vendors?trade=` · `/projects/[id]/vendors/[vid]` |
| WVisit · WCompare · WConfirm | `/projects/[id]/visits` · `/projects/[id]/quotes?trade=` · `/projects/[id]/quotes/[visitId]/confirm` |
| WSchedule · WDocs | `/projects/[id]/schedule` · `/projects/[id]/docs` |
| WVSignup | `/signup/vendor` |
| WVHome · WVFirst · WVInbox | `/vendor` |
| WVProfile · WVQuote | `/vendor/profile` · `/vendor/requests/[visitId]/quote` |
| WVCalendar | `/vendor/jobs` · `/vendor/jobs/[dealId]` |
| WAdmin | `/admin/vendors` |

## 지금 만들지 않는 것

- 상담 챗(WChat* · 묻기 창): 보류.
- 카카오 로그인 · 비밀번호 재설정 메일 · 휴대폰 인증 문자: 화면만, 내부 로직은 나중.
- 업체 견적서에서 AI가 단가 읽기: 팀 결정 뒤(에이전트 6개 밖).
- 국세청 사업자 상태 조회: 외부 API라 이슈 먼저.
- 믿집 회원이 아닌 업체(공개 정보) 구역, 기한 지남 알림(cron), 견본 표준견적서(WSample)와 업체 자세히 오른쪽 창(판단 대기).
