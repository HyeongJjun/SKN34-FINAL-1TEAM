# 디자인 검증 기록

실제로 돌린 것만 적어요. 날짜 · 명령 · 결과를 그대로 남겨요. 모두 2026-11-18(디자이너), Python 3.12.10, 작업 폴더 `C:\Workspace\SKN34\wt-v3`.

| 날짜 | 무엇 | 명령 · 방법 | 결과 | 남은 일 |
| --- | --- | --- | --- | --- |
| 2026-11-18 | 토큰 대비 · 흰 바탕(기본) | `python docs/v3/design/check_contrast.py` | 83짝 통과 83 · 실패 0. 가장 아슬한 짝 `--mj-line-control` / `--mj-fill` 3.15:1(기준 3:1) | 화면에 그린 뒤 axe로 다시 |
| 2026-11-18 | 토큰 대비 · 회색 바탕(`data-canvas="gray"`) | 같은 명령(두 모드를 함께 돌려요) | 83짝 실패 0. 가장 아슬한 짝 `--mj-line-control` / `--mj-bg` 3.15:1 | |
| 2026-11-18 | 9판 값 견줌 | `python docs/v3/design/check_contrast.py --nine` | 84짝 중 **실패 40**(끝 코드 1). 가장 낮은 것 9판 입력 칸 경계 1.10:1 | 바꾼 까닭의 근거로만 씀 |
| 2026-11-18 | 글자 크기 단계 | 같은 명령 | 1층 `--mj-size-*`와 모든 미디어 블록의 `--mj-type-*`가 13 · 14 · 16 · 18 · 20 · 28 · 38 안 → 통과 | |
| 2026-11-18 | 누를 곳 크기 토큰 | 같은 명령 | `--mj-hit` 44 · 단추 52/44/40 · 입력 48 · 칩 · 나눔 칸 · 달력 칸 40 이상 → 통과 | 실제 그려진 크기는 제작 뒤 화면 점검 |
| 2026-11-18 | KWCAG 2.2 '대각선 6.0mm' 환산 | 같은 명령(가정: 폰 160px/in, 데스크톱 96px/in) | 한 변 4.24mm ≈ 폰 26.7px · 데스크톱 16.0px. 40px 칸 대각선 ≈ 9.0mm(폰) | KWCAG 원문은 확인 못 함(2차 자료) |
| 2026-11-18 | 글자 너비 어림 | 아래 '글자 너비 어림' 스크립트(Pillow 12.3, 이 PC 글꼴) | 아래 표. 폰 단계 이름 · 달력 칸 아래 글은 13px로 칸에 안 들어감 → 모양을 바꿈(design-system 2.3) | Pretendard를 넣은 뒤 브라우저에서 다시 |
| 2026-11-18 | 9판 클래스 → 화면 번호 | 아래 '클래스 세기' 스크립트 | 조각 109개에서 클래스마다 쓰는 화면을 뽑아 design-system 3장 표에 씀 | |
| 2026-11-18 | 토큰 CSS 문법 | Node v24.18.1 한 줄 점검(괄호 짝 · `:root` 겹친 이름 · 정의 안 된 `var()`) | 괄호 짝 맞음 · 선언 228개 · 겹친 이름 0 · 정의 안 된 참조 0(`--mj-font-face`는 next/font가 넣고 대체 값이 있음) | 넣은 뒤 `next build`로 다시 |
| 2026-11-18 | 쓰지 않는 1층 값 | Python 점검(1층 이름이 `var()`로 쓰이는지) | gray-25 · red-100 · orange-500을 지운 뒤 대비 점검을 다시 돌려 실패 0 · `--nine` 실패 40 그대로. 파랑 50~900과 간격 단계는 일부러 남김 | |

## 1. 대비 · 흰 바탕(기본) 83짝

