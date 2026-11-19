# dev-08 폰 · 웹 배치: 같은 경로 + CSS 기준점, 옆 AI 칸 · 공사 띠는 레이아웃에

- 상태: 고름
- 날짜: 2026-11-18 · 쓴 역할: 개발자
- 관련 화면 · 이야기: c(폰) · d(데스크톱) 짝 전부, 9판 N2 A(옆 AI 칸) · W1 A(위 공사 띠) · W2 A(가운데 창) · W4 A(비교표) · I9(끌어다 놓기) · 관련 코드: `frontend/app/projects/[id]/layout.tsx`, `frontend/app/projects/[id]/vendors/@panel/`, `frontend/components/site/`, 새 `frontend/components/ai/`

## 배경

9판은 같은 일을 폰(c)과 데스크톱(d) 두 모양으로 그렸어요. 경로는 같아요(예: C07 · D01 모두 `/projects/{id}/standard`). 폰은 머리 '‹ 제목 · AI에게 묻기'와 아래 탭 바, 데스크톱은 위 공사 띠 + 오른쪽에 붙은 AI 칸(최소 높이 460px)이에요. 채팅은 데스크톱 2단(D05), 업체 작업함은 데스크톱 표 + 옆 자세히(D04)예요.

## 대안

| 안 | 내용 | 좋은 점 | 걸리는 점 |
| --- | --- | --- | --- |
| A | 같은 HTML + CSS 기준점(폰 < 768px · 태블릿 768~1023px는 폰 배치를 넓게 · 웹 ≥ 1024px), 구조가 다른 곳(AI 칸 · 공사 띠 · 채팅 목록)은 레이아웃에 두고 CSS로 숨김/보임 | 주소 · 캐시 하나 · 창 크기를 바꿔도 맞음 · 구글 권장(반응형) | 폰에서 안 보이는 데스크톱 조각도 HTML에 들어가요(가벼운 것만 두기) |
| B | 서버에서 기기 판별(`proxy.ts` userAgent)로 다른 화면을 다시 쓰기 | 폰에 필요 없는 HTML 안 보냄 | UA가 틀리면 잘못된 화면(iPad는 데스크톱 UA), `Vary: User-Agent` 캐시, 창 크기 바꾸면 안 맞음 |
| C | 병렬 경로로 폰 · 웹 화면 두 벌 | 화면마다 자유 | 같은 일을 두 벌 유지 · 조건 슬롯도 둘 다 서버에서 그림 |

## 고른 것과 이유

- 고른 안: **A**.
- 이유
  - 구글은 반응형을 '만들고 지키기 가장 쉬운' 방식으로 권하고, 동적 제공 · 별도 주소는 UA 판별과 `Vary`에 기대요(S31). B는 S30 `userAgent`로 할 수 있지만 판별이 틀릴 때 고칠 길이 없어요.
  - 병렬 경로는 조건으로 하나만 보여도 두 슬롯을 모두 서버에서 그려요(S29). 두 벌(C)은 비용만 두 배예요.
  - 레이아웃은 이동해도 다시 그리지 않아서, 옆 AI 칸을 `app/projects/[id]/layout.tsx`에 두면 표준견적서 → 업체 보기 → 실측 일정으로 옮겨도 대화가 이어져요(F7 A '같은 공사의 대화에 남아요').
  - 폰의 'AI에게 묻기'(C09 '라우트 모달')는 같은 AI 칸을 전체 화면으로 펼치고 주소에 `?ai=1`을 `history.pushState`로 붙여요. 뒤로 가기로 닫히고 서버 왕복이 없어요.
  - 지금 업체 자세히 옆 창(`vendors/@panel/(.)[vid]`)은 9판 D07(전체 화면 + 옆 AI 칸)과 겹쳐요. 가로채기 경로는 새로 고침 · 공유 주소에서는 어차피 전체 화면이에요(S28). 옆 칸이 둘이 되지 않게 이 가로채기 경로는 지워요(B2).

## 정한 세부

- 기준점: 768px · 1024px 두 값만 써요. CSS 변수는 미디어 쿼리 안에서 못 쓰니 숫자로 적고, `globals.css` 머리 주석에 두 값을 적어 둬요(B4). 스크립트가 알아야 할 때는 `lib/format.ts`가 아니라 B4의 `components/site/breakpoints.ts` 상수 하나만 써요.
- 껍데기(B4 `components/site/`): 폰 = 머리 + 아래 탭 바(고객: 홈 · 내 공사 · 채팅 · 알림 · 내 정보 / 업체: 작업함 · 채팅 · 업체 정보 · 알림), 웹 = 위 머리 메뉴 + (공사 화면이면) 공사 띠(6단계 · 지금 할 일 ▾).
- AI 칸(B5 `components/ai/AiPanel`): ≥1024px에서 본문 첫 흰 칸과 같은 윗줄에 붙고, 높이는 창 높이에 맞추되 460px 아래로 줄지 않아요. 대화 목록만 칸 안에서 스크롤해요(N2 A).
- 채팅(B2 `app/chat/layout.tsx`): ≥1024px는 왼쪽 목록 + 오른쪽 대화, 폰은 목록 화면 · 대화 화면이 따로예요(`useSelectedLayoutSegment`로 대화가 열렸는지 봐요).
- 끌어다 놓기(I9): 웹은 끌어다 놓기 + '파일 고르기', 폰은 눌러서 고르기만(`(pointer: coarse)`로 나눠요).
- 확인 창(W2 A · I5): 가운데 창은 `<dialog>` 하나를 폰 · 웹이 같이 써요(폰은 아래 시트 모양).

## 근거 (직접 열어 확인한 것만)

1. S31 Google 모바일 사이트 FAQ — https://developers.google.com/search/mobile-sites/faq (확인 2026-11-18)
2. S30 Next.js userAgent — https://nextjs.org/docs/app/api-reference/functions/userAgent (확인 2026-11-18)
3. S29 Next.js 병렬 경로 — https://nextjs.org/docs/app/api-reference/file-conventions/parallel-routes (확인 2026-11-18)
4. S28 Next.js 가로채기 경로 — https://nextjs.org/docs/app/api-reference/file-conventions/intercepting-routes (확인 2026-11-18)

## 검증

- 방법: 앱 안 브라우저로 폰 360px · 웹 1280px에서 화면마다 가로 스크롤 없음 · 누를 곳 44px(최소 40px), 1024px 경계에서 AI 칸이 바뀌는지, 폰에서 AI 칸 열고 뒤로 가기 → 닫힘, 표준견적서 → 업체 보기 이동 뒤 AI 대화가 남는지. e2e(B8)에 두 크기 프로젝트를 둬요.
- 결과: 검증 대기(B2 · B4 · B5).

## 다시 볼 조건

- 폰에서 데스크톱 조각 때문에 첫 화면이 무거워지면 → 그 조각만 `dynamic(import)` + `matchMedia`로 나중에 불러요.
- 태블릿 전용 배치를 그리기로 하면 → 기준점 하나를 더해요.
