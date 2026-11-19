# 믿집 v3 디자인 체계 (B · 큰 숫자)

- 쓴 날: 2026-11-18 · 쓴 역할: 디자이너 · 상태: 설계 + 1차 제작(B4, 2026-11-18: 토큰 · 껍데기 · 핵심 ui 조각)
- 코드 자리(실제): 토큰 `frontend/app/tokens.css`(layout.tsx가 globals.css보다 먼저 불러요) · 옛 이름 별칭 · 바탕 규칙 `frontend/app/globals.css` · 글꼴 `frontend/app/layout.tsx` · ui 조각 `frontend/components/ui/<이름>.tsx` · 껍데기(머리 · 탭 바 · 공사 띠 · 본문 틀 · 옆 칸 자리) `frontend/components/site/` · 조각 모음 화면 `/dev/ui`(개발에서만) · 쓰는 법 [ui-components.md](ui-components.md) · 검증 [verification/b4.md](verification/b4.md)
- 바탕 자료: 9판 화면 109개(`design/screens.md` · `design/screens/*.html` · `design/screens.css`), 디자인 방향 판 B, 웹 화면 고르기(W1~W9), 9판 결정(N1~N4 · D · I), 지금 `frontend/app/globals.css`
- 같이 보는 것: 토큰 초안 [`design/tokens.draft.css`](design/tokens.draft.css) · 점검 스크립트 [`design/check_contrast.py`](design/check_contrast.py) · 결정 [`adr/design-01-font.md`](adr/design-01-font.md) · [`design-02-tokens.md`](adr/design-02-tokens.md) · [`design-03-layout.md`](adr/design-03-layout.md) · [`design-04-icons.md`](adr/design-04-icons.md) · 검증 [`verification/design.md`](verification/design.md)

## 0. 한눈에

| 무엇 | 정한 것 |
| --- | --- |
| 방향 | B 큰 숫자(사용자가 고름, 잠정). 화면마다 부가세 포함 총액 하나를 가장 크게 먼저 |
| 바탕 | 흰 바탕 · 서류형(사용자 기존 결정). 9판의 회색 바탕 + 흰 묶음은 `data-canvas="gray"` 한 줄로 바꿀 수 있게 둠 → **사용자 확인 필요**(design-02) |
| 색 | 파랑 하나 + 회색 단계 + 상태 5색(작은 아이콘 · 배지에만). 9판 파랑 #3182F6은 흰 글자 대비 3.71:1이라 단추 · 글자는 #1B66D8(5.33:1)로 |
| 글꼴 | Pretendard Variable 자체 호스팅(가변 다이나믹 서브셋, OFL) · 금액 · 날짜는 고정폭 숫자 (design-01) |
| 글자 크기 | 13 · 14 · 16 · 18 · 20 · 28 · 38 일곱 단계만(사용자 결정). 본문 16. 9판의 26가지 크기를 일곱으로 모음 |
| 누를 곳 | 44px 기본, 촘촘한 곳(표 · 칩 · 달력 칸) 최소 40px |
| 대비 | 글자 4.5:1, 테두리 · 아이콘 · 상태 표시 3:1 — 토큰 83짝 모두 통과(흰 바탕 · 회색 바탕 둘 다) |
| 배치 | 같은 경로 · 같은 코드. 폰 < 768 · 태블릿 768~1023 · 웹 ≥ 1024(본문 + 옆 칸) · 넓은 웹 ≥ 1280 (design-03) |
| 아이콘 | 자체 `Icon` 컴포넌트 하나(24 격자 · 선 1.8 · currentColor). 모자란 모양은 Lucide(ISC)에서 경로만 옮김 (design-04) |
| 어두운 화면 | 1차는 안 해요(밝은 화면만, `color-scheme: only light`). 의미 토큰 층이 나중 자리 |

## 1. 원칙

1. **총액 하나를 크게.** 화면마다 가장 중요한 금액(부가세 포함) 하나만 큰 숫자로 써요. 큰 숫자가 둘이면 하나를 중간(20)으로 내려요.
2. **서류는 서류처럼.** 견적서 줄은 이름 · 산식 · 금액을 줄로 맞추고, 합계 위에 2px 진한 줄을 둬요. 금액은 고정폭 숫자 · 오른쪽 정렬이에요.
3. **파랑은 누르는 것에만.** 글자 단추 · 주 단추 · 고른 것 · 지금 단계에만 파랑을 써요. 꾸밈 색은 없어요.
4. **색만으로 알리지 않아요.** 상태는 아이콘 · 모양 + 글자가 늘 함께예요(N4 C · Carbon · KRDS).
5. **AI 티를 빼요.** 보라 그라데이션 · 반짝이 아이콘 · 이모지 · 카드 속 카드 없음. AI 입구는 글자 'AI에게 묻기', 답에는 '자동 답변'(디자인 방향 판의 네 방향 공통 규칙).
6. **폰이 먼저, 웹은 넓힌 것.** 같은 경로 · 같은 내용 · 같은 단추 이름. 웹은 옆 칸 · 표 · 작은 메뉴로 넓은 화면을 써요.
7. **숫자는 계산 엔진만.** 화면 · AI는 금액 · 날짜를 만들지 않고 모양만 바꿔요(`lib/format.ts`).

## 2. 토큰

### 2.1 구조

- 층 3개(DTCG 안정판 2025.10의 별칭 · 테마 구조와 같은 생각, 근거 22).

  | 층 | 예 | 누가 씀 |
  | --- | --- | --- |
  | 1층 기본 값 | `--mj-gray-500` · `--mj-blue-600` · `--mj-size-16` · `--mj-space-16` | 2층만 가리켜요. 화면 CSS에서 직접 안 써요 |
  | 2층 의미 | `--mj-text-sub` · `--mj-primary` · `--mj-line-control` · `--mj-type-body` · `--mj-radius-group` | 화면 · 컴포넌트 CSS |
  | 3층 컴포넌트 | `--mj-btn-h-lg` · `--mj-field-h` · `--mj-cal-cell-h` | 해당 컴포넌트 |

- 이름: `--mj-` + 역할(영어). 바탕 짝은 `--mj-on-…`(예: `--mj-primary` 위 글자 = `--mj-on-primary`).
- 예외 하나: 간격 `--mj-space-*`는 1층이지만 컴포넌트에서 바로 써요(뜻 이름보다 숫자가 덜 헷갈려서).
- 기준점에 따라 바뀌는 값(`--mj-type-amount` 28 → 38 등)은 2층에서 미디어 쿼리로 바꿔요. 컴포넌트는 같은 이름만 써요.
- 회색 바탕 모드는 2층 두 개(`--mj-bg` · `--mj-group-edge`)만 바꿔요.

### 2.2 색

#### 1층 팔레트 (흰 바탕 대비)

9판은 토스 TDS 팔레트 값을 그대로 썼어요. TDS 자료는 앱인토스 범위 안에서만 쓰게 돼 있어서(근거 4) 믿집 값을 따로 만들었어요. 색상각은 9판과 같게 두고, 단계마다 **흰 바탕 대비가 정해진 값**이 되게 밝기를 맞췄어요(KRDS가 단계 숫자로 대비를 말하게 하는 방식, 근거 14).

| 단계 | 회색 | 대비 | 파랑 | 대비 | 쓰는 데 |
| --- | --- | --- | --- | --- | --- |
| 50 | #f8f9fb | 1.05 | #ebf2fe | 1.13 | 옅은 칸 · 고른 칩 바탕 |
| 100 | #f1f3f6 | 1.11 | #cfe1fe | 1.32 | 채움 · 회색 바탕 / 업체 가능 띠 |
| 200 | #e3e6eb | 1.25 | #9ec3fb | 1.80 | 줄 |
| 300 | #ced3da | 1.50 | #75a8f6 | 2.42 | 어두운 띠 위 보조 글자 |
| 400 | #acb3be | 2.11 | #4f8ff1 | 3.22 | 꺼진 것 / 끝난 단계 막대 |
| 500 | #7f8a99 | 3.50 | #307aeb | 4.11 | 입력 · 체크 테두리 / 공정표 막대 |
| 600 | #616c7b | 5.33 | #1b66d8 | 5.33 | 가장 옅은 글자 / **주 색** |
| 700 | #495563 | 7.60 | #1856b4 | 6.93 | 보조 글자 / 올림 · 약한 단추 글자 |
| 800 | #313c49 | 11.21 | #17478e | 9.02 | 어두운 띠 / 누름 |
| 900 | #1b222c | 16.01 | #143568 | 12.08 | 본문 |

상태 색: 빨강 600 #db212d(4.92) · 700 #b9212b · 50 #fff0f1, 초록 600 #038046(5.02) · 700 #036b3b · 50 #ecf9f3, 주황 600 #b35900(4.83) · 700 #984c00 · 800 #7b3f03 · 50 #fff4ea, 별 #c48200(3.21), 사진 보기 바탕 gray-950 #101319. 쓰는 값만 두었어요(파랑만 50~900 전부).

#### 2층 의미 토큰

대비는 `python docs/v3/design/check_contrast.py`로 계산했어요(2026-11-18 실행, 흰 바탕 · 회색 바탕 모두 실패 0건). 아래는 대표 짝이고, 83짝 전부는 [verification/design.md](verification/design.md)에 있어요.

