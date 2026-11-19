# design-01 글꼴: Pretendard Variable 자체 호스팅

- 상태: 고름(넣는 것은 다음 제작 단계 · 글꼴 파일은 npm 패키지로 받아요)
- 날짜: 2026-11-18 · 쓴 역할: 디자이너
- 관련 화면 · 이야기: 모든 화면, 특히 금액 큰 숫자(C07 · C33 · D01 · D18) · 관련 코드: `frontend/app/layout.tsx`(지금 `next/font/google` Noto Sans KR), `frontend/app/globals.css`

## 배경

B(큰 숫자)는 금액을 800 굵기로 크게 쓰고, 금액 · 날짜를 줄 맞춰 견줘요. 지금 코드는 Noto Sans KR 400 · 500 · 700만 불러요. 폰(앱) · 웹 모두 같은 모양이어야 하고, 유료 글꼴 · 외부 요청은 쓰지 않아요. 디자인 방향 판도 'B는 실제 제품에서 Pretendard 권장 · 토스 서체는 토스 전용'이라고 적었어요.

## 대안

| 안 | 내용 | 좋은 점 | 걸리는 점 |
| --- | --- | --- | --- |
| A | Pretendard Variable, 가변 다이나믹 서브셋을 npm(`pretendard@1.3.9`)으로 받아 같은 주소에서 제공 | OFL(상업 · 수정 · 재배포 됨). 굵기 축 45~920 한 벌로 400~800. 다이나믹 서브셋이라 쪽에 든 글자 조각만 받아요. KRDS 표준 글꼴(Pretendard GOV)과 같은 뿌리 | 새 의존성(글꼴 패키지). 조각 CSS를 쓰면 next/font의 대체 글꼴 크기 맞춤을 못 받아 글꼴이 바뀔 때 흔들림(CLS)을 재야 해요. tnum 지원 확인 못 함 |
| B | Noto Sans KR 그대로(`next/font/google`, 빌드 때 받아 같은 주소에서 제공) | 지금 코드 그대로 · 새 의존성 없음 · 대체 글꼴 크기 맞춤 자동 | 600 · 800 굵기를 더하면 파일이 늘어요. 9판 시안 글꼴이라 바뀌는 것은 없지만 B 숫자 모양(좁고 단단한 숫자)과는 거리가 있어요 |
| C | 시스템 글꼴만(Apple SD Gothic Neo · 맑은 고딕 · Roboto/Noto) | 0바이트 | 기기마다 숫자 너비 · 굵기가 달라 금액 줄이 흔들려요. 윈도 맑은 고딕은 800 굵기가 없어요 |
| D | Pretendard GOV(공공 서비스용 변형) | KRDS가 쓰는 판 | 믿집은 공공 서비스가 아니에요. 일반 Pretendard와 차이를 이번에 확인하지 못했어요 |

## 고른 것과 이유

- 고른 안: **A**. 대체 순서는 Pretendard Variable → Pretendard → `-apple-system` · BlinkMacSystemFont · system-ui · Apple SD Gothic Neo · Noto Sans KR · 맑은 고딕(Pretendard README '같은 환경' 순서에서 이모지 글꼴만 뺌, 근거 3).
- 이유
  - 자유 이용: OFL이라 판매만 빼고 상업 · 수정 · 재배포가 돼요(근거 1). 토스 서체는 토스 전용이라 못 써요(내부 디자인 방향 판).
  - 크기: 한국어 글꼴은 통째로 약 4MB라 조각으로 나눠 받는 것이 기본이에요(근거 5). Pretendard 가변 글꼴 통째는 2,057,688바이트(근거 4)라, 폰 첫 화면에서 통째로 받지 않게 **가변 다이나믹 서브셋**을 써요(근거 1 · 3).
  - 굵기: 가변 축 하나로 400 · 600 · 700 · 800을 다 써요. `next/font/local`을 쓸 때는 weight '45 920'을 꼭 줘야 WebKit에서 굵기가 맞아요(근거 2).
  - 개인정보 · 외부 요청: 같은 주소에서 제공해요(next/font와 같은 원칙, 근거 6). CDN을 직접 부르지 않아요.
  - 공공 기준과 가까움: KRDS가 Pretendard GOV를 본문 글꼴로 써요(근거 7).

## 넣는 법(다음 제작 단계 · 이번엔 내려받지 않음)

