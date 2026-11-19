# design-03 폰(앱) · 웹 배치: 한 경로 한 코드, 기준점 넷, 덮는 것만 갈라요

- 상태: 고름
- 날짜: 2026-11-18 · 쓴 역할: 디자이너
- 관련 화면 · 이야기: 고객 C01~C63 ↔ D01~D19, 업체 V01~V25 ↔ D02 · D04 · D14, 관리자 A01~A04 · 웹 결정 W1~W9 · 9판 N1 · N2 · I9 · 관련 코드: `frontend/app/**/page.tsx`, `components/site/header.module.css`(지금 768px에서 머리가 바뀜)

## 배경

지시문 목표 1은 '웹(데스크톱)과 앱(폰) 둘 다, 같은 코드'예요. 9판은 폰 화면 + 데스크톱 전용 화면(D) + 폰 조각을 웹 틀에 놓은 웹 배치로 그렸어요. 사용자는 웹 틀(W1 A 공사 띠 · 같은 틀), 덮는 것(W2 A 메뉴는 단추 옆 · 확인은 가운데 창), 옆 AI 칸(N2 A), 사진 올리기(I9 A)를 골랐어요. 이걸 코드로 옮길 규칙과 기준점을 정해야 해요.

## 대안

| 안 | 내용 | 좋은 점 | 걸리는 점 |
| --- | --- | --- | --- |
| A | **한 경로 한 컴포넌트 + CSS 기준점(미디어 · 컨테이너 쿼리)**. 덮는 것(시트 ↔ 작은 메뉴 · 가운데 창)과 AI(전체 화면 층 ↔ 붙는 칸)만 같은 내용을 넘겨받는 겉 둘 | 흐름 · 글 · 단추 이름이 하나라 어긋나지 않아요. 서버 컴포넌트 그대로 | 큰 화면 전용 배치(W3 · W7 · W8)는 CSS가 길어져요 |
| B | 폰 · 웹 컴포넌트를 따로(`MobileX` · `DesktopX`), 사용자 에이전트로 고름 | 화면마다 자유로워요 | 두 벌 유지 · 글이 어긋남. 창 크기는 기기와 상관없이 바뀌어요(접는 폰 · 창 나누기, 근거 1) |
| C | 폰 화면을 웹에서 가운데 한 줄로만(지금 웹 배치) | 만들 것이 적어요 | W1 A · W3 A · W4 A를 사용자가 고른 이유(넓은 화면을 못 씀, 단추가 700px로 늘어남)와 반대예요 |

## 고른 것과 이유

- 고른 안: **A**.
- 기준점: 폰 < 768 · 태블릿 768~1023 · 웹 ≥ 1024 · 넓은 웹 ≥ 1280. 시험 너비 360 · 390 · 414 · 430 · 768 · 1024 · 1280 · 1440, 낮은 창 높이 500 · 600.
  - 한국 폰 너비는 414(21.3%) · 384 · 360(10.0%) · 412 · 390이 많아요(2026.10, 근거 2) → 360이 가장 좁은 흔한 너비, 430(큰 폰)까지.
  - 창 크기 등급은 기기가 아니라 앱이 받은 창 크기로 정하고, 600 · 840 · 1200 경계를 써요(근거 1). 믿집은 옆 칸 320 + 본문 640 이상이 들어가는 1024를 웹 경계로 잡았어요(840~1023은 본문 한 줄 + 웹 머리).
  - 데스크톱 화면은 1920(39.9%) · 2560 · 1536이 많아요(근거 3) → 본문 최대 1200에서 멈춰요.
- 덮는 것(W2 A): 폰은 메뉴 · 이유 고르기 · 짧은 양식을 아래 시트로, 되돌리기 어려운 확인은 가운데 창으로. 웹은 메뉴 → 누른 단추 옆 작은 메뉴, 나머지 → 가운데 창 460px(×, Esc, 바깥 누르기). 아래 시트는 보이는 닫기 단추 · 뒤로 가기로 닫기 · 시트 겹치지 않기 · 긴 내용 넣지 않기를 지켜요(근거 4).
- 옆 AI 칸(N2 A): 웹 ≥1024에서 `position: sticky`(가장 가까운 스크롤 조상 = 페이지, 근거 5), `top: min(위 띠 + 16px, 100dvh − 476px)`, `height: max(460px, 100dvh − 위 띠 − 32px)` → 창이 460보다 낮으면 입력 칸이 창 아래에 붙어요. 단위는 dvh가 스크롤 중 바뀌어 흔들릴 수 있어(근거 6) 실제 화면에서 dvh · svh를 견줘 정해요. 폰 · 태블릿은 머리 'AI에게 묻기' → 전체 화면 층(C09), 열림은 주소 상태로 둬서 뒤로 가기로 닫혀요.
- 붙는 것과 초점: 붙는 머리 · 공사 띠 · 아래 단추 띠가 초점을 가리지 않게 `scroll-padding`을 둬요(WCAG 2.4.11, 근거 7).
- 앱 모드(PWA): `viewport-fit=cover` + `env(safe-area-inset-*)`, 상태 막대 색 = theme-color #ffffff, `display-mode: standalone`에서도 배치는 같고 안내만 숨겨요(근거 8 · 9). 아이콘은 manifest 192 · 512 + 512 maskable(가운데 지름 80% 원, 근거 10 · 11), iOS는 apple-touch-icon 180 불투명(근거 12). iOS 상태 막대는 standalone에서만 바뀌어요(근거 13). 설치 방식은 개발자 ADR이 정해요.
- 사진 올리기(I9 A): 폰은 눌러서 고르기, 웹은 끌어다 놓기 + '파일 고르기'.
- 경로별 배치 표는 design-system 4.2에 있어요.