| 앞(글자 · 선) | 바탕 | 종류 | 기준 | 대비 | 결과 | 쓰는 곳 |
| --- | --- | --- | --- | --- | --- | --- |
| `--mj-text` #1b222c | `--mj-bg` #ffffff | 글자 | 4.5:1 | 16.01:1 | 통과 | 본문 · 제목 · 금액(페이지 바탕) |
| `--mj-text` #1b222c | `--mj-surface` #ffffff | 글자 | 4.5:1 | 16.01:1 | 통과 | 묶음 안 본문 · 금액 |
| `--mj-text-sub` #495563 | `--mj-surface` #ffffff | 글자 | 4.5:1 | 7.60:1 | 통과 | 줄 아래 설명 · 라벨 |
| `--mj-text-sub` #495563 | `--mj-bg` #ffffff | 글자 | 4.5:1 | 7.60:1 | 통과 | 묶음 밖 설명(바탕 위) |
| `--mj-text-mute` #616c7b | `--mj-surface` #ffffff | 글자 | 4.5:1 | 5.33:1 | 통과 | 시각 · 범례 · 각주 |
| `--mj-text-mute` #616c7b | `--mj-bg` #ffffff | 글자 | 4.5:1 | 5.33:1 | 통과 | 묶음 밖 각주(바탕 위) |
| `--mj-text-mute` #616c7b | `--mj-fill` #f1f3f6 | 글자 | 4.5:1 | 4.80:1 | 통과 | 말풍선 안 '자동 답변' · 파일 크기 |
| `--mj-text-mute` #616c7b | `--mj-surface-sub` #f8f9fb | 글자 | 4.5:1 | 5.06:1 | 통과 | 답글 · 인용 안 날짜 |
| `--mj-text-mute` #616c7b | `--mj-primary-weak` #ebf2fe | 글자 | 4.5:1 | 4.74:1 | 통과 | 고른 줄(작업함 표) 안 보조 글자 |
| `--mj-text-placeholder` #616c7b | `--mj-field-bg` #f8f9fb | 글자 | 4.5:1 | 5.06:1 | 통과 | 입력 칸 자리 글자 |
| `--mj-text` #1b222c | `--mj-field-bg` #f8f9fb | 글자 | 4.5:1 | 15.20:1 | 통과 | 입력 글자 |
| `--mj-text` #1b222c | `--mj-fill` #f1f3f6 | 글자 | 4.5:1 | 14.40:1 | 통과 | 상대 말풍선 · AI 답 |
| `--mj-text-sub` #495563 | `--mj-fill` #f1f3f6 | 글자 | 4.5:1 | 6.84:1 | 통과 | 칩 · 나눔 칸 글자 · 시스템 줄 |
| `--mj-text-sub` #495563 | `--mj-surface-sub` #f8f9fb | 글자 | 4.5:1 | 7.22:1 | 통과 | 답글 본문 · 펼친 답 |
| `--mj-text-sub` #495563 | `--mj-fill-strong` #e3e6eb | 글자 | 4.5:1 | 6.08:1 | 통과 | 잡힌 반나절 날짜 |
| `--mj-on-primary` #ffffff | `--mj-primary` #1b66d8 | 글자 | 4.5:1 | 5.33:1 | 통과 | 주 단추 글자 · 내 말풍선 · 고른 날 |
| `--mj-on-primary` #ffffff | `--mj-primary-hover` #1856b4 | 글자 | 4.5:1 | 6.93:1 | 통과 | 주 단추 올림 |
| `--mj-on-primary` #ffffff | `--mj-primary-press` #17478e | 글자 | 4.5:1 | 9.02:1 | 통과 | 주 단추 누름 |
| `--mj-on-primary-weak` #1856b4 | `--mj-primary-weak` #ebf2fe | 글자 | 4.5:1 | 6.16:1 | 통과 | 약한 단추 · 고른 칩 · 안내 상자 |
| `--mj-on-primary-weak` #1856b4 | `--mj-primary-weak-hover` #cfe1fe | 글자 | 4.5:1 | 5.23:1 | 통과 | 약한 단추 올림 |
| `--mj-link` #1b66d8 | `--mj-surface` #ffffff | 글자 | 4.5:1 | 5.33:1 | 통과 | 글자 단추 · 자세히 › |
| `--mj-link` #1b66d8 | `--mj-bg` #ffffff | 글자 | 4.5:1 | 5.33:1 | 통과 | 묶음 밖 글자 단추 |
| `--mj-link` #1b66d8 | `--mj-fill` #f1f3f6 | 글자 | 4.5:1 | 4.80:1 | 통과 | 말풍선 안 글자 단추 |
| `--mj-link` #1b66d8 | `--mj-primary-weak` #ebf2fe | 글자 | 4.5:1 | 4.74:1 | 통과 | 고른 줄 안 글자 단추 |
| `--mj-badge-now-fg` #1856b4 | `--mj-badge-now-bg` #ebf2fe | 글자 | 4.5:1 | 6.16:1 | 통과 | 배지 · 지금 |
| `--mj-badge-wait-fg` #984c00 | `--mj-badge-wait-bg` #fff4ea | 글자 | 4.5:1 | 5.75:1 | 통과 | 배지 · 기다림 · 기한 가까움 |
| `--mj-badge-ok-fg` #036b3b | `--mj-badge-ok-bg` #ecf9f3 | 글자 | 4.5:1 | 6.12:1 | 통과 | 배지 · 확정 |
| `--mj-badge-bad-fg` #b9212b | `--mj-badge-bad-bg` #fff0f1 | 글자 | 4.5:1 | 5.73:1 | 통과 | 배지 · 지남 · 거절 |
| `--mj-badge-mute-fg` #495563 | `--mj-badge-mute-bg` #f1f3f6 | 글자 | 4.5:1 | 6.84:1 | 통과 | 배지 · 준비 중 · 닫힘 |
| `--mj-danger` #db212d | `--mj-surface` #ffffff | 글자 | 4.5:1 | 4.92:1 | 통과 | 칸 아래 오류 글자 |
| `--mj-on-danger` #ffffff | `--mj-danger` #db212d | 글자 | 4.5:1 | 4.92:1 | 통과 | 위험 단추(거절 · 탈퇴) |
| `--mj-on-danger-weak` #b9212b | `--mj-danger-weak` #fff0f1 | 글자 | 4.5:1 | 5.73:1 | 통과 | 오류 줄 글자 |
| `--mj-text` #1b222c | `--mj-danger-weak` #fff0f1 | 글자 | 4.5:1 | 14.47:1 | 통과 | 오류 줄 안 본문 |
| `--mj-on-warn-weak` #7b3f03 | `--mj-warn-weak` #fff4ea | 글자 | 4.5:1 | 7.59:1 | 통과 | 주의 줄(믿집 밖 거래) · 경고 줄 |
| `--mj-text` #1b222c | `--mj-warn-weak` #fff4ea | 글자 | 4.5:1 | 14.77:1 | 통과 | 경고 줄 안 본문(단가 표) |
| `--mj-text-mute` #616c7b | `--mj-warn-weak` #fff4ea | 글자 | 4.5:1 | 4.92:1 | 통과 | 경고 줄 안 보조 글자 |
| `--mj-on-count` #ffffff | `--mj-count` #db212d | 글자 | 4.5:1 | 4.92:1 | 통과 | 안 읽은 수 |
| `--mj-text-inverse` #ffffff | `--mj-surface-inverse` #313c49 | 글자 | 4.5:1 | 11.21:1 | 통과 | 진행 중 공사 띠 · 토스트 |
| `--mj-text-inverse-sub` #ced3da | `--mj-surface-inverse` #313c49 | 글자 | 4.5:1 | 7.45:1 | 통과 | 띠 보조 글자 |
| `--mj-on-primary` #ffffff | `--mj-surface-inverse` #313c49 | 글자 | 4.5:1 | 11.21:1 | 통과 | 띠 위 파란 배지 바깥(흰 글자 기준) |
| `--mj-proposed-text` #984c00 | `--mj-surface` #ffffff | 글자 | 4.5:1 | 6.23:1 | 통과 | 제안한 날 글자 |
| `--mj-on-proposed` #ffffff | `--mj-proposed` #b35900 | 글자 | 4.5:1 | 4.83:1 | 통과 | 고른 제안 반나절 |
| `--mj-holiday` #b9212b | `--mj-surface` #ffffff | 글자 | 4.5:1 | 6.33:1 | 통과 | 일요일 · 공휴일 날짜 |
| `--mj-holiday` #b9212b | `--mj-range-vendor` #cfe1fe | 글자 | 4.5:1 | 4.78:1 | 통과 | 업체 가능 띠 안 일요일 |
| `--mj-text-sub` #495563 | `--mj-range-vendor` #cfe1fe | 글자 | 4.5:1 | 5.74:1 | 통과 | 업체 가능 띠 안 날짜 |
| `--mj-text` #1b222c | `--mj-range-wish` #ebf2fe | 글자 | 4.5:1 | 14.23:1 | 통과 | 희망 기간 띠 안 날짜 |
| `--mj-ext-pdf` #b9212b | `--mj-surface` #ffffff | 글자 | 4.5:1 | 6.33:1 | 통과 | 파일 종류 PDF |
| `--mj-ext-xls` #036b3b | `--mj-surface` #ffffff | 글자 | 4.5:1 | 6.62:1 | 통과 | 파일 종류 XLS |
| `--mj-ext-img` #1856b4 | `--mj-surface` #ffffff | 글자 | 4.5:1 | 6.93:1 | 통과 | 파일 종류 JPG |
| `--mj-avatar-fg` #495563 | `--mj-avatar-bg` #f1f3f6 | 글자 | 4.5:1 | 6.84:1 | 통과 | 업체 · 고객 첫 글자 |
| `--mj-avatar-warm-fg` #705430 | `--mj-avatar-warm-bg` #f6f1ec | 글자 | 4.5:1 | 6.24:1 | 통과 | 업체 상세 큰 얼굴 |
| `--mj-text-inverse` #ffffff | `--mj-media-bg` #101319 | 글자 | 4.5:1 | 18.60:1 | 통과 | 사진 크게 보기 글자 |
| `--mj-text-inverse-sub` #ced3da | `--mj-media-bg` #101319 | 글자 | 4.5:1 | 12.36:1 | 통과 | 사진 설명 |
| `--mj-on-kakao` #191919 | `--mj-kakao` #fee500 | 글자 | 4.5:1 | 13.75:1 | 통과 | 카카오 단추(꺼진 모양이라 예외 · 참고) |
| `--mj-line-control` #7f8a99 | `--mj-surface` #ffffff | 글자 아닌 것 | 3.0:1 | 3.50:1 | 통과 | 입력 · 체크 · 끌어다 놓기 테두리 |
| `--mj-line-control` #7f8a99 | `--mj-field-bg` #f8f9fb | 글자 아닌 것 | 3.0:1 | 3.32:1 | 통과 | 입력 테두리 안쪽 |
| `--mj-line-control` #7f8a99 | `--mj-bg` #ffffff | 글자 아닌 것 | 3.0:1 | 3.50:1 | 통과 | 바탕 위 입력 테두리 |
| `--mj-line-control` #7f8a99 | `--mj-fill` #f1f3f6 | 글자 아닌 것 | 3.0:1 | 3.15:1 | 통과 | 나눔 칸 바닥 위 테두리 |
| `--mj-focus` #1b66d8 | `--mj-surface` #ffffff | 글자 아닌 것 | 3.0:1 | 5.33:1 | 통과 | 초점 테두리 |
| `--mj-focus` #1b66d8 | `--mj-bg` #ffffff | 글자 아닌 것 | 3.0:1 | 5.33:1 | 통과 | 바탕 위 초점 테두리 |
| `--mj-primary` #1b66d8 | `--mj-surface` #ffffff | 글자 아닌 것 | 3.0:1 | 5.33:1 | 통과 | 고른 칩 · 가능 날 테두리 · 켜진 스위치 |
| `--mj-primary` #1b66d8 | `--mj-primary-weak` #ebf2fe | 글자 아닌 것 | 3.0:1 | 4.74:1 | 통과 | 고른 칩 테두리(안쪽) |
| `--mj-primary` #1b66d8 | `--mj-fill` #f1f3f6 | 글자 아닌 것 | 3.0:1 | 4.80:1 | 통과 | 고른 나눔 칸 테두리 |
| `--mj-danger` #db212d | `--mj-surface` #ffffff | 글자 아닌 것 | 3.0:1 | 4.92:1 | 통과 | 오류 칸 테두리 |
| `--mj-st-todo` #1b66d8 | `--mj-surface` #ffffff | 글자 아닌 것 | 3.0:1 | 5.33:1 | 통과 | 상태 ● 할 일 |
| `--mj-st-wait` #b35900 | `--mj-surface` #ffffff | 글자 아닌 것 | 3.0:1 | 4.83:1 | 통과 | 상태 ○ 기다림 |
| `--mj-st-ok` #038046 | `--mj-surface` #ffffff | 글자 아닌 것 | 3.0:1 | 5.02:1 | 통과 | 상태 ✓ 확정 |
| `--mj-st-done` #616c7b | `--mj-surface` #ffffff | 글자 아닌 것 | 3.0:1 | 5.33:1 | 통과 | 상태 – 끝남 |
| `--mj-st-late` #db212d | `--mj-surface` #ffffff | 글자 아닌 것 | 3.0:1 | 4.92:1 | 통과 | 상태 ! 기한 지남 |
| `--mj-st-todo` #1b66d8 | `--mj-primary-weak` #ebf2fe | 글자 아닌 것 | 3.0:1 | 4.74:1 | 통과 | 고른 줄 안 ● 할 일 |
| `--mj-st-wait` #b35900 | `--mj-primary-weak` #ebf2fe | 글자 아닌 것 | 3.0:1 | 4.29:1 | 통과 | 고른 줄 안 ○ 기다림 |
| `--mj-st-ok` #038046 | `--mj-primary-weak` #ebf2fe | 글자 아닌 것 | 3.0:1 | 4.47:1 | 통과 | 고른 줄 안 ✓ 확정 |
| `--mj-st-done` #616c7b | `--mj-primary-weak` #ebf2fe | 글자 아닌 것 | 3.0:1 | 4.74:1 | 통과 | 고른 줄 안 – 끝남 |
| `--mj-st-late` #db212d | `--mj-primary-weak` #ebf2fe | 글자 아닌 것 | 3.0:1 | 4.37:1 | 통과 | 고른 줄 안 ! 기한 지남 |
| `--mj-proposed` #b35900 | `--mj-surface` #ffffff | 글자 아닌 것 | 3.0:1 | 4.83:1 | 통과 | 제안한 날 테두리 |
| `--mj-proposed` #b35900 | `--mj-range-wish` #ebf2fe | 글자 아닌 것 | 3.0:1 | 4.29:1 | 통과 | 희망 띠 안 제안한 날 테두리 |
| `--mj-proposed` #b35900 | `--mj-range-vendor` #cfe1fe | 글자 아닌 것 | 3.0:1 | 3.65:1 | 통과 | 업체 띠 안 제안한 날 테두리 |
| `--mj-step-done` #4f8ff1 | `--mj-surface` #ffffff | 글자 아닌 것 | 3.0:1 | 3.22:1 | 통과 | 단계 막대 · 끝난 단계 |
| `--mj-step-now` #1b66d8 | `--mj-surface` #ffffff | 글자 아닌 것 | 3.0:1 | 5.33:1 | 통과 | 단계 막대 · 지금 단계 |
| `--mj-accent-fill` #307aeb | `--mj-surface` #ffffff | 글자 아닌 것 | 3.0:1 | 4.11:1 | 통과 | 공정표 막대 |
| `--mj-star` #c48200 | `--mj-surface` #ffffff | 글자 아닌 것 | 3.0:1 | 3.21:1 | 통과 | 별(리뷰 쓰기 고른 별) |
| `--mj-line-control` #7f8a99 | `--mj-white` #ffffff | 글자 아닌 것 | 3.0:1 | 3.50:1 | 통과 | 스위치 끔: 바탕과 동그라미 |
| `--mj-count` #db212d | `--mj-surface` #ffffff | 글자 아닌 것 | 3.0:1 | 4.92:1 | 통과 | 안 읽은 알림 점 |