1. 리드 확인 뒤 `pnpm add pretendard@1.3.9`(글꼴 패키지 하나, 지시문 3.4 '작은 라이브러리'로 이 ADR을 근거로 둬요).
2. `app/layout.tsx`에서 `import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css"`(파일 이름은 근거 3). Next가 CSS 안 woff2를 같은 주소로 옮기는지 빌드로 확인해요(확인 못 함 → 제작 때 `next build` 결과 `.next/static/media`에 woff2가 생기는지 봐요).
   - 빌드가 조각 woff2를 옮기지 못하면: `next/font/local`로 `PretendardVariable.woff2` 한 파일 + `weight: '45 920'` + `variable: '--mj-font-face'` + `display: 'swap'`(근거 2). 이때 첫 방문 글꼴 크기는 약 2MB라 폰에서 재 보고 다시 정해요.
3. 지금 Noto의 next/font 변수 이름 `--mj-font`는 새 토큰과 겹쳐서 `--mj-font-face`로 바꿔요. 토큰은 `--mj-font-sans: var(--mj-font-face, "Pretendard Variable"), …`.
4. 숫자: `.mj-num { font-variant-numeric: tabular-nums }`. Pretendard에 tnum이 있는지 확인 못 했어요 → 넣은 뒤 '1,111,111원'과 '8,888,888원' 너비를 재서 같으면 됨(없으면 숫자 칸만 `"Pretendard Variable"` 대신 고정폭 숫자가 있는 글꼴을 다시 골라요).
5. KRDS는 Pretendard GOV가 같은 px에서 작아 보여 본문 기본을 17px로 둔다고 적었어요(근거 7). 본문 16px는 사용자 결정이라 그대로 두고, 화면 점검에서 작게 느껴지면 리드가 사용자에게 물어요.

## 근거 (직접 열어 확인한 것만)

1. Pretendard 저장소 — https://github.com/orioncactus/pretendard (확인 2026-11-18) — OFL, 다이나믹 서브셋(쪽에 든 글자만 받음), 가변 다이나믹 서브셋이 더 작음, v1.3.9
2. Pretendard 패키지 README — https://raw.githubusercontent.com/orioncactus/pretendard/main/packages/pretendard/README.md (확인 2026-11-18) — `next/font/local` 예시 `weight: '45 920'`, 안 주면 WebKit 굵기 오류
3. Pretendard 영문 README — https://cdn.jsdelivr.net/npm/pretendard@1.3.9/docs/en/README.md (확인 2026-11-18) — 대체 글꼴 순서 두 가지, `pretendardvariable-dynamic-subset.css` 경로
4. Debian fonts-pretendard 1.3.9 — https://sources.debian.org/src/fonts-pretendard/1.3.9-2/web/variable/woff2 (확인 2026-11-18) — PretendardVariable.woff2 2,057,688바이트
5. Google Fonts 한국어 지원 — https://developers.googleblog.com/google-fonts-launches-korean-support/ (확인 2026-11-18) — 한국어 글꼴 약 4MB, unicode-range 조각
6. Next.js 글꼴 — https://nextjs.org/docs/app/getting-started/fonts (확인 2026-11-18) — 글꼴을 같은 주소에서 제공, 브라우저가 Google에 요청하지 않음, `next/font/local`
7. KRDS 타이포그래피 접근성 — https://www.krds.go.kr/html/site/style/style_03.html (확인 2026-11-18) — 본문 최소 16px, Pretendard GOV는 작아 보여 17px 기본, 줄 높이 150%
8. Apple HIG 글자 — https://developer.apple.com/design/human-interface-guidelines/typography (확인 2026-11-18) — iOS 기본 17pt · 최소 11pt(우리 최소 13px는 그보다 커요)

## 검증

- 방법
  - 글꼴 크기: 넣은 뒤 C07(표준견적서) · D01을 앱 안 브라우저로 열고 Network에서 woff2 합계를 재요(목표: 첫 화면 300KB 아래 — 목표는 디자이너 제안).
  - 흔들림: Lighthouse CLS 0.1 아래.
  - 숫자: 위 4번 너비 비교.
  - 360px 폰에서 28px 금액 '1,234만 5,678원'이 묶음 안에 들어가는지.
- 결과
  - 2026-11-18: 글꼴을 아직 넣지 않아 **검증 대기**.
  - 대신 어림 측정(실제로 돌림): 이 PC의 Noto Sans KR 가변(Black) · 맑은 고딕 굵게로 28px '1,234만 5,678원'이 212px · 208px → 360px 폰 묶음 안 288px에 들어가요(verification/design.md). Pretendard로는 다시 재야 해요.

## 다시 볼 조건

- 다이나믹 서브셋 조각을 Next 빌드가 못 옮기거나, 첫 화면 글꼴이 300KB를 넘을 때
- Pretendard에 tnum이 없을 때
- 화면 점검에서 본문 16px가 작다는 말이 나올 때(17px 예외를 사용자에게 물음)
- 오프라인 앱(PWA 캐시)을 하게 되면 글꼴 캐시 방식도 다시 봐요
