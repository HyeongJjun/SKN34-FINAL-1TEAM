# B1a 1단계 2차 — 일꾼 B 보고 (리드가 옮겨 적음, 2026-11-19)

일꾼 B가 맡은 것: 담기 · 실측 일정, 그리고 화면 묶음 · B1b 부탁 1~11.

## 검증 (일꾼이 실제로 돌림)

- 실행 명령: `TEST_DB_NAME=mitjip_test_b1a_visit TEST_REDIS_URL=…/13 uv run pytest <파일> -q -p no:cacheprovider`
- 백엔드 전체 `tests/`: **1210 passed · 1 failed**(1769초)
  - 실패 1개는 `test_finish`예요. 실행 도중 일꾼 C가 그 파일을 고쳤어요.
  - 다시 돌리니 6 passed였어요.
- 새 테스트: 18개
- ruff: 내 22파일 통과
- openapi: 경로 146 · 모양 339

## 새 · 바뀐 경로

- 새 경로: `GET /vendor/visits/{visit_id}/photos/{file_id}`
  - 그 요청을 받은 업체만 열어요.
  - 다른 요청이면 404, 고객이면 403, 로그인하지 않았으면 401이에요.
- `GET /vendor/visits/{visit_id}?start=&end=&excluded=` → `open_count`
  - 기간 답하기와 같은 규칙으로 미리 세요. 틀리면 422예요.
- `POST /projects/{id}/visits`
  - 사진은 고객 본인 photo만, 10장까지예요. 남의 사진이나 다른 종류는 422예요.
  - 사진은 업체마다 저장돼요. 한 번 더 요청하면 사진 · 벽지를 옮겨요.
- `POST /projects/{id}/shortlist`: `grade`를 받아요.

## 채워진 칸

| 화면 | 칸 |
| --- | --- |
| 업체 카드 | `rating` · `review_count` · `done_count` |
| 업체 자세히 | `grade` · `reply_hours`(최근 20건 가운데 값) · `rating` |
| 날짜 고르기 | `attempt` · `no_overlap_reason`(after_work_start · after_wish · before_wish · full) |
| 업체 요청 자세히 | 사진 · `photo_labels` · `propose_options` |
| 상태판 머리 | 사진 · `photo_labels` |
| 견적 비교 | `gap_total` · `valid_soon_at` · 가견적과 차이 · 실측일 · 3일 안 · 다시 받기 · 별점. 견적서를 기다리는 booked · visited도 들어가요 |

## 바꾼 스키마

- 뺀 것: `VendorVisitRow.customer`(그래서 `VendorVisitDetailOut` · `JobOut.visit`에도 없어요), `CustomerContactOut` 클래스
- 새 모양: `VisitPhotoIn{file_id, label≤20?}`
- `VisitCreateIn`
  - `photos`와 `grade`를 받아요.
  - 옛 `photo_file_ids`도 받아요. 둘 다 보내면 422예요.
- 뜻이 바뀐 칸
  - `grade_diff` = 다른 벽지 − 보여 준 벽지예요. 그래서 `?grade=` 미리 보기에서는 부호가 반대예요.
  - `ways`는 겹치는 날이 있지만 고를 칸이 0일 때도 나와요.
- 면적 이름표는 '노원구 상계동 · 공급 69.4㎡'예요(`calc.visit_view.area_label` · `area_text`).

## 다른 일꾼이 부를 함수

- `visit.service.close_for_vendor(s, vendor_id, now) -> int`
  - 업체가 멈추면 확정 전 요청을 닫고 고객에게 알려요.
  - commit은 하지 않아요. 잠금 순서는 프로젝트 → 요청 → 대화예요.
- `calc.rating.average · tag_counts · summary`, `visit.service.rating_of`

## 남은 것 · 부탁

- 업체 멈춤 닫기의 이유 값이 없어서 지금은 `close_reason='reselected'` + 고객 kind `visit_declined`를 써요.
  - 전용 값이 필요하면 migration(`ck_visits_close_reason`에 'vendor_stopped')과 고객용 알림 kind를 더해야 해요.
- B1b 쪽
  - `thread.close_for_vendor`보다 `visit.service.close_for_vendor`를 먼저 불러요.
  - commit 뒤 `visit_service.flush_later(s)`를 부르면 화면 신호도 가요.
  - `review.service.rating_of`를 `calc.rating.summary`로 바꿔요.
- 일꾼 C 쪽
  - `visit_repicked` 예시 글이 보내는 때와 맞지 않아요.
  - 작업함 줄 grade는 `v.grade or std.grade`예요.
- 그대로 둔 것: `V2_FALLBACK=True`, 공휴일 자동 제외는 하지 않아요.