## 2. 대비 · 회색 바탕에서 달라지는 짝

`--mj-bg`가 #f1f3f6이 되는 짝만 적어요(나머지 77짝은 1번과 같은 값).

| 앞(글자 · 선) | 바탕 | 종류 | 기준 | 대비 | 결과 | 쓰는 곳 |
| --- | --- | --- | --- | --- | --- | --- |
| `--mj-text` #1b222c | `--mj-bg` #f1f3f6 | 글자 | 4.5:1 | 14.40:1 | 통과 | 본문 · 제목 · 금액(페이지 바탕) |
| `--mj-text-sub` #495563 | `--mj-bg` #f1f3f6 | 글자 | 4.5:1 | 6.84:1 | 통과 | 묶음 밖 설명(바탕 위) |
| `--mj-text-mute` #616c7b | `--mj-bg` #f1f3f6 | 글자 | 4.5:1 | 4.80:1 | 통과 | 묶음 밖 각주(바탕 위) |
| `--mj-link` #1b66d8 | `--mj-bg` #f1f3f6 | 글자 | 4.5:1 | 4.80:1 | 통과 | 묶음 밖 글자 단추 |
| `--mj-line-control` #7f8a99 | `--mj-bg` #f1f3f6 | 글자 아닌 것 | 3.0:1 | 3.15:1 | 통과 | 바탕 위 입력 테두리 |
| `--mj-focus` #1b66d8 | `--mj-bg` #f1f3f6 | 글자 아닌 것 | 3.0:1 | 4.80:1 | 통과 | 바탕 위 초점 테두리 |

