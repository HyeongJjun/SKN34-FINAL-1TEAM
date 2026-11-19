# design-04 아이콘: 자체 `Icon` 컴포넌트 하나 + 모자란 모양은 Lucide(ISC) 경로를 옮겨 씀

- 상태: 고름
- 날짜: 2026-11-18 · 쓴 역할: 디자이너
- 관련 화면 · 이야기: 탭 바(C23 C24 C40~C45 · V02 V03 V08 V19 V21 V24 V25), 머리 ‹ × ⋯, 끌어다 놓기, 빈 화면, 상태(N4 C), 별점 · 관련 코드: `components/vendors/icons.tsx`, `components/project/overview/icons.tsx`(지금 흩어진 손그림 SVG)

## 배경

9판은 아이콘 11개(홈 · 서류 · 채팅 · 알림 · 사람 · 상자 · 가게 · 사진기 · 핀 · 체크 · 달력)를 선 1.8 스프라이트로 그렸고, 나머지는 글자 기호(‹ › × ⋯ ＋ ★ ✓ ● ○ ! – ↗ ▾)를 썼어요. 지금 코드는 아이콘을 파일 두 곳에 14 · 16 · 20 · 28 격자, 선 1.6~2.2로 따로 그렸어요. 글자 기호는 글꼴마다 모양 · 굵기가 달라요(Pretendard로 바꾸면 더). v3에 필요한 아이콘은 25개 안팎이에요.

## 대안

| 안 | 내용 | 좋은 점 | 걸리는 점 |
| --- | --- | --- | --- |
| A | 지금처럼 손그림 SVG를 화면마다 | 의존성 없음 | 격자 · 선 굵기가 제각각, 같은 아이콘을 여러 번 그림 |
| B | `lucide-react` 패키지 | 1,500개 넘음 · 24 격자 · 가져온 것만 묶음에 들어감 · 기본 `aria-hidden` | 새 의존성 · 버전 따라가기. 흔한 모양(B의 아쉬운 점 '흔한 얼굴') |
| C | Material Symbols 글꼴 | 아이콘이 아주 많음 · Apache 2.0 | 글꼴 파일(기본 약 295KB, 축 전부 약 7.9MB) · 글자 깜빡임(ligature) · 안드로이드 느낌 |
| D | **자체 `Icon` 컴포넌트 하나(24 격자 · 선 1.8 · `currentColor` · 기본 `aria-hidden`) + 9판 11개는 그대로 옮기고, 모자란 모양은 Lucide에서 경로만 옮김(저작권 표시 함께)** | 의존성 없음 · 9판 모양 유지 · 한 격자 · 서버 컴포넌트에서 인라인 SVG로 바로 그림 | 아이콘을 늘릴 때 사람이 옮겨야 해요 |

## 고른 것과 이유

- 고른 안: **D**.
- 이유
  - 필요한 수가 적어요(25개 안팎). 적은 아이콘은 컴포넌트로 바로 그리는 편이 단순해요. 화면에 쓰는 것만 묶음에 들어가는 점은 B와 같아요(근거 2).
  - Lucide는 ISC 허가서(Feather에서 온 아이콘은 MIT)라 경로를 옮겨 써도 돼요. 허가서 문구를 `Icon.tsx` 머리 주석(또는 `components/v3/ui/ICONS_LICENSE.txt`)에 남겨요(근거 1).
  - 접근성: 꾸밈 아이콘은 `aria-hidden="true"`, 아이콘만 있는 단추는 단추에 이름(숨은 글자 권장)을 줘요(근거 3). 상태 아이콘은 늘 글자와 함께(N4 C · Carbon 16px 아이콘 + 14 글자, 근거 4).
  - 글자 기호 대신 아이콘: ‹(뒤로) · ×(닫기) · ⋯(더 보기) · ＋ · ★ · ✓ · ↗(새 창) · ▾(펼침) · ›(자세히)를 아이콘으로 바꿔 글꼴이 바뀌어도 같은 모양 · 같은 굵기로 보여요. 상태 기호(● ○ ✓ – !)도 아이콘으로 그리되 모양은 9판 그대로.
  - C는 글꼴 파일 · 글자 깜빡임 때문에 빼요(근거 5).

## 목록(제안 · 24 격자 · 선 1.8)

| 묶음 | 아이콘(코드 이름) |
| --- | --- |
| 탭 · 머리 | `home` · `doc` · `chat` · `bell` · `user` · `box`(작업함) · `store`(업체 정보) · `back` · `close` · `more` · `chevron-right` · `chevron-down` |
| 일 | `camera` · `upload` · `pin` · `calendar` · `plus` · `send` · `external`(새 창) · `search` · `lock` |
| 상태 | `dot-todo`(●) · `ring-wait`(○) · `check`(✓) · `dash-done`(–) · `alert-late`(!) · `star` · `star-outline` · `warn`(주의 줄) |

- 크기: 24(기본) · 20(줄 안) · 16(상태 · 글자 단추 옆). 선 굵기는 크기와 상관없이 1.8(작은 크기에서 2).
- 색: `currentColor`. 상태 아이콘만 `--mj-st-*`, 나머지는 글자색을 따라가요.

## 근거 (직접 열어 확인한 것만)

1. Lucide LICENSE — https://github.com/lucide-icons/lucide/blob/main/LICENSE (확인 2026-11-18) — ISC, Feather에서 온 아이콘은 MIT 부분이 함께 있음
2. Lucide React — https://lucide.dev/guide/packages/lucide-react (확인 2026-11-18) — 아이콘마다 인라인 SVG 컴포넌트, 가져온 것만 묶음에 들어감
3. Lucide 접근성 — https://lucide.dev/guide/accessibility (확인 2026-11-18) — 기본 `aria-hidden="true"`, 아이콘만 있는 단추는 단추에 이름(숨은 글자가 더 믿을 만함)
4. Carbon 상태 표시 — https://carbondesignsystem.com/patterns/status-indicator-pattern/ (확인 2026-11-18) — 아이콘 + 모양 + 색 + 글자, 16px 아이콘 + 14 글자, 상태 색 3:1
5. Material Symbols 안내 — https://developers.google.com/fonts/docs/material_symbols (확인 2026-11-18) — Apache 2.0, 기본 약 295KB · 축 전부 약 7.9MB, `display=block`으로 글자 깜빡임을 막아야 함
6. (내부) 9판 원본 HTML 스프라이트 11개 · `screens.css` `.k-ic`(24 · 선 1.8 · round)

## 검증

- 방법: 제작 뒤 (1) 아이콘만 있는 단추마다 이름이 읽히는지 axe로, (2) 탭 바 · 머리 아이콘이 360px · 1280px에서 같은 굵기로 보이는지 화면 점검, (3) `grep`으로 화면 코드에 글자 기호(‹ › × ⋯ ★)가 남지 않았는지.
- 결과: 2026-11-18 **검증 대기**(코드 전).

## 다시 볼 조건

- 아이콘이 40개를 넘거나 목공 · 관리자 화면에서 새 아이콘이 자주 필요하면 `lucide-react` 패키지(B)로 바꿔요.
- 브랜드 아이콘 세트를 따로 만들게 되면