| 토큰 | 값 | 쓰는 곳 | 대비(흰 바탕 · 회색 바탕) |
| --- | --- | --- | --- |
| `--mj-bg` | #ffffff (회색 모드 #f1f3f6) | 페이지 바탕 | — |
| `--mj-surface` | #ffffff | 묶음 · 머리 · 옆 칸 · 창 | — |
| `--mj-surface-sub` | gray-50 | 인용 · 답글 · 펼친 답 · 끌어다 놓기 | — |
| `--mj-fill` | gray-100 | 칩 · 나눔 칸 바닥 · 말풍선 · 파일 줄 | — |
| `--mj-fill-strong` | gray-200 | 꺼진 단추 · 잡힌 반나절 | — |
| `--mj-field-bg` | gray-50 | 입력 칸 | — |
| `--mj-surface-inverse` | gray-800 | 진행 중 공사 띠 · 토스트 | 흰 글자 11.21 |
| `--mj-text` | gray-900 | 본문 · 제목 · 금액 | 16.01 · 14.40 |
| `--mj-text-sub` | gray-700 | 줄 아래 설명 · 라벨 · 칩 글자 | 7.60 · 6.84(채움 위 6.84) |
| `--mj-text-mute` | gray-600 | 시각 · 범례 · 각주 · 자리 글자 | 5.33 · 4.80(채움 위 4.80) |
| `--mj-text-disabled` | gray-400 | 꺼진 것만(대비 예외) | — |
| `--mj-line` | gray-200 | 칸 나눔 · 흰 바탕 묶음 테두리(꾸밈) | — |
| `--mj-line-control` | gray-500 | 입력 · 체크 · 스위치 끔 · 끌어다 놓기 테두리 | 3.50 · 3.15 (3:1 기준) |
| `--mj-line-ink` | gray-900 | 서류 합계 위 2px 줄 | — |
| `--mj-primary` · `--mj-on-primary` | blue-600 · 흰 | 주 단추 · 내 말풍선 · 고른 날 | 5.33 |
| `--mj-primary-weak` · `--mj-on-primary-weak` | blue-50 · blue-700 | 약한 단추 · 고른 칩 · 정보 상자 | 6.16 |
| `--mj-link` | blue-600 | 글자 단추 · 자세히 › | 5.33 · 4.80 |
| `--mj-focus` | blue-600, 3px | 초점 테두리 | 5.33 · 4.80 |
| `--mj-st-todo` · `wait` · `ok` · `done` · `late` | blue-600 · orange-600 · green-600 · gray-600 · red-600 | 상태 아이콘(N4 C) | 4.83~5.33 (고른 줄 위 4.29 이상) |
| `--mj-badge-{now,wait,ok,bad,mute}-{bg,fg}` | 50 단계 바탕 + 700 글자 | 배지 | 5.73~6.84 |
| `--mj-danger` · `--mj-on-danger` | red-600 · 흰 | 칸 아래 오류 · 오류 테두리 · 위험 단추 | 4.92 |
| `--mj-warn-weak` · `--mj-on-warn-weak` | orange-50 · orange-800 | 주의 줄(믿집 밖 거래) · 단가 경고 줄 | 7.59 |
| `--mj-count` · `--mj-on-count` | red-600 · 흰 | 안 읽은 수 | 4.92 |
| `--mj-proposed` · `--mj-proposed-text` | orange-600 · orange-700 | 제안한 날 테두리 · 글자 | 4.83 · 6.23 (업체 띠 위 테두리 3.65) |
| `--mj-holiday` | red-700 | 일요일 · 공휴일 날짜 | 6.33 · 업체 띠 위 4.78 |
| `--mj-range-wish` · `--mj-range-vendor` | blue-50 · blue-100 | 달력 희망 · 업체 가능 띠 | 띠 위 날짜 14.23 · 5.74 |
| `--mj-step-done` · `--mj-step-now` · `--mj-step-todo` | blue-400 · blue-600 · gray-200 | 단계 막대 | 3.22 · 5.33 |
| `--mj-accent-fill` | blue-500 | 공정표 막대(글자 아님) | 4.11 |
| `--mj-star` | #c48200 | 리뷰 쓰기 고른 별 | 3.21 |

