# B1a 1단계 2차 — 일꾼 C 보고 (리드가 옮겨 적음, 2026-11-19)

일꾼 C가 맡은 것: jobs · worker · 공사, 그리고 화면 묶음 부탁 1~7.

## 검증 (일꾼이 실제로 돌림)

- 실행 환경: DB `mitjip_test_b1a_work` · Redis 12 · `-p no:cacheprovider`
- 결과
  - 내 영역 + 새 시험, 15개 파일: 174 passed · 1 failed
    - 실패 1개는 `test_finish` 연락처 시험이에요. 고친 뒤 `test_finish` 6 passed예요.
  - 다른 영역 23개 파일: **186 passed**(`test_v3_contract` · `test_demo` · `test_visit_inbox` · `test_v3_visit_flow` 포함)
- ruff check · format --check: 내 파일 33개 통과
- openapi: 경로 145 · 모양 339, 이름 겹침 없음
- `check_repo.py`: 통과

## 새 파일

- `calc/work_view.py`: `day_no(work_days, today)`, `grand_total(deal_total, approved)`
- `tests/test_v3_work_calc.py`

## 새 · 바뀐 경로

- 새 경로: `GET /vendor/jobs/{deal_id}/extras/preview?entered_amount=&vat_mode=` → `ExtraPreviewOut`
  - 돌려주는 것: 공급가 · 부가세 · 합계 · `tax_kind` · `grand_total` · `after_total`. 저장하지 않아요.
  - 간이 업체는 부가세 0이에요.
  - 면세 업체가 면세 아닌 값을 보내면 422예요. 남의 공사는 404, 고객이 부르면 403이에요.
- 응답 칸만 바뀐 경로
  - `GET /vendor/jobs/{id}` · `GET /vendor/visits` · `GET /projects/{id}/deals`
  - 추가 금액 응답
  - `GET /projects/{id}/schedule` · `GET /projects/{id}/overview` · `GET /projects`
  - 기록 2곳

## 바뀐 스키마 (화면이 쓸 것)

- 개인정보: 업체 쪽 작업함 · 공사 응답에 `customer` 칸이 없어요.
  - `InboxRowOut`은 상속을 끊고 칸을 직접 둬요.
  - `JobOut.visit`에서 `CustomerContactOut`을 지웠어요.
- `area_label`: '노원구 상계동 · 공급 69.4㎡'처럼 기준을 붙여요(`calc.visit_view.area_label`).
- `JobOut.grand_total`(확정 금액 + 승인한 추가 금액), `JobOut.day_no`(1부터, 오늘이 공사 날이 아니면 null)
- `ExtraOut.after_total`: 답을 기다리거나 물어본 최신 판에만 있어요. 뜻은 '승인하면 공사 금액'이에요.
- `DealOut.grand_total`, `TradeExtrasOut.deal_total` · `grand_total`. 공사 사진은 `done_photos`예요.
- `ScheduleOut.request_due_preview`: 지금 + 48시간이에요(`calc.deadline.date_request_due`).
- `TodoOut.days`: 업체가 낸 날 · 수락한 공사 날 · 고른 날
- `LogItemOut.half_to` · `days`: 제안 반나절 둘은 day · half · day_to · half_to예요.
- 업체 알림 본문 끝에 ' · 노원구 상계동 도배'가 붙어요(`notify.catalog.work_name`, 9가지).
- 새 알림 kind 3개: `visit_change_withdrawn` · `visit_repicked` · `visit_visited`
  - 받는 사람은 업체, 링크는 `/vendor/requests/{vid}`예요.
- `MyProjectOut.current` · `TradeProgressOut.current`: 1부터 6까지(다 마치면 6)

## 남은 것 · 보고만

- D16 실측 날짜를 고르기 전 '…까지 답해요' 기한은 visit 응답 몫이에요(일꾼 B).
- 아무 데서도 부르지 않는 함수가 있어요: `visit_service.inbox` · `inbox_summary` · `rows_for` · `vendor_fields` · `TABS`, `visit.schemas.VendorVisitPage`. 작업함은 `schedule/inbox.py`가 기준이에요.