## 근거 (직접 열어 확인한 것만)

1. Android 창 크기 등급 — https://developer.android.com/develop/ui/compose/layouts/adaptive/window-size-classes (확인 2026-11-18) — 600 · 840 · 1200 · 1600dp, 기기가 아니라 받은 창 크기로 정함
2. StatCounter 한국 폰 해상도 — https://gs.statcounter.com/screen-resolution-stats/mobile/south-korea (확인 2026-11-18) — 2026.10: 414×896 21.34% · 384×832 13.31% · 360×780 9.98% · 412×892 8.77% · 390×844 6.66%
3. StatCounter 한국 데스크톱 해상도 — https://gs.statcounter.com/screen-resolution-stats/desktop/south-korea (확인 2026-11-18) — 2026.10: 1920×1080 39.9% · 2560×1440 17.55% · 1536×864 5.9%
4. NN/g 아래 시트 — https://www.nngroup.com/articles/bottom-sheet/ (확인 2026-11-18) — 보이는 닫기 · 뒤로 가기 지원 · 시트 위에 시트 금지 · 길고 복잡한 내용 금지 · 큰 화면 이야기는 없음
5. MDN position — https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/position (확인 2026-11-18) — sticky는 가장 가까운 스크롤 조상 기준, top 같은 값이 있어야 붙음
6. MDN 길이 단위 — https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/length (확인 2026-11-18) — svh · lvh · dvh, dvh는 스크롤 중 바뀌어 흔들릴 수 있음, cqh
7. WCAG 2.2 2.4.11 이해 — https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html (확인 2026-11-18) — 붙는 머리 · 바닥이 초점을 다 가리면 실패, scroll-padding(C43)
8. web.dev 앱 디자인 — https://web.dev/learn/pwa/app-design (확인 2026-11-18) — theme color = 상태 막대 · 제목 막대, viewport-fit=cover · safe-area, display-mode, user-select · overscroll
9. MDN theme_color — https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/theme_color (확인 2026-11-18) — manifest는 기본값, 쪽마다 meta가 덮음, 투명 색 안 됨
10. MDN manifest icons — https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/icons (확인 2026-11-18) — purpose any · maskable · monochrome
11. web.dev 마스커블 아이콘 — https://web.dev/articles/maskable-icon (확인 2026-11-18) — 안전 영역은 가운데 지름 80% 원
12. web.dev 아이콘 · 브라우저 색 — https://web.dev/articles/icons-and-browser-colors (확인 2026-11-18) — apple-touch-icon은 180 또는 192 불투명 PNG
13. Apple 웹 앱 설정 — https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html (확인 2026-11-18) — status-bar-style은 standalone일 때만, apple-touch-icon 크기 고르기
14. (내부) 웹 화면 고르기 판 — W1 A · W2 A · W3 A · W4 A · W5 B · W6 B · W7 A · W8 A · W9(가입 · 로그인만) · 작은 손질 8, 9판 flow.json N2 · I9 규칙

## 검증

- 방법: 제작 뒤 앱 안 브라우저로 시험 너비마다 핵심 이야기(J1 · J3 · J5 · J7 · J10 · J22)를 열어 가로 스크롤 · 누를 곳 크기 · 옆 AI 칸(높이 500 · 600 창)을 봐요. 덮는 것은 키보드(Esc · Tab 가둠 · 초점 돌려줌) · 뒤로 가기로 닫히는지.
- 결과: 2026-11-18 **검증 대기**(프런트 코드를 아직 안 고침). 미리 잰 것: 13px 글자로 폰 단계 이름 '표준견적서'(60px)가 한 칸 44px, 달력 칸 아래 '오후 잡힘'(51px)이 칸 41px에 안 들어가 모양을 바꿨어요(verification/design.md).

## 다시 볼 조건

- 태블릿 손님이 많아지거나(StatCounter 태블릿 비중), 접는 폰에서 768~1023 배치가 어색하다는 점검 결과가 나올 때
- 개발자 ADR이 PWA 말고 다른 앱 방식(감싼 앱 등)을 고를 때
- N5(옆 칸 스크롤 꾸미기 · 낮은 창 A/B/C/D)를 사용자가 고를 때 — 옆 AI 칸 높이 규칙을 그 결정으로 바꿔요