- 카카오 단추(#fee500)는 연동 전이라 꺼진 모양만 둬요(대비 예외, 계산은 13.75).
- 9판 값 그대로 같은 짝(+ 9판 입력 칸 경계 1짝)을 계산하면 84짝 중 40짝이 기준을 못 넘어요(`--nine` 실행 결과, verification). 주로 보조 글자 #8b95a1(3.04) · 파랑 단추 흰 글자(3.71) · 배지 글자(2.73~3.31) · 입력 칸 경계(1.10) · 체크 테두리(1.46) · 별(1.73)이에요.

### 2.3 글자

- 글꼴: `--mj-font-sans` = Pretendard Variable → Pretendard → 시스템 글꼴(Apple SD Gothic Neo · Noto Sans KR · 맑은 고딕). 근거와 넣는 법은 design-01.
- 줄바꿈: `word-break: keep-all` + `overflow-wrap: break-word`(어절에서만 줄을 바꾸고, 긴 주소 · 파일 이름은 넘칠 때만 끊어요, 근거 32).
- 숫자: 금액 · 날짜 · 시각 · 수량은 `.mj-num`(`font-variant-numeric: tabular-nums`). Pretendard에 tnum이 **있어요**(GSUB `tnum`, 화면에서 28px '1,111,111원' = '8,888,888원' = 171.45px, verification/b4.md). 기본 숫자는 비례폭(127.66 vs 166.45px)이라 `.mj-num`을 꼭 붙여요.
- 크기 단계(rem, 1rem = 16px): 기기 글자 크기 설정을 따라가요(TDS · KRDS 모두 사용자 설정에 맞춰 커지게 함, 근거 1 · 13).

| 역할(토큰) | 폰 | 웹 ≥1024 | 굵기 | 줄 높이 | 9판에서 온 것 |
| --- | --- | --- | --- | --- | --- |
| 금액 큰 숫자 `--mj-type-amount` | 28 | 38 | 800 | 1.25 | `.k-big` 30 · `.k-big.xl` 36 |
| 첫 화면 제목 `--mj-type-hero` | 20 | 38 | 700 · 800 | 1.25 | `.k-h` 21 · `.k-dh` 42 |
| 웹 화면 제목 · 큰 줄 제목 · 중간 금액 `--mj-type-title` | 20 | 20 | 700~800 | 1.4 | `.k-h` 21 · `.k-wt` 22 · `.k-big.m` 23 · `.k-vp` 20 |
| 폰 머리 제목 · 묶음 제목 · 창 제목 `--mj-type-title-s` | 18 | 18 | 700 | 1.4 | `.k-ttl` 17 · `.k-h.s` 18 |
| 본문 · 줄 제목 · 줄 금액 · 단추 · 입력 · 말풍선 `--mj-type-body` | 16 | 16 | 400 · 600 · 700 | 1.5(한 줄) · 1.6(문단) | 14.5 · 15 · 15.5 · 16 |
| 라벨 · 줄 아래 설명 · 칩 · 작은 단추 · 표 칸 · 글자 단추 `--mj-type-label` | 14 | 14 | 400 · 600 | 1.5 | 13.5 · 14 · 14.5 |
| 시각 · 범례 · 각주 · 배지 · 탭 바 · 단계 이름 `--mj-type-caption` | 13 | 13 | 400~700 | 1.5 | 9 · 10 · 10.5 · 11 · 11.5 · 12 · 12.5 · 13 |

- 9판은 글자 크기를 26가지(9~42px) 썼어요. 일곱 단계로 모으면서 **13px 밑을 없앴고**, 그래서 두 곳은 모양을 바꿔요.
  - 폰 단계 이름(`.k-stepl` 10px): 13px '표준견적서'가 60px쯤이라(Noto Sans KR 굵게로 잼) 360px 폰의 한 칸 44px에 안 들어가요 → 폰은 막대 6칸 + '지금 3/6 · 업체 담기' 한 줄만, 이름 여섯은 화면 읽기용 목록으로.
  - 폰 달력 칸 아래 글(`.k-cal em` 9px): 13px '오후 잡힘'이 51px쯤이라 칸 41px에 안 들어가요 → 칸 아래는 두 글자(오전 · 오후 · 마감 · 신정 · 희망)까지, 자세한 것은 '고른 날' 칸에서.
- 굵기는 400 · 600 · 700 · 800 넷만(800은 큰 숫자만). KRDS도 굵기는 넷 안팎을 권해요(근거 13).
- 자간: 큰 숫자 −0.03em, 제목 −0.02em, 본문 0.
- 문단 한 줄은 40em(한글 40자 안팎)까지(`--mj-read-max`, W3C 1.4.8 · 웹 화면 고르기 조사).
- 웹 화면 제목: W1 A 설명은 '22px 굵게'였는데 22는 일곱 단계 밖이라 20px 800으로 맞췄어요 → **사용자 확인 필요**(작은 차이).

### 2.4 간격

- 1층: 2 · 4 · 6 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64(px). 2 · 6은 줄 안 아이콘-글자 틈에만.
- 2층

  | 토큰 | 폰 | 태블릿 ≥768 | 넓은 웹 ≥1280 | 쓰는 곳 |
  | --- | --- | --- | --- | --- |
  | `--mj-gutter` | 16 | 24 | 28 | 화면 옆 여백(+ 안전 영역과 큰 쪽) |
  | `--mj-gap-group` | 12 | 16 | 16 | 묶음 사이 |
  | `--mj-pad-group` | 20 | 20 | 20 | 묶음 안쪽 |
  | `--mj-content-max` | — | — | 1200 | 본문 + 옆 칸 최대 |
  | `--mj-aside-w` | — | — | 320(1024~1279) · 344 | 옆 칸 너비 |

- 묶음 안 줄(목록 한 줄)은 위아래 14 + 줄 높이 → 한 줄 최소 52px(누를 줄이면 그대로 누를 곳).

### 2.5 모서리

| 토큰 | 값 | 쓰는 곳 | 9판 |
| --- | --- | --- | --- |
| `--mj-radius-paper` | 2 | 인쇄 · 이미지로 저장하는 서류 한 장 | (v2 서류) |
| `--mj-radius-badge` | 6 | 배지 · 작은 태그 | 7 |
| `--mj-radius-chip` | 10 | 고르기 칩 · 나눔 칸 안 칸 | 9 · 10 |
| `--mj-radius-field` | 12 | 입력 칸 · 작은 단추 · 사진 | 12 |
| `--mj-radius-btn` · `-btn-lg` | 14 · 16 | 단추 44 · 52 | 12 · 16 |
| `--mj-radius-card` | 16 | 묶음 안 카드 · 파일 줄 · 안내 상자 | 14 · 16 |
| `--mj-radius-group` | 20 | 묶음 · 옆 AI 칸 | 20 |
| `--mj-radius-sheet` | 24 | 아래 시트(위 모서리) · 가운데 창 | 24 |
| `--mj-radius-pill` | 999 | 알약 · 안 읽은 수 · 시스템 줄 | 999 |

### 2.6 그림자 · 줄

- B는 그림자 없이 바탕 · 줄로 묶어요. 그림자는 **떠 있는 것**(작은 메뉴 · 알림 펼침 · 가운데 창 · 아래 시트 · 토스트)에만.

  | 토큰 | 값 | 쓰는 곳 |
  | --- | --- | --- |
  | `--mj-group-edge` | 안쪽 1px `--mj-line`(회색 모드는 없음) | 흰 바탕일 때 묶음 테두리 |
  | `--mj-edge-top` · `--mj-edge-bottom` | 1px `--mj-line` | 아래 단추 띠 · 탭 바 / 머리 · 공사 띠 |
  | `--mj-shadow-raise` | 0 1px 3px | 나눔 칸 고른 칸 |
  | `--mj-shadow-pop` | 0 12px 32px −10px + 1px 테두리 | 작은 메뉴 · 알림 펼침 |
  | `--mj-shadow-overlay` | 0 24px 48px −16px | 가운데 창 · 아래 시트 |

### 2.7 움직임

| 무엇 | 시간 · 곡선 | 줄인 움직임(`prefers-reduced-motion`) |
| --- | --- | --- |
| 단추 누름(0.98배) · 올림 바탕 | 120ms · `--mj-ease-out` | 크기 변화 없음 |
| 작은 메뉴 · 가운데 창 나타남(투명도 + 0.98→1) | 200ms | 바로 나타남 |
| 아래 시트 올라옴 · 옆 칸 접기 | 280ms | 바로 |
| 토스트 | 200ms 들어옴 · 4초 뒤 나감 | 바로 |

- 반짝이 · 튀는 움직임 · 무한 반복은 쓰지 않아요. 불러오는 중은 회색 줄(gray-100) 자리만, 깜빡임 없이.

### 2.8 층 · 기준점

- 층: 붙는 띠 10 · 머리 20 · 작은 메뉴 30 · 창 40 · 토스트 50 · 건너뛰기 링크 60.
- 기준점(미디어 쿼리, 변수로 못 써서 값으로 적어요)

  | 이름 | 너비 | 배치 | 근거 |
  | --- | --- | --- | --- |
  | 폰 | < 768 | 한 줄 · 아래 탭 바 · 아래 단추 띠 · 전체 화면 AI | 한국 폰 너비 414(21.3%) · 384 · 360(10.0%) · 412 · 390(2026.10, 근거 28) |
  | 태블릿 | 768~1023 | 웹 머리 · 본문 한 줄 · AI는 전체 화면 층 | Android 창 크기 600 · 840 경계(근거 27) |
  | 웹 | ≥ 1024 | 본문 + 옆 칸 320(AI 또는 요약) · 공사 띠 | 옆 칸 320 + 본문 640 이상 |
  | 넓은 웹 | ≥ 1280 | 옆 칸 344 · 옆 여백 28 · 본문 최대 1200 | 한국 데스크톱 1920(39.9%) · 2560 · 1536(근거 29) |

- 시험 너비: 360 · 390 · 414 · 430 · 768 · 1024 · 1280 · 1440. 낮은 창(높이 600 · 500)도 봐요(옆 AI 칸).

## 3. 컴포넌트

- 놓은 곳(실제, B4): `frontend/components/ui/<이름>.tsx` + 옆에 `<이름>.module.css`, 틀 · 이동(머리 · 탭 바 · 공사 띠 · 이동 경로 · 화면 제목 · 옆 칸 자리)은 `frontend/components/site/`. CSS는 2 · 3층 토큰만 써요(간격 `--mj-space-*`만 예외). 쓰는 법은 [ui-components.md](ui-components.md).
- 코드 이름이 이 표와 다른 것(routes.md 3장 이름을 따랐어요): `CalcNote` → `CalcBox` · `StatusLabel` · `StatusLegend` → `StateTag` · `StateLegend` · `VendorRow` → `VendorCard` · `ChoiceChip` → `ChoiceChips` · `AppHeader`(모양 `HeaderBar`) · `BigFigure` · `Money` 그대로. 1차에 만든 것: Icon · Button(+ TextLink는 `variant="text" | "inline"`) · IconButton · BottomBar · Field · TextArea · SelectField · ChoiceChips · Steps · SubSteps · Money · BigFigure · QuoteLines · CalcBox · VendorCard · ShortlistTray · CompareTable · StateTag · StateLegend · Badge · Count · DueBadge · Dialog · ConfirmDialog · Sheet · OptionRow · Menu · NotifyRow · NotifyList · EmptyState · FileDrop · Calendar · CalendarLegend · HalfDayPicker · Stars · StarInput · Toast, 껍데기 AppHeader · SiteHeader(옛 화면) · TabBar · ProjectBand · Main · PageHead · WithAside · AsidePanel · AsideOpenButton · NotifyBell. 2차에 만든 것: Tabs(`FilterPills`는 `variant="pill"` · 종류 알약은 `"type"`) · TabPanel · DataTable · CellText · ScrollBox · Segmented · Switch · Check · CheckGroup · SummaryRows · KeyValue · FileRow · Notice · Avatar · ResumeStrip · EventLog · Accordion · PhotoGrid, 껍데기 LiveProvider(실시간 한 줄기 자리) · SwRegister, PWA(manifest · 아이콘 · sw.js · /offline). 3차에 ScheduleChart(공정표 · 업체 일정 반나절 칸) · Lightbox(크게 보기). 아직 없는 것은 ui-components.md 5장.
- 화면 번호는 9판 조각 109개의 클래스를 세어 뽑았어요(verification '클래스 세기'). '거의 모든 화면'은 80곳 넘게 쓰는 것이에요.

### 3.1 틀 · 이동

| 컴포넌트(코드 이름) | 변형 | 상태 | 쓰는 화면 | 폰 / 웹 |
| --- | --- | --- | --- | --- |
| 머리 `AppHeader` | 역할: 고객 · 업체 · 관리자 / 폰: 로고형 · 뒤로형(‹ + 제목 + 오른쪽 글자 단추 하나) · 닫기형(× + 제목) · 어두운 형(사진 보기) / 웹: 메뉴형 | 지금 메뉴(`aria-current`) · 안 읽은 수 · 펼침(알림 · 이름 ▾) · 잠긴 메뉴(승인 전 업체) | 폰 86곳(C01~C63 · V01~V25) · 웹 23곳(A01~A04 · D01~D19) | 폰 52px · 제목 18 · ‹ 44×44 · 오른쪽 'AI에게 묻기' · ⋯ / 웹 64px · 로고 + 메뉴(고객: 표준견적서 받기(CF-09) · 내 공사 · 채팅 / 업체: 작업함 · 채팅 · 업체 정보(W6 B) / 관리자: 업체 심사 · 신고 · 링크 · 회원) + 오른쪽 알림 n · 이름 ▾. 앱 모드는 위 안전 영역만큼 내려와요 |
| 아래 탭 바 `TabBar` | 고객 5칸(홈 · 내 공사 · 채팅 · 알림 · 내 정보) · 업체 4칸(작업함 · 채팅 · 업체 정보 · 알림) | 지금 탭 · 안 읽은 수 | C23 C24 C40 C41 C42 C44 C45 C53 · V02 V03 V08 V19 V21 V24 V25 | 폰만. 64px + 아래 안전 영역 · 아이콘 24 + 글자 13(9판 11). 아래 단추 띠가 있는 흐름 화면에는 없어요. 웹은 머리 메뉴가 대신 |
| 공사 띠 `ProjectBand` (W1 A) | 6단계 · 실측 뒤 작은 단계(견적서 비교 · 업체 확정 · 공사 날짜 · 공사 · 끝 확인) | 끝난 · 지금 · 남은 단계 · 지금 할 일 1건 / 여러 건(▾ 펼침: 업체별 할 일 · 기다림) | D01 D03 D06 D07 D08 D15~D19 + 모든 웹 공사 화면 | 웹만. ≥1024 전부, 768~1023은 공사 이름 · 지금 단계 · 지금 할 일만. 폰은 머리 제목 + 내 공사 · 한 공사 화면의 `Steps`가 대신 |
| 이동 경로 `Breadcrumb` | — | 올림 · 초점(밑줄) · 지금 위치(진하게) | D01 D03 D06 D07 D08 D11~D19 | 웹만. 14 · 회색 · 밑줄 없음(사용자 결정). 폰은 머리 ‹ |
| 화면 제목 `PageTitle` | 제목 + 설명 · + 배지 · + 오른쪽 글자 단추 | — | A03 D01 D02 D03 D06 D08 D11~D19 | 웹 20/800 + 설명 14. 폰은 머리 제목 |
| 아래 단추 띠 `BottomBar` | 단추 하나(가득) · 둘(보조 \| 주, 1:1) · 위에 한 줄(설명 · 고른 것 요약 '마루와벽 · 12.15(화) 오전') | 단추 꺼짐 · 보내는 중 | 40곳(C02~C08 C11 C13 C16 C17 C19 C21 C35 C37~C39 C46 C50 C51 C54 C57 C59~C61 · V01 V04~V07 V10~V16 V18 V22 V23) | 폰: 아래 붙음 · 위 1px 줄 · 아래 안전 영역 · 단추 52. 웹: 본문 끝 오른쪽 정렬 · 단추 최소 160(늘어나지 않게, 작은 손질 4) |
| 진행 중 공사 띠 `ResumeStrip` | — | — | C40 C41 · 웹 D10 머리 아래(S5 A) | 어두운 띠(gray-800) · 흰 글자 16/700 · 파란 배지 · ›. 폰 홈 맨 위, 웹 머리 아래 한 줄 |
| 단계 `Steps` | 막대 6칸 · 실측 뒤 작은 단계 알약 | 끝남(blue-400) · 지금(blue-600 + 굵게) · 남음(gray-200) | C42 C43 D09 + 공사 띠 안 | 폰: 막대 + '지금 3/6 · 업체 담기'만(2.3) · 웹: 이름 여섯 다(13) |
| 탭 `Tabs` | 밑줄 탭 | 지금 탭(2px 진한 줄 · 굵게) | C11 D07(가견적 · 사례 · 리뷰) · C43 C63(요약 · 기록) | 44px · 16/600. 같음 |
| 거르기 알약 `FilterPills` | 글자만 · 상태 점 붙음 | 고름(gray-800 바탕 흰 글자) | A02 D04 V03 V08 V15 V16 V18 | 40px(9판 36) · 14/600. 폰은 옆으로 넘김, 웹 한 줄 |

### 3.2 누르기 · 넣기

| 컴포넌트 | 변형 | 상태 | 쓰는 화면 | 폰 / 웹 |
| --- | --- | --- | --- | --- |
| 단추 `Button` | 주 · 약한 · 보통(9판 gray) · 위험 · 카카오(준비 중, 꺼짐) / lg 52 · md 44 · sm 40 | 기본 · 올림 · 누름 · 초점 · 꺼짐(`aria-disabled`) · 보내는 중 | 87곳(거의 모든 화면) · 약한 C11 C33 C51 D03 D07 D12 D13 D18 V03 · 위험 A03 A04 C30 C53 · 카카오 C04 C06 C59 D13 | 폰: 아래 띠에서 가득 · 둘이면 1:1 / 웹: 글 길이 + 최소 160 · 오른쪽 정렬. 확인 창 왼쪽 단추는 '닫기'(토스 UX 가이드, 근거 5) |
| 글자 단추 `TextLink` (사용자 결정 세 역할) | 다른 화면 '자세히 ›'(파랑 + ›) · 이 화면 글자 단추(파랑, › 없음: 바꾸기 · 접기 · 요청 취소) · 글 속 얇은 밑줄(1px · 회색 글자: 리뷰 기준 · 보기) · 회색 | 올림 · 초점 · 꺼짐 | `k-tb` 61곳 · 글 속 밑줄 C01 C11 C39 C48 C49 D07 | 누를 곳 높이 44(글 속 밑줄은 WCAG 2.5.8 '글 속' 예외, 근거 17). 같음 |
| 입력 칸 `Field` · `TextArea` · `Select` | 한 줄 · 단위 붙음(㎡ · 원 · 만 원 · 일 · 평) · 여러 줄 · 고르기(▾) · 날짜 ▾ · 숫자 | 기본 · 초점(2px 파랑) · 오류(2px 빨강 + 칸 아래 글) · 꺼짐 · 잠김(읽기만, C50) | 19곳(A01~A04 C02 C03 C05 C06 C46 C51 D02 D11 V01 V05 V10 V12 V13 V15 V16) · 여러 줄 C39 V25 | 48px · 글자 16(iOS 확대 막음) · 1px 테두리 3.5:1(9판은 테두리 없이 바탕 1.10:1 → WCAG 1.4.11 실패, 근거 18) · 라벨 14/600 위 · 오류는 칸 아래만(사용자 결정) · 누를 때 한 번에 검사 → 첫 틀린 칸으로(I6 B). 웹: 최대 520 · 숫자 240 |
| 고르기 칩 `ChoiceChip` | 하나 고르기 · 여럿 고르기 · 준비 중(꺼짐 + '준비 중' 배지) · 제안(주황) | 기본 · 고름(파랑 바탕 + 1.5px 파랑 테두리) · 초점 · 꺼짐 | 27곳(C02 C03 C20 C33 C39 C48 C49 C52 C54 C58 D01 D06 D07 D11~D13 D15~D19 V01 V07 V10 V15 V24 V25) | 40px(9판 38) · 14/600. AI 빠른 질문 칩은 폰에서 옆으로 넘김(9판 34 → 40) |
| 나눔 칸 `Segmented` | 2~3칸(공급 \| 전용 · 실크 \| 합지 · 무료 \| 받아요 · 포함 \| 빼고 \| 면세 · 단가 \| 다른 줄에 포함 \| 빼기) | 고른 칸: 흰 바탕 + 1.5px 파랑 테두리 + 굵게 | A03 C02 C03 C11 C55 D02 D07 D11 V10 V12 V15 | 칸 40(9판 36). 9판은 그림자로만 고른 칸을 보여 3:1이 안 돼 테두리를 더했어요. 웹 최대 360 |
| 켜기/끄기 `Switch` | — | 끔(gray-500 바탕) · 켬(파랑) · 초점 | D14 V04 V05 V15 | 52×32 · 줄 전체가 누를 곳(44 이상) · `role="switch"` |
| 체크 `Check` · 고르기 줄 `OptionRow` | 둥근 · 네모 / 이유 고르기 줄 | 기본 · 고름(파랑 + 흰 ✓) · 초점 · 꺼짐 | 체크 A01 A02 A04 C05 C13 C30 C31 C36 D08 D19 V02 V05 · 줄 A01 A02 A04 C29 C30 C31 V05 | 24px · 2px 테두리 3.5:1(9판 1.46) · 줄 48 |
| 끌어다 놓기 칸 `FileDrop` (I9 A) | 사진 · 서류(PDF · 엑셀 · 사진) · 다시 올리기 | 기본 · 끌어 오는 중(파랑 테두리 · 문구 바뀜) · 올리는 중 · 오류(형식 · 크기) · 올림(사진 칸 · 파일 줄) | C13 C39 D08 V01 V10 V12 V13 V14 V16 | 폰: '눌러서 앨범 · 카메라에서 골라요'만 / 웹: 끌어다 놓기 + '파일 고르기' 단추. 칸 아래 안내 줄 없음. 점선 1.5px gray-500(9판 gray-300) |
| 달력 `Calendar` · 반나절 `HalfDayPicker` · 제안 칸 `SlotChips` · 범례 `CalendarLegend` | 날 하나씩(공사 날짜 C35 V11) · 기간(업체 기간 답하기 V04 D14) · 반나절 고르기 · 제안 고르기 | 날: 이번 달 · 다른 달 · 일 · 공휴일(빨강 글자) · 업체 가능(파랑 테두리) · 안 됨(옅게 + 가로줄, 꺼짐) · 고른 날(파랑 바탕) · 제안(주황 테두리) · 고른 제안(주황 바탕) · 잡힘(회색 바탕) · 희망 띠 · 업체 띠 · 오늘 / 반나절: 고름 · 제안 · 마감 | 달력 C16 C19 C21 C35 C61 D08 D14~D17 V04 V05 V11 · 반나절 C16 C19 C21 C61 D15 D16 · 제안 칸 C52 D17 V07 · 범례 12곳 | 폰: 칸 높이 40 · 동그라미 32 · 칸 아래 두 글자까지 / 웹: 칸 64 · 동그라미 42 · 칸 아래 13px 글 · 오른쪽 '고른 날' 칸. 지금 코드의 `@daypicker/react`를 그대로 쓰고 날 상태는 modifiers로. 날마다 읽어 줄 이름('12월 15일 화요일, 업체 가능, 오전만') |
| 별점 `Stars` · 리뷰 `ReviewItem` · 답글 `ReplyBox` · 태그 `TagList` | 보여 주기(숫자와 함께 · 꾸밈) · 고르기(리뷰 쓰기) | 고른 별 · 안 고른 별 · 초점 · 수정됨 | 고르기 C39 · 보여 주기 C10 C11 C48 C49 D06 D07 D18 V24 V25 | 고르기는 별 5개 단추 44×44(radiogroup), 고른 별 #c48200(3.21:1, 9판 #ffb800 1.73) · 안 고른 별 gray-500 테두리. 보여 주기는 '★ 4.8 (5)' 숫자가 주인공 |

### 3.3 금액 · 서류

| 컴포넌트 | 변형 | 상태 | 쓰는 화면 | 폰 / 웹 |
| --- | --- | --- | --- | --- |
| 큰 숫자 `BigFigure` · 금액 `Money` | 내용: 금액(대부분) · 날짜(C17 '12월 15일(화) 오전' · C36 · V06) · 기간(C08 '2일') · 별점(C48 C49 V24 V25 '★ 4.8') / 크기: 큰 숫자(28 · 웹 38, 800) · 중간(20, 800: 비교 카드 · 확인 창 · 업체 가견적) / 금액만: 차이('+5만 5,000원') · 없음('가견적 없음') · 줄 금액(16/700, 괄호 = 합계 밖) | 기본 · 지남(글자 회색 + '지났어요' 배지, 투명도는 안 써요) | 큰 숫자 37곳(C01 C07 C08 C11 C13 C17 C33~C38 C40 C41 C48 C49 C52 C57~C60 D01 D03 D07 D08 D10 D12~D19 V06 V24 V25) · 중간 23곳 · 업체 가견적 C10 C12 D06 | 큰 숫자는 '197만 4,069원'(만 단위로 띄어 씀, 근거 40) · 서류 줄은 '1,974,069원'(쉼표 · 고정폭). 늘 옆에 '부가세 포함'. 360px 폰에서 28px '1,234만 5,678원'이 212px쯤(잼) → 묶음 안 288px에 들어가요 |
| 견적서 줄 표 `QuoteLines` | 표준견적서 · 가견적(업체 단가 줄) · 부분 공사(어림) / 줄: 보통 · 합계 밖(괄호 · 회색) · 안 함(—) · 공급가 · 부가세 · 합계 | — | C01 C07 C11 C40 C41 C57~C60 D01 D07 D10 D12 D13 | 폰: 줄 목록(왼쪽 이름 16/600 + 아래 '130.1㎡ × 5,993원' 14, 오른쪽 금액 16/700) / 웹: 표(코드 · 줄 · 수량 · 단가 · 금액, 숫자 오른쪽). 담긴 칸이 560px보다 좁으면 줄 목록(컨테이너 쿼리). 합계 위 2px 진한 줄(서류형). 공급가 · 부가세를 나눠 보이는 곳은 합계 칸 하나 |
| 믿집 계산 상자 `CalcNote` | AI 답 안(흰 바탕) · 양식 안(gray-50) | — | C03 C09 D01 D03 D06 D07 D15 D16 D18 V10 V12 | '믿집 계산' 13/700 파랑 + 식 14 고정폭. 숫자는 계산 엔진 값만 |
| 비교표 `CompareTable` (W4 A) | 실측 일정(상태 · 날짜 · 다음 할 일 · 기한) · 실측 견적서(합계 · 업체가 적은 금액 · 가견적과 차이 · 공사 기간 · 포함됐나요 · 유효기간 · 실측 · 받은 날 · 리뷰 · 파일 · 확정) | 할 일 있는 열(옅은 파랑) · 빈 열('1곳 더 담을 수 있어요') · 유효기간 지난 열(회색 글자 + 배지 + '다시 받기') | 웹 D03 D18 · 폰 카드 C14 C15 C18 C20 C32 · C33 | 웹: 업체를 열로(최대 3), 첫 열 170 라벨 / 폰: 업체마다 카드를 세로로, 줄 순서는 같게 |
| 요약 칸 `KeyValue` · `SummaryRows` | 칸 위 이름 + 아래 값 · 왼쪽 이름 + 오른쪽 값 | — | KeyValue D14 D19 · SummaryRows C15 C17 C34 C61 D04 · 옆 칸들 | 같음 |
| 표 `DataTable` | 작업함(D04) · 관리자(A01~A04) · 단가(D02: 줄마다 나눔 칸 + 숫자 칸 + 계산 열) | 고른 줄(blue-50) · 경고 줄(주황 50) · 오류 줄(빨강 50) | A01~A04 D02 D03 D04 D07 D18 D19 | 웹: 머리 13/600 · 칸 14~16 · 줄 52 · 숫자 오른쪽 · 좁으면 옆으로 넘김 상자(초점 가능 + '옆으로 넘겨 볼 수 있어요') / 폰: 카드 목록(V03) |
| 공정표 `ScheduleChart` | 예상(C08: 날짜 머리 · 쉬는 날 회색 칸 · 공정마다 막대 한 줄) · 확정(C36 날마다 오전 · 오후 막대 / D19 반나절 칸 표) | 쉬는 날 · 공휴일 | C08 C36 D19 | 폰: 목록 · 웹: 표. 막대는 blue-500(글자 아님) 또는 blue-50 + blue-700 글자 |
| 기록 `EventLog` | — | — | C63 · V23 | 시각 13/700 · 누가 13/700 · 무엇 14. 같음 |
| 파일 줄 `FileRow` | PDF · 엑셀 · 사진 | 올리는 중 · 오류 | A01 A04 C33 D18 V01 V10 V14 | 종류 칸 40(PDF 빨강 · XLS 초록 · JPG 파랑 글자) · 이름 14/600 말줄임 · 크기 · '위치 정보 지움' 13 · '열기 ↗' / '빼기' |
| 사진 칸 `PhotoGrid` · 크게 보기 `Lightbox` | 보기 · 올림(× 빼기) | — | C11 C13 C37 C38 D04 D07 D14 V12 V13 V16 · 크게 보기 C47 | 폰 3열 · 웹 4~6열. 사진 위 글은 흰 바탕 라벨로(사진에 바로 글자를 얹지 않아요). 크게 보기: 폰 전체 화면 어두운 바탕 + 옆으로 넘김 / 웹 가운데 760 + ‹ › + Esc |

### 3.4 업체

| 컴포넌트 | 변형 | 상태 | 쓰는 화면 | 폰 / 웹 |
| --- | --- | --- | --- | --- |
| 업체 줄 `VendorRow` | 가견적 있음 · '바로 확정' 배지 · 가견적 준비 중 · 이 벽지는 안 해요 · 가까운 구(출장 여부는 업체가 답해요) | 담기 · 담음 ✓ · 담을 수 없어요 · 3곳 다 참 | C10 C12 D06 | 이름 · 금액 쪽은 상세로 가는 링크, '담기'는 따로 단추(링크 안에 단추를 넣지 않아요). 담기 40(9판 36) |
| 담기 띠 `ShortlistTray` | — | 0 · 1~2 · 3곳 | C10 C12 D06 | 폰: 아래 붙음(담은 수 · 남은 수 + '실측 일정 잡기') / 웹: 목록 아래 카드 + 담은 업체 칩 × |
| 아바타 `Avatar` | 첫 글자 32 · 44 · 56(업체 상세는 따뜻한 색) | — | 17곳(C10 C11 C12 C24~C31 C62 D05 D06 D07 V09 V19 V20) | 같음 |

### 3.5 대화

| 컴포넌트 | 변형 | 상태 | 쓰는 화면 | 폰 / 웹 |
| --- | --- | --- | --- | --- |
| 옆 AI 칸 `AiPanel` (N2 A) · 메시지 `AiMessage` · 빠른 질문 `QuickChips` | 로그인 뒤(가이드 · 견적 설명 · 일정) · 로그인 전(자주 묻는 질문 칩 + '가입 · 로그인') · 초안 카드(실측 일정 요청 초안 · 날짜 추천) | 처음 한 번 AI 알림 · 답 기다림 · 답 실패('설명을 만들지 못했어요') · 접음 | 웹 D01 D03 D06 D07 D08 D12 D13 D15~D19 · 폰 C09 · 로그인 전 C58 | 웹 ≥1024: 본문 첫 묶음과 같은 윗줄에서 시작해 붙음, 높이 max(460px, 창 − 위 띠 − 32px), 창이 낮으면 입력 칸이 창 아래에 붙음(top 음수), 대화 목록만 칸 안에서 스크롤(`overscroll-behavior: contain` · 얇은 막대 8px) / 폰 · 태블릿: 머리 'AI에게 묻기' → 전체 화면 층(× · 뒤로 가기로 닫힘), 로그인 전은 아래 시트. 접은 모양은 9판에 그림이 없어 N5와 함께 시안으로 골라요 |
| 채팅 `ChatThread` · `ChatBubble` · `SystemLine` · `DayDivider` · `ChatComposer` · `WarnLine` · `RequestCard` | 날짜 줄 · 시스템 줄(알약) · 상대 말풍선 · 내 말풍선 · 요청 카드(일정 바꾸기) · 주의 줄(믿집 밖 거래 권유에만 한 줄) · 머리 아래 띠(실측 날짜 · 일정 바꾸기 요청) | 보내는 중 · 못 보냄(다시 보내기) | C23(빈) · C24(목록) · C25 C26 C28~C31 C62 · D05 · V09 V19 V20 | 시각은 말풍선 밖 시:분, 같은 분이면 마지막만(사용자 결정). 말풍선 16(9판 14.5) · 글 칸 16(iOS 확대 막음) · + · 보내기 44. 폰: 목록 → 대화 두 화면, + 메뉴는 아래 시트 / 웹: 2단(목록 \| 대화, W5 B), + 메뉴는 작은 메뉴 |

### 3.6 상태 · 알림

| 컴포넌트 | 변형 | 상태 | 쓰는 화면 | 폰 / 웹 |
| --- | --- | --- | --- | --- |
| 상태 칩 `StatusLabel` · 범례 `StatusLegend` (N4 C) | ● 할 일 · ○ 기다림 · ✓ 일정 · 확정 · – 끝남 · ! 기한 지남 | — | D04 V03 V08 | 글자 14/700 gray-800 + 앞 아이콘 12~16px만 색(Carbon도 아이콘 + 글자, 근거 26). 폰 카드 위 · 웹 표 칸. 같음 |
| 배지 `Badge` · 기한 배지 `DueBadge` · 안 읽은 수 `Count` | 지금(파랑) · 기다림(주황) · 확정(초록) · 지남 · 거절(빨강) · 준비 중 · 닫힘(회색) / 기한: '11.25(수) 09:05까지' → 가까우면 '내일 21:40까지'(주황) → 지나면 '지났어요'(빨강) | — | 배지 35곳(A01~A04 C02~C04 C06 C10 C14 C15 C18 C20 C32 C36 C40~C43 C59 C60 D03 D04 D06 D09 D11 D13 D14 D19 V02 V03 V14 V18 V22 V23) · 수: 웹 머리 15곳 · 탭 바 · 채팅 목록 | 배지 24px · 13/700 · 글자 늘 함께. 수 20px · 13/700 흰 글자(4.92:1). 같음 |
| 안내 상자 `Notice` | 정보(파랑) · 회색 · 흰(회색 바탕일 때) · 주의(주황) | — | C06 C08 C09 C19 C33 C35 C37 C38 C50 C51 C60 C62 D12 D13 D16 V06 V08 | 14/1.5 · 모서리 16. 적게 써요(사용자 결정: 칸 위 힌트 · 안심 문구 최소) |
| 알림 `NotificationList` · 머리 펼침 `NotifyDropdown` | 새 알림 · 지난 알림 묶음 | 안 읽음(빨강 점 + 숨은 글 '새 알림') · 읽음 | C44 V21 · 웹 D09 | 폰: 탭 '알림' 화면 / 웹: 머리 알림 → 펼침 370(모두 읽음 · 모두 보기), 어느 화면에서나(작은 손질) |
| 토스트 `Toast` | 알림 · 오류 | — | C16 덧붙인 그림('방금 다른 고객이 골랐어요') · 저장 | 어두운 바탕 흰 글자 14 · 아래 단추 띠 위 · `role="status"` · 4초. 놓치면 안 되는 말('방금 다른 고객이 골랐어요')은 토스트로만 두지 않고 그 칸 아래에도 남겨요 |
| 빈 화면 `EmptyState` | 아직 없음 · 찾을 수 없음 · 오류 · 다른 길(가까운 구 · 세 길) | — | C23 C56 · 길 주기 C12 C22 | 아이콘 칸 72 · 제목 20/700 · 설명 · 다음 할 일 단추. 빈 화면에서 끝나지 않게 늘 다음 길 |

### 3.7 덮는 것

| 컴포넌트 | 변형 | 상태 | 쓰는 화면 | 폰 / 웹 |
| --- | --- | --- | --- | --- |
| 가운데 창 `Dialog` (W2 A) | 확인(되돌리기 어려운 것: C34 업체 확정 · C61 이 날짜로 확정 · A04 거절) · 고르기(C41 이어 하기 / 새 집) · 가입 카드(C59 D13, W9: 가입 · 로그인만) · 웹에서 이유 고르기 · 양식(C03 C15 C30 C31 C49 C52 C53 V05 V25) | 보내는 중 · 오류 | 가운데 창 6곳(A04 C34 C41 C59 C61 D13) + 웹으로 옮긴 시트 9곳 | 폰: 가운데 카드 · 단추 [닫기 \| 확정] / 웹: 460px · 오른쪽 위 × · Esc · 바깥 누르기로 닫음, 폰의 '닫기' 단추는 웹 창에서 빼요(확인 창의 '닫기'는 그대로, 작은 손질). `<dialog>`의 `showModal()`로 뒤를 막고, 닫으면 누른 단추로 초점을 돌려요 |
| 아래 시트 `Sheet` | 메뉴(⋯ C29 · + C26) · 이유 고르기(C30 C31 C52 V05) · 양식(C03 · V25) · 보기(C15 · C49) · 탈퇴(C53) · 로그인 전 AI(C58) | 열림 · 닫힘 | 12곳(C03 C15 C26 C29~C31 C49 C52 C53 C58 V05 V25) | 폰만. 위 모서리 24 · 손잡이(꾸밈)와 **보이는 닫기** · 뒤로 가기로 닫힘 · 시트 위에 시트를 겹치지 않음 · 최대 높이 85dvh 안에서 스크롤 · 아래 안전 영역(근거 25). 웹: 메뉴 → 작은 메뉴, 나머지 → 가운데 창 |
| 작은 메뉴 `Menu` (W2 A) | ⋯ · + · 이름 ▾ · 지금 할 일 ▾ | 열림 · 위험 줄(빨강) | 웹 D05 · D09 · 공사 띠 | 웹만. 누른 단추 옆에 붙음 · 240px · 줄 44 · Esc · 바깥 누르기 |

### 3.8 그 밖

| 컴포넌트 | 쓰는 화면 | 메모 |
| --- | --- | --- |
| 첫 화면 `Hero` · 진행 순서 `HowItWorks` | C01 C40 · D10 | 제목 폰 20/700 · 웹 38/800. 견본 견적서 카드(`Money` + `QuoteLines`). 웹은 2단 + 6단계 순서 + 바닥 '업체로 가입' |
| 자주 묻는 질문 `Accordion` | C54 | `<details>` · 질문 줄 48 · 답 gray-50 칸 |
| 아이콘 `Icon` | 탭 바 · 머리 · 끌어다 놓기 · 빈 화면 · 상태 | design-04. 9판의 ‹ › × ⋯ ★ ✓ 글자 기호도 아이콘으로 바꿔 글꼴마다 모양이 달라지지 않게 |
| 웹 배치 틀(9판 조각 없음) | W3 A 한 공사 요약판 2단 · W7 A 업체 주간 반나절 칸 + '주 \| 달' · W8 A 업체 정보 한 장 + 왼쪽 목차 + 오른쪽 미리 보기 | 웹 화면 고르기 판 시안이 기준. 제작 때 위 컴포넌트를 조합해요 |

## 4. 폰(앱) · 웹 배치 규칙

### 4.1 공통

- **같은 경로, 같은 코드.** 경로마다 컴포넌트는 하나이고 CSS(미디어 쿼리 · 컨테이너 쿼리)로 배치를 바꿔요. 폰 · 웹 컴포넌트를 따로 만들지 않아요. 예외는 덮는 것 셋(아래 시트 ↔ 작은 메뉴 · 가운데 창)과 옆 AI 칸(전체 화면 층 ↔ 붙는 칸)뿐이고, 같은 내용 · 같은 단추 이름을 넘겨받아 겉만 바꿔요.
- 웹 틀(W1 A): 머리 → 공사 띠 → 이동 경로 + 화면 제목 → [본문 | 옆 칸]. 옆 칸은 AI가 있는 화면은 AI, 없는 화면은 요약(공사 · 업체 · 금액 · 할 일).
- 폰 틀: 머리 → 본문(묶음을 세로로) → 아래 단추 띠 또는 아래 탭 바.
- 웹에서 늘어나지 않게(작은 손질 4 · 5): 단추 최소 160 · 오른쪽 정렬, 입력 최대 520 · 숫자 240, 나눔 칸 최대 360, 문단 40em.
- 앱 모드(PWA) 머리 위 · 탭 바 · 아래 단추 띠는 안전 영역만큼 띄워요(4.3).
- 붙는 머리 · 띠가 초점을 가리지 않게 `scroll-padding-top`을 위 띠 높이만큼 둬요. 아래 단추 띠 · 탭 바가 있는 화면은 `scroll-padding-bottom`도 그 높이만큼(WCAG 2.4.11, 근거 19).

### 4.2 경로별

| 경로 · 화면 | 폰(< 768) | 웹(≥ 1024) |
| --- | --- | --- |
| `/` 홈 | C01 · C40: 로고 머리, 첫 화면 + 견본 견적서, 로그인 뒤 진행 중 띠 + 탭 바 | D10: 위 메뉴, 2단 첫 화면, 6단계 순서, 바닥 업체 가입. 로그인 뒤 머리 아래 진행 중 띠 |
| `/start` 기본 정보 | C02: 세 묶음(어떤 공사 · 우리 집 · 희망) 한 줄 + 아래 띠(요약 줄 + '표준견적서 보기'). 평으로 넣기는 아래 시트(C03) | D11: 양식 + 오른쪽 '넣은 내용' 요약 칸. 평으로 넣기는 가운데 창 |
| `/start/standard` 가입 전 표준견적서 | C57: 탭 바 없음. 'AI에게 묻기' → 아래 시트(C58: 자주 묻는 질문 칩). '업체 보기' → 가운데 카드(C59) | D12 · D13: 옆 칸은 로그인 전 AI, 가운데 카드 460 |
| `/projects/{id}/standard` | C07 + 전체 화면 AI(C09) | D01: 공사 띠 + 본문 + 옆 AI 칸 |
| `/projects/{id}/vendors` · `/{vid}` | C10(담기 띠 아래 붙음) · C11(탭) | D06(담기 카드 목록 아래) · D07(탭 + 줄 표) + 옆 AI 칸 |
| 실측 일정 · 요청서 | C13 · C14 · C18 · C20 · C32: 업체 카드 세로 | D08 요청서(+ AI 초안 카드) · D03 업체를 열로 둔 비교표(W4 A) + 옆 AI 칸 |
| 날짜 고르기 · 제안 고르기 | C16 · C19 · C21: 달력 + 반나절 + 아래 띠(고른 것 요약 + 단추) | D15 · D16 · D17: 넓은 달력 + 오른쪽 '고른 날' 칸 + 옆 AI 칸 |
| 확인 | 가운데 창(C34 · C61) | 가운데 창 460 |
| `/projects/{id}/quotes` 실측 견적서 | C33: 업체 카드 세로 | D18: 비교표 + 옆 AI 칸 |
| `/projects/{id}/plan` 공정표 | C08 예상 · C36 확정(날마다 목록) | D19: 반나절 칸 표 + 오른쪽 할 일 · 채팅 |
| `/projects/{id}/schedule` 공사 날짜 · 추가 금액 · 공사 끝 | C35 · C37 · C38 · C52(다른 날짜 요청 시트) | 같은 틀 + 오른쪽 요약 칸(W1 A), 다른 날짜 요청은 가운데 창 |
| `/projects/{id}` 한 공사 | C43 · C63(요약 · 기록 탭) | W3 A 요약판 2단(지금 할 일 크게 → 업체 표 · 최근 소식 / 오른쪽 서류 · 기본 정보 · 채팅) |
| `/my` 내 공사 | C42 | D09(+ 머리 알림 펼침) |
| `/chat` · `/chat/{id}` | C24 목록 → C25 대화(두 화면), + 메뉴 시트(C26), ⋯ 시트(C29) | D05 2단(목록 \| 대화, W5 B), + · ⋯는 작은 메뉴, 실측 취소 · 신고는 가운데 창 |
| `/notifications` | C44(탭) | 머리 알림 펼침(D09) + '모두 보기' → 알림 화면 |
| `/account` | C45(탭) | 머리 이름 ▾ 펼침(내 정보 · 자주 묻는 질문 · 로그아웃) + 내 정보 화면 |
| `/signup` · `/login` | C04~C06 · C46 전체 화면 | 가운데 카드 460, 가입 · 로그인만(W9) |
| 업체 `/vendor` 작업함 | V03 카드 + 탭 바 | D04 표 + 줄을 고르면 오른쪽 자세히(N4 C 둘 다) |
| 업체 일정 | V08(작업함 '일정' 탭 목록) | W7 A 주간 반나절 칸 + '주 \| 달'(W6 B: 위쪽 메뉴 그대로, 일정은 작업함 탭) |
| 업체 기간 답하기 · 날짜 수락 · 제안 | V04 · V06 · V07 | D14(요청 내용 · 큰 달력 · 이미 잡힌 실측을 한 화면) |
| 업체 단가 | (9판 폰 조각 없음) 표를 줄 목록으로 | D02 표 |
| 업체 정보 | V15 · V16 · V18(탭) | W8 A 한 장 양식 + 왼쪽 목차 + 오른쪽 미리 보기 |
| 관리자 | 대상 아님(프로토타입도 웹만) | A01~A04 표 + 오른쪽 자세히 |

### 4.3 앱 모드(PWA로 설치했을 때)

설치 방식 자체(PWA 등)는 개발자 역할이 정해요(지시문 4장). 디자인 쪽 규칙만 적어요.

| 무엇 | 규칙 | 근거 |
| --- | --- | --- |
| 화면 끝까지 | `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`. 확대를 막지 않아요(`maximum-scale` 안 씀) | 34 |
| 안전 영역 | 머리: `padding-top: env(safe-area-inset-top)` + 위 칸을 머리색으로 칠함(`body::before`). 탭 바 · 아래 단추 띠: `padding-bottom: max(6px, env(safe-area-inset-bottom))`. 옆 여백: `max(var(--mj-gutter), env(safe-area-inset-left/right))` | 34 |
| 상태 막대 색 | `theme-color` #ffffff(흰 머리와 같게). manifest `theme_color` · `background_color`도 #ffffff. iOS `apple-mobile-web-app-status-bar-style`은 standalone에서만 먹고, 화면 끝까지 그리는 black-translucent는 내용이 막대 밑으로 들어가서 안 쓰고 기본값을 둬요 | 34 · 36 · 39 |
| 아이콘 | manifest: 192 · 512(`any`) + 512(`maskable`, 로고를 가운데 지름 80% 원 안에). iOS 홈 화면용 `apple-touch-icon` 180×180 불투명 PNG도 꼭 같이 둬요(iOS가 manifest 아이콘을 쓰는지는 확인 못 함). `app/icon.svg`는 브라우저 탭용. 만든 곳(B4): `app/manifest.ts` · `app/icons/[id]/route.tsx`(`/icons/192.png` · `512.png` · `maskable-512.png`, `ImageResponse`) · `app/apple-icon.tsx` · 오프라인 안내 `app/offline` · `public/sw.js` | 35 · 37 · 38 · 39 |
| 뒤로 가기 | 앱 모드에는 브라우저 뒤로 단추가 없어요 → 첫 화면 말고는 머리에 ‹ 를 늘 둬요(9판 그대로). 시트 · 전체 화면 AI는 뒤로 가기로 닫혀요 | 34 · 25 |
| 당겨서 새로 고침 · 스크롤 이어짐 | 대화 목록 · AI 목록 · 시트 안에만 `overscroll-behavior: contain`. 페이지 전체는 그대로 둬요 | 34 |
| 글 고르기 | 탭 바 · 머리 단추 · 칩만 `user-select: none`. 금액 · 주소 · 채팅 글은 고를 수 있게 | 34 |
| 모드에 따라 | `@media (display-mode: standalone)`에서 '앱으로 쓰기' 같은 안내만 숨겨요. 배치는 같아요 | 34 |
| 어두운 화면 | `color-scheme: only light` · `<meta name="color-scheme" content="only light">` — 안드로이드 크롬 자동 어둡게 하기를 막아요 | 24 |

## 5. 9판 · 지금 코드 → 새 토큰 (차이와 옮기는 법)

### 5.1 차이 한눈에

| 무엇 | 지금 `globals.css`(v2) | 9판 `screens.css`(`.k` 시안) | 새 토큰 |
| --- | --- | --- | --- |
| 바탕 | 흰 #fff | 회색 #f2f4f6 + 흰 묶음(모서리 20) | 흰(기본) · 회색은 `data-canvas="gray"` |
| 주 색 | #2d6cb5(5.35:1) | #3182f6(3.71:1) | #1b66d8(5.33:1) |
| 글자 | #172233 · #46546a · #56647a | #191f28 · #4e5968 · #6b7684 · #8b95a1(3.04) | #1b222c · #495563 · #616c7b(5.33) |
| 입력 칸 | 흰 + 1px #7489a6 · 모서리 6 · 46px | 회색 채움 · 테두리 없음 · 모서리 12 · 50px | gray-50 채움 + 1px gray-500(3.5:1) · 모서리 12 · 48px |
| 단추 | 모서리 6 · 48px | 모서리 16 · 54px(작은 것 12 · 44) | 모서리 16 · 52 / 14 · 44 / 14 · 40 |
| 글자 크기 | 13 · 14 · 16 · 18 · 20 · 24(28) · 30(38) | 9~42px 26가지 | 13 · 14 · 16 · 18 · 20 · 28 · 38 |
| 글꼴 | Noto Sans KR(next/font/google) · IBM Plex Mono | Noto Sans KR(시안) | Pretendard Variable 자체 호스팅 · 고정폭 숫자 |
| 그림자 | 서류 그림자 · 떠 있는 창 | 거의 없음 | 떠 있는 것에만 |
| 상태 | 글자 + 모양 + 색(`.mj-st`) | 아이콘 + 글자(N4 C, `.k-si`) | `StatusLabel`(N4 C) |

### 5.2 지금 토큰 → 새 토큰(별칭으로 옮김)

| 지금 | 새 | 메모 |
| --- | --- | --- |
| `--bg` | `--mj-bg` · `--mj-surface` | 같은 흰색 |
| `--surface` #f4f8fd · `--surface-2` #eaf2fc | `--mj-fill` · `--mj-surface-sub` · (고른 것이면) `--mj-primary-weak` | 푸른 기운을 회색 단계로 |
| `--accent-weak` · `--accent-pastel` | `--mj-primary-weak` · `--mj-range-vendor` | |
| `--line` · `--line-soft` · `--line-paper` | `--mj-line` · `--mj-line-soft` · `--mj-line` | 서류 테두리 대신 줄 · 합계 2px |
| `--line-strong` | `--mj-line-control` | |
| `--gantt-off` · `--gantt-grid` | `--mj-fill` · `--mj-line-soft` | |
| `--ink` · `--ink-sub` · `--ink-mute` | `--mj-text` · `--mj-text-sub` · `--mj-text-mute` | |
| `--accent` · `--accent-hover` · `--accent-ink` · `--focus` | `--mj-primary` · `--mj-primary-hover` · `--mj-link` · `--mj-focus` | 초점 3px 그대로 |
| `--warn` · `--warn-weak` | `--mj-badge-wait-fg` · `--mj-warn-weak` | |
| `--danger` · `--danger-weak` · `--ok` · `--ok-weak` | `--mj-danger` · `--mj-danger-weak` · `--mj-ok` · `--mj-badge-ok-bg` | |
| `--kakao*` | `--mj-kakao` · `--mj-on-kakao` | 같은 값 |
| `--radius-s` 4 · `--radius` 6 · `--radius-l` 12 · `--radius-paper` 2 | `--mj-radius-badge` 6 · `--mj-radius-btn`/`-field` · `--mj-radius-group` · `--mj-radius-paper` | 모서리가 커져요(B) |
| `--backdrop` · `--scrim` | `--mj-scrim` | |
| `--shadow-sm` · `--shadow-pop` · `--shadow-paper` | `--mj-shadow-raise` · `--mj-shadow-pop` · (인쇄만) | |
| `--fs-xs` · `-sm` · `-md` · `-lg` · `-h2` | `--mj-type-caption` · `-label` · `-body` · `-title-s` · `-title` | 같은 값 |
| `--fs-h1` 24/28 · `--fs-display` 30/38 | `--mj-type-title` 20 · `--mj-type-amount`/`-hero` 28/38 | 24 · 30은 일곱 단계 밖 |
| `--font` · `--mj-font`(next/font 변수) · `--font-mono` | `--mj-font-sans`(+ `--mj-font-face`) · `.mj-num` | next/font 변수 이름이 `--mj-font`라 겹치지 않게 `--mj-font-face`로 바꿔요. 2차부터 next/font를 안 써서 `--mj-font-face`는 비어 있는 자리예요 |
| `components/v2/v2.module.css`의 `--r-*` · `--sh-*` · `--on-accent` | 같은 자리의 `--mj-*` | /v2 화면만 쓰는 값. v3로 바뀌면 지움 |

### 5.3 9판 클래스 → 새 컴포넌트 · 값

| 9판 | 새 | 바뀌는 값 |
| --- | --- | --- |
| `.k-big` · `.k-big.m` · `.k-big.xl` · `.k-vp` | `BigFigure` · `Money` | 30 → 28 · 23 → 20 · 36 → 38(웹) · 20 그대로 |
| `.k-h` · `.k-h.s` · `.k-ttl` · `.k-ttl2 b` · `.k-dh` | 제목 토큰 | 21 → 20 · 18 · 17 → 18 · 22 → 20 · 42 → 38 |
| `.k-sm` · `.k-rl span` · `.k-help` · `.k-vd` · `.k-sys` · `.k-note`(12.5, g500 · g600) | `--mj-type-caption` · `--mj-text-mute` | 12.5 → 13 · 글자색 #8b95a1(3.04) → #616c7b(5.33) |
| `.k-tab`(11, 꺼진 탭 g400) | `TabBar` | 11 → 13 · 꺼진 탭 글자 2.0:1 → 5.33:1 |
| `.k-stepl`(10) · `.k-cal i em`(9) | `Steps` · `Calendar` | 13으로 올리고 모양을 바꿈(2.3) |
| `.k-btn`(54 · 16) · `.k-btn.sm`(44 · 14.5) | `Button` lg · md | 54 → 52 · 14.5 → 16 |
| `.k-pick`(36) · `.k-ch`(38) · `.k-pills span`(36) · `.k-quick span`(34) · `.k-seg span`(36) · `.k-x`(36) | `Button` sm · `ChoiceChip` · `FilterPills` · `QuickChips` · `Segmented` · 창 × | 모두 40 이상(창 ×는 44) |
| `.k-in`(50, 테두리 없음) · `.k-in.on` · `.k-in.err` | `Field` | 48 · 1px 테두리 · 초점 · 오류 2px |
| `.k-ck`(g300 테두리) · `.k-tg`(끔 g300) · `.k-dz`(점선 g300) | `Check` · `Switch` · `FileDrop` | 테두리 gray-500(3.5:1) |
| `.k-bdg.*` | `Badge` | 글자를 700 단계로(5.73~6.84:1) |
| `.k-si` · `.dt` | `StatusLabel` | 13.5 → 14 · 색은 `--mj-st-*` |
| `.k-stars`(#ffb800) · `.k-st` | `Stars` | #c48200 · 고르기는 단추 44 |
| `.k-cal i.p`(#e07b00) · `.k-cal i.h`(kr) | `Calendar` | 주황 #b35900 · 공휴일 #b9212b |
| `.k-g` · `.k-g.list` · `.k-row` · `.k-row.tot` · `.k-row.out` | 묶음 · `QuoteLines` · `SummaryRows` | 흰 바탕이면 1px 테두리, 합계 위 2px 진한 줄 |
| `.k-aside` · `.k-alist` · `.k-afoot` · `.k-q` · `.k-a` · `.k-calc` · `.k-ctx` | `AiPanel` · `AiMessage` · `CalcNote` | N2 A 높이 규칙 · 말풍선 16 |
| `.k-scrim` · `.k-sheet` · `.k-dlg` · `.k-opt` · `.k-mgrid` · `.w-pop` · `.k-drop` | `Sheet` · `Dialog` · `OptionRow` · `Menu` · `NotifyDropdown` | 폰/웹 갈림(W2 A) |
| `.w-band` · `.w-steps` · `.w-subs` · `.w-todo` | `ProjectBand` | 단계 이름 12 → 13 |
| `.k-tbl` · `.k-tbl.cmp` · `.k-tbl.inbox` · `.k-tbl.gantt` | `DataTable` · `CompareTable` · `ScheduleChart` | 머리 12.5 → 13 |

### 5.4 옮기는 순서(다음 제작 단계)

1. (했음, B4) 토큰 파일 넣기: `frontend/app/tokens.css`에 두고 `app/layout.tsx`에서 `globals.css`보다 먼저 불러요. 바탕 규칙은 `globals.css`의 같은 규칙과 합쳤어요. 공사 띠 높이 `--mj-band-h`는 띠가 있는 화면에서만(`:root:has([data-mj-band])`) 태블릿 56 · 웹 76 · 작은 단계가 있으면 92예요. 옆 AI 칸 `--mj-aside-top` · `--mj-aside-h`는 9판 `100cqh`를 `100dvh − --mj-sticky-top`으로 옮긴 값이에요(붙은 뒤). 붙기 전 첫 화면은 `100dvh − 칸이 시작하는 위치 − 16px`(최소 `--mj-aside-start-min-h` 320)이라 입력 칸이 창 안이에요(ui-components 2.6).
2. (했음, B4) 별칭 한 묶음: `globals.css` 맨 위 `:root`에서 v2 이름이 새 토큰을 가리켜요. `--surface`는 밝기 순서를 지키려고 `--mj-surface-sub`(gray-50), `--surface-2`는 `--mj-fill`(gray-100)로 이었어요(5.2 표와 짝 순서만 달라요).
3. (했음, B4) 글꼴 바꾸기: 1차 `next/font/local` + 한 파일 woff2(2,057,688바이트) → 2차에 리드 결정으로 가변 다이나믹 서브셋 CSS(`pretendardvariable-dynamic-subset.css`, 92조각 · swap)로 바꿈. 한국어 화면 한 장 첫 방문 운영 `/faq` 10조각 259,592바이트 · `/` 11조각 286,140바이트 → design-01 목표 300KB 안(verification/b4.md 5.1).
4. (1 · 2차 했음, B4) 공용 컴포넌트: `components/ui/` · `components/site/`. 9판 `.k-*` CSS를 통째로 옮기지 않고, 9판 HTML은 모양 기준으로만 봤어요. 2차에 Segmented · Switch · Check · Tabs(FilterPills 포함) · DataTable · FileRow · PhotoGrid · Avatar · KeyValue · Notice · ResumeStrip · Accordion · EventLog, 3차에 ScheduleChart · Lightbox를 했어요.
5. 화면을 v3 컴포넌트로 바꿀 때마다 옛 `mj-` 공용 클래스 쓰임을 줄이고, 0번이 되면(grep으로 확인) 별칭 묶음을 지워요.
6. 검증: `check_contrast.py` · typecheck · lint · build · 360px · 1280px 화면 점검 · 낮은 창(높이 500) 옆 AI 칸.

## 6. 접근성 확인표(제작 때 그대로 씀)

| 항목 | 기준 | 어떻게 지키나 |
| --- | --- | --- |
| 글자 대비 | 4.5:1(WCAG 1.4.3 · KWCAG 2.2) | 의미 토큰 짝만 쓰기 · `check_contrast.py` |
| 테두리 · 아이콘 · 상태 | 3:1(WCAG 1.4.11) | `--mj-line-control` · `--mj-st-*` · 고른 것 1.5px 파랑 테두리 |
| 누를 곳 | 44 기본 · 촘촘한 곳 40(지시문). WCAG 2.5.8 AA는 24, 2.5.5는 44 · KWCAG 2.2 대각선 6.0mm ≈ 폰 27px | 3층 크기 토큰 · 글 속 링크만 예외 |
| 색만으로 알림 | WCAG 1.4.1 · KRDS | 상태는 아이콘 + 글자, 오류는 글 + 아이콘, 고른 것은 테두리 두께 + 글자 굵기 |
| 초점 | 3px 파랑 · 2px 띄움 · 가려지지 않음(2.4.11) | `:focus-visible` · `scroll-padding-top` |
| 글자 크기 | 본문 16 · 최소 13 · rem | 일곱 단계 토큰 |
| 줄바꿈 · 줄 길이 | keep-all · 40em | 바탕 규칙 · `--mj-read-max` |
| 움직임 | 줄인 움직임 존중 | `prefers-reduced-motion`이면 시간 0 |
| 창 | 초점 가둠 · Esc · 닫으면 초점 돌려줌 · 보이는 닫기 | `<dialog>` · 시트 닫기 단추 |
| 폰 360px | 가로 스크롤 없음 | 큰 숫자 · 달력 · 단계 크기를 잼(2.3 · verification) |

## 7. 사용자 확인 필요(리드가 물어 주세요)

1. 바탕: 흰 바탕(기존 결정 · 기본) vs 9판처럼 회색 바탕 + 흰 묶음. 한 줄 스위치라 둘 다 바로 볼 수 있어요.
2. 파랑이 9판보다 진해져요(#3182F6 → #1B66D8). 흰 글자 대비 때문이에요. 밝은 파랑은 막대 · 범위 띠에만 남아요.
3. 웹 화면 제목 22px(W1 A 설명) → 20px(일곱 단계).
4. 폰 단계 이름은 지금 단계만, 폰 달력 칸 아래 글은 두 글자까지(13px 최소 때문).
5. Pretendard는 같은 px에서 조금 작아 보인다고 KRDS가 적었어요(그래서 KRDS 본문 기본이 17px). 본문 16px(사용자 결정)을 지키고, 화면 점검에서 작게 느껴지면 그때 물어요.

## 8. 근거 (직접 열어 확인한 것만 · 확인 2026-11-18)

1. TDS Mobile 타이포그래피 — https://tossmini-docs.toss.im/tds-mobile/foundation/typography/ — 글자 토큰 30/40 ~ 11px, 본문 17, 사용자 글자 크기 설정을 따라 커져요
2. TDS Mobile 색 — https://tossmini-docs.toss.im/tds-mobile/foundation/colors/ — 50~900 단계, 9판이 쓴 grey · blue 값의 출처
3. TDS 글자 단추 — https://tossmini-docs.toss.im/tds-mobile/components/text-button/ — clear · arrow · underline 세 변형
4. 앱인토스 디자인 컴포넌트 — https://developers-apps-in-toss.toss.im/design/components — 제공 자료의 권리는 토스, 앱인토스 범위 안에서만 써요
5. 앱인토스 UX 가이드 — https://developers-apps-in-toss.toss.im/design/consumer-ux-guide.md — 해요체, 창 왼쪽 단추는 '취소' 대신 '닫기', 장식 효과 피함
6. Pretendard 저장소 — https://github.com/orioncactus/pretendard — OFL, 다이나믹 서브셋 · 가변 글꼴, Next.js 예시
7. Pretendard README(패키지) — https://raw.githubusercontent.com/orioncactus/pretendard/main/packages/pretendard/README.md — `next/font/local` 예시 weight '45 920', 안 주면 WebKit 굵기 오류
8. Pretendard 영문 README — https://cdn.jsdelivr.net/npm/pretendard@1.3.9/docs/en/README.md — 글꼴 묶음 순서, 가변 다이나믹 서브셋 CSS 이름(v1.3.9)
9. Debian fonts-pretendard 1.3.9 — https://sources.debian.org/src/fonts-pretendard/1.3.9-2/web/variable/woff2 — PretendardVariable.woff2 통째 2,057,688바이트
10. Google Fonts 한국어 — https://developers.googleblog.com/google-fonts-launches-korean-support/ — 한국어 글꼴 약 4MB, unicode-range 조각으로 필요한 것만(2018)
11. Next.js 글꼴 — https://nextjs.org/docs/app/getting-started/fonts — next/font는 같은 주소에서 제공, 브라우저가 외부에 요청하지 않음
12. Apple HIG 글자 — https://developer.apple.com/design/human-interface-guidelines/typography — iOS 기본 17pt · 최소 11pt
13. KRDS 타이포그래피 접근성 — https://www.krds.go.kr/html/site/style/style_03.html — 본문 최소 16px, Pretendard GOV는 작아 보여 17 기본, 줄 높이 150%, 굵기 넷 안팎
14. KRDS 색 — https://www.krds.go.kr/html/site/style/style_02.html — 단계 숫자 = 대비(50 = 4.5:1), 상태는 색만으로 알리지 않음, 강조색 5% 이하, 선명한 화면 모드는 사용자가 고름
15. (내부) 디자인 방향 판 — `d10-/reports/유스케이스/v3 (2026-11-17)/디자인 방향.html` — B 설명 · 좋은 점 · 아쉬운 점, 네 방향 공통 'AI 티 빼기' 규칙, '실제 제품은 Pretendard 권장'
16. (내부) 웹 화면 고르기 판 — 같은 폴더 `웹 화면 고르기.html` — W1~W9 · 작은 손질 8. 사용자 고름(2026-11-18, 흐름 시안 B 6판에 반영): W1 A · W2 A · W3 A · W4 A · W5 B · W6 B · W7 A · W8 A · 작은 손질 8 모두, W9는 가운데 카드에 가입 · 로그인만
17. WCAG 2.2 2.5.8 — https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html — 24×24 AA, 글 속 링크 예외, 2.5.5는 44×44
18. WCAG 2.2 1.4.11 — https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html — 테두리 없는 입력은 바탕 대비 3:1, 체크 테두리 3:1, 고른 상태 3:1
19. WCAG 2.2 2.4.11 — https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html — 붙는 머리 · 바닥이 초점을 다 가리면 실패, `scroll-padding`
20. 서울시 누리집 접근성 기준 — https://news.seoul.go.kr/gov/archives/47485 — 한국형 웹 콘텐츠 접근성 지침 2.2(방송통신표준심의회, 2022.12.28)
21. 요즘IT KWCAG 글(2차 자료) — https://yozm.wishket.com/magazine/detail/1942 — 대비 4.5:1, 컨트롤 대각선 6.0mm 이상
22. DTCG 첫 안정판 — https://www.w3.org/community/design-tokens/2025/10/28/design-tokens-specification-reaches-first-stable-version/ — 2025.10 안정판, 별칭 · 밝게/어둡게 테마
23. NN/g 어두운 화면 — https://www.nngroup.com/articles/dark-mode/ — 보통 시력엔 밝은 화면이 대체로 나음, 작은 글씨일수록, 기본은 밝게 · 고를 수 있게
24. Chrome 자동 어둡게 — https://developer.chrome.com/blog/auto-dark-theme — `color-scheme: only light`로 빠짐
25. NN/g 아래 시트 — https://www.nngroup.com/articles/bottom-sheet/ — 보이는 닫기, 뒤로 가기로 닫기, 시트 겹치지 않기, 긴 내용 금지
26. Carbon 상태 표시 — https://carbondesignsystem.com/patterns/status-indicator-pattern/ — 색만으로 안 됨, 아이콘 3:1, 16px 아이콘 + 14 글자
27. Android 창 크기 등급 — https://developer.android.com/develop/ui/compose/layouts/adaptive/window-size-classes — 600 · 840 · 1200 · 1600dp
28. StatCounter 한국 폰 해상도(2026.10) — https://gs.statcounter.com/screen-resolution-stats/mobile/south-korea — 414 21.3% · 384 13.3% · 360 10.0% · 412 8.8% · 390 6.7%
29. StatCounter 한국 데스크톱(2026.10) — https://gs.statcounter.com/screen-resolution-stats/desktop/south-korea — 1920 39.9% · 2560 17.6% · 1536 5.9% · 1440 2.6%
30. MDN position — https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/position — sticky는 가장 가까운 스크롤 조상 기준, top 등 하나는 있어야
31. MDN 길이 단위 — https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/length — svh · lvh · dvh(dvh는 스크롤 중 바뀜), cqh
32. MDN word-break — https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/word-break — keep-all은 CJK 글자 사이에서 안 끊음, break-word는 비권장
33. MDN font-variant-numeric — https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/font-variant-numeric — tabular-nums = OpenType tnum
34. web.dev 앱 디자인 — https://web.dev/learn/pwa/app-design — theme color = 상태 막대 색, viewport-fit=cover + env(safe-area-inset-*), display-mode, user-select, overscroll
35. MDN manifest icons — https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/icons — purpose any · maskable · monochrome
36. MDN theme_color — https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/theme_color — 앱 기본값, 쪽마다 meta가 덮음, media로 밝게/어둡게
37. web.dev 마스커블 아이콘 — https://web.dev/articles/maskable-icon — 안전 영역은 지름 80% 원
38. web.dev 아이콘 · 브라우저 색 — https://web.dev/articles/icons-and-browser-colors — apple-touch-icon 180 또는 192 불투명 PNG
39. Apple 웹 앱 설정 — https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html — status-bar-style은 standalone에서만
40. 국립국어원 새국어소식(2004.06) — https://www.korean.go.kr/nkview/nknews/200406/71_13.html — 수는 만 단위로 띄어 씀, 금액은 붙여 쓰는 관례
41. 에어비앤비 총액 표시 — https://news.airbnb.com/total-price-display-is-now-standard-globally — 2025.4.21, 수수료 포함 총액을 기본으로
42. Lucide LICENSE — https://github.com/lucide-icons/lucide/blob/main/LICENSE — ISC(+ Feather 유래 MIT)
43. Lucide React — https://lucide.dev/guide/packages/lucide-react — 가져온 아이콘만 묶음에 들어가요
44. Lucide 접근성 — https://lucide.dev/guide/accessibility — 기본 aria-hidden, 이름은 단추에
45. Material Symbols — https://developers.google.com/fonts/docs/material_symbols — Apache 2.0, 기본 약 295KB, 축 전부 약 7.9MB
- 그 밖 내부 자료: `design/flow.json`(9판 결정 43개 · 규칙), `design/screens.css`와 9판 원본 HTML 안 CSS(상태 색 `--st-*` · N2 높이 규칙)
- 확인 못 한 것: KWCAG 2.2 원문(6.0mm는 2차 자료), Material 3 아래 시트의 큰 화면 지침(페이지가 열리지 않음). 이번 턴 웹 검색 한도가 다 차서 더 찾지 못했어요.
- 제작 때 확인한 것(B4, verification/b4.md): Pretendard tnum 있음 · 가변 글꼴 한 파일 2,057,688바이트 · 다이나믹 서브셋으로 바꾼 뒤 잰 값(2차): 운영 `/faq` 10조각 259,592바이트 · `/` 11조각 286,140바이트 · 뿌리 동적 렌더링 뒤 스크립트 nonce 모두 맞음 · CSP 위반 0 · 설치 막는 이유 0 · 오프라인 안내 동작.