## 3. 9판 값으로 같은 짝을 계산하면(실패 40)

`--nine`은 9판 `screens.css`가 실제로 쓴 색을 같은 자리에 넣어요(예: 보조 글자 `.k-sm` #8b95a1, 단추 `.k-btn` #3182f6, 체크 `.k-ck` #d1d6db, 입력 `.k-in` 바탕 #f2f4f6).

| 쓰는 곳 | 앞 | 바탕 | 대비 |
| --- | --- | --- | --- |
| 시각 · 범례 · 각주 | `--mj-text-mute` #8b95a1 | `--mj-surface` #ffffff | 3.04:1 |
| 묶음 밖 각주(바탕 위) | `--mj-text-mute` #8b95a1 | `--mj-bg` #f2f4f6 | 2.76:1 |
| 말풍선 안 '자동 답변' · 파일 크기 | `--mj-text-mute` #8b95a1 | `--mj-fill` #f2f4f6 | 2.76:1 |
| 답글 · 인용 안 날짜 | `--mj-text-mute` #8b95a1 | `--mj-surface-sub` #f9fafb | 2.91:1 |
| 고른 줄(작업함 표) 안 보조 글자 | `--mj-text-mute` #8b95a1 | `--mj-primary-weak` #e8f3ff | 2.71:1 |
| 입력 칸 자리 글자 | `--mj-text-placeholder` #b0b8c1 | `--mj-field-bg` #f2f4f6 | 1.82:1 |
| 주 단추 글자 · 내 말풍선 · 고른 날 | `--mj-on-primary` #ffffff | `--mj-primary` #3182f6 | 3.71:1 |
| 약한 단추 · 고른 칩 · 안내 상자 | `--mj-on-primary-weak` #3182f6 | `--mj-primary-weak` #e8f3ff | 3.31:1 |
| 약한 단추 올림 | `--mj-on-primary-weak` #3182f6 | `--mj-primary-weak-hover` #c9e2ff | 2.80:1 |
| 글자 단추 · 자세히 › | `--mj-link` #3182f6 | `--mj-surface` #ffffff | 3.71:1 |
| 묶음 밖 글자 단추 | `--mj-link` #3182f6 | `--mj-bg` #f2f4f6 | 3.37:1 |
| 말풍선 안 글자 단추 | `--mj-link` #3182f6 | `--mj-fill` #f2f4f6 | 3.37:1 |
| 고른 줄 안 글자 단추 | `--mj-link` #3182f6 | `--mj-primary-weak` #e8f3ff | 3.31:1 |
| 배지 · 지금 | `--mj-badge-now-fg` #3182f6 | `--mj-badge-now-bg` #e8f3ff | 3.31:1 |
| 배지 · 기다림 · 기한 가까움 | `--mj-badge-wait-fg` #e07b00 | `--mj-badge-wait-bg` #fff3e0 | 2.73:1 |
| 배지 · 확정 | `--mj-badge-ok-fg` #03a65e | `--mj-badge-ok-bg` #e5f7ed | 2.85:1 |
| 배지 · 지남 · 거절 | `--mj-badge-bad-fg` #f04452 | `--mj-badge-bad-bg` #ffeeee | 3.31:1 |
| 배지 · 준비 중 · 닫힘 | `--mj-badge-mute-fg` #6b7684 | `--mj-badge-mute-bg` #f2f4f6 | 4.19:1 |
| 칸 아래 오류 글자 | `--mj-danger` #f04452 | `--mj-surface` #ffffff | 3.71:1 |
| 위험 단추(거절 · 탈퇴) | `--mj-on-danger` #ffffff | `--mj-danger` #f04452 | 3.71:1 |
| 오류 줄 글자 | `--mj-on-danger-weak` #f04452 | `--mj-danger-weak` #ffeeee | 3.31:1 |
| 경고 줄 안 보조 글자 | `--mj-text-mute` #8b95a1 | `--mj-warn-weak` #fff3e0 | 2.77:1 |
| 안 읽은 수 | `--mj-on-count` #ffffff | `--mj-count` #f04452 | 3.71:1 |
| 제안한 날 글자 | `--mj-proposed-text` #e07b00 | `--mj-surface` #ffffff | 3.00:1 |
| 고른 제안 반나절 | `--mj-on-proposed` #ffffff | `--mj-proposed` #e07b00 | 3.00:1 |
| 일요일 · 공휴일 날짜 | `--mj-holiday` #f04452 | `--mj-surface` #ffffff | 3.71:1 |
| 업체 가능 띠 안 일요일 | `--mj-holiday` #f04452 | `--mj-range-vendor` #c9e2ff | 2.80:1 |
| 파일 종류 PDF | `--mj-ext-pdf` #f04452 | `--mj-surface` #ffffff | 3.71:1 |
| 파일 종류 XLS | `--mj-ext-xls` #03a65e | `--mj-surface` #ffffff | 3.17:1 |
| 파일 종류 JPG | `--mj-ext-img` #3182f6 | `--mj-surface` #ffffff | 3.71:1 |
| 입력 · 체크 · 끌어다 놓기 테두리 | `--mj-line-control` #d1d6db | `--mj-surface` #ffffff | 1.46:1 |
| 입력 테두리 안쪽 | `--mj-line-control` #d1d6db | `--mj-field-bg` #f2f4f6 | 1.33:1 |
| 바탕 위 입력 테두리 | `--mj-line-control` #d1d6db | `--mj-bg` #f2f4f6 | 1.33:1 |
| 나눔 칸 바닥 위 테두리 | `--mj-line-control` #d1d6db | `--mj-fill` #f2f4f6 | 1.33:1 |
| 제안한 날 테두리 | `--mj-proposed` #e07b00 | `--mj-surface` #ffffff | 3.00:1 |
| 희망 띠 안 제안한 날 테두리 | `--mj-proposed` #e07b00 | `--mj-range-wish` #e8f3ff | 2.67:1 |
| 업체 띠 안 제안한 날 테두리 | `--mj-proposed` #e07b00 | `--mj-range-vendor` #c9e2ff | 2.26:1 |
| 별(리뷰 쓰기 고른 별) | `--mj-star` #ffb800 | `--mj-surface` #ffffff | 1.73:1 |
| 스위치 끔: 바탕과 동그라미 | `--mj-line-control` #d1d6db | `--mj-white` #ffffff | 1.46:1 |
| 9판 입력 칸: 테두리 없이 바탕색으로만 구분 | `--mj-field-bg` #f2f4f6 | `--mj-surface` #ffffff | 1.10:1 |

## 4. 글자 너비 어림

Pretendard는 이번에 내려받지 않아서, 이 PC에 있는 Noto Sans KR 가변(Bold · 큰 숫자는 Black)과 맑은 고딕 굵게로 쟀어요. 실제 Pretendard와 몇 % 다를 수 있어요.

| 무엇 | 글 | Noto Sans KR VF | 맑은 고딕 굵게 | 들어갈 자리(360px 폰) | 판단 |
| --- | --- | --- | --- | --- | --- |
| 금액 큰 숫자 28px | 197만 4,069원 | 186px | 185px | 묶음 안 288px | 들어감 |
| 금액 큰 숫자 28px(긴 값) | 1,234만 5,678원 | 212px | 208px | 288px | 들어감 |
| 금액 큰 숫자 38px(웹) | 1,234만 5,678원 | 289px | 285px | 웹 본문 640px 이상 | 들어감 |
| 단계 이름 13px | 표준견적서 | 60px | 65px | 한 칸 약 44px(288 − 틈 20을 6칸) | **안 들어감** → 폰은 지금 단계만 |
| 단계 이름 13px | 업체 담기 | 51px | 57px | 약 44px | **안 들어감** |
| 탭 바 13px | 업체 정보 | 51px | 57px | 업체 4칸 한 칸 90px | 들어감 |
| 달력 칸 아래 13px | 오후 잡힘 | 51px | 57px | 칸 약 41px(288 ÷ 7) | **안 들어감** → 두 글자까지 |
| 달력 칸 아래 13px | 오전 | 24px | 26px | 약 41px | 들어감 |
| 머리 제목 18px | 결도배가 제안한 날 | 144px | 156px | 360 − ‹ 44 − 오른쪽 글자 단추 약 110 ≈ 200px | 들어감(넘치면 말줄임) |
| 주 단추 16px | 고른 2곳에 요청 보내기 | 156px | 171px | 단추 328px | 들어감 |

<details><summary>글자 너비 어림 스크립트(scratchpad에서 돌림)</summary>

```python
from PIL import ImageFont  # Pillow 12.3
cases = [("197만 4,069원", 28), ("1,234만 5,678원", 28), ("1,234만 5,678원", 38), ("표준견적서", 13),
         ("업체 담기", 13), ("업체 정보", 13), ("오후 잡힘", 13), ("오전", 13), ("결도배가 제안한 날", 18),
         ("고른 2곳에 요청 보내기", 16)]
for path in (r"C:/Windows/Fonts/NotoSansKR-VF.ttf", r"C:/Windows/Fonts/malgunbd.ttf"):
    for text, size in cases:
        f = ImageFont.truetype(path, size)
        if "VF" in path:
            f.set_variation_by_name("Black" if size >= 28 else "Bold")
        print(path[-18:], text, size, round(f.getlength(text)))
```
</details>

<details><summary>클래스 세기 스크립트(scratchpad에서 돌림)</summary>

```python
import re, os, collections
d = r"C:/Workspace/SKN34/wt-v3/docs/v3/design/screens"
use = collections.defaultdict(set)
for f in os.listdir(d):
    if f.endswith(".html"):
        num = f.split("_")[0]
        for cl in re.findall(r'class="([^"]+)"', open(os.path.join(d, f), encoding="utf-8").read()):
            parts = cl.split()
            use[parts[0]].add(num)
            for p in parts[1:]:
                use[parts[0] + "." + p].add(num)
# 예: sorted(use["k-cta"]) → 아래 단추 띠를 쓰는 화면 40곳
```
</details>

## 5. 검증 대기(아직 못 돌린 것과 까닭)

| 무엇 | 까닭 | 언제 · 어떻게 |
| --- | --- | --- |
| 화면에 그린 대비(axe) | 프런트 코드를 아직 안 고침(이번 단계는 설계) | 공용 컴포넌트를 만든 뒤 앱 안 브라우저 + axe |
| 360px · 1280px 가로 스크롤 · 누를 곳 크기 | 같음 | 핵심 이야기 J1 · J3 · J5 · J7 · J10 · J22를 시험 너비마다 |
| 옆 AI 칸 낮은 창(높이 500 · 600) | 같음 | 웹 D01 · D03 · D15에서 입력 칸이 창 안에 보이는지 |
| Pretendard 글꼴 크기 · 흔들림(CLS) · tnum | 글꼴을 내려받지 않음(지시: 내려받기 말고 방법만) | design-01 '넣는 법' 뒤 Network 합계 · Lighthouse CLS · 숫자 너비 비교 |
| KWCAG 2.2 원문 항목 대조 | 원문을 찾지 못함 · 이번 턴 웹 검색 한도가 다 참 | 다음 턴에 원문(방송통신표준심의회) 확인 |
