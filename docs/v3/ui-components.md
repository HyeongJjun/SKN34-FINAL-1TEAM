# 믿집 v3 ui 조각 · 앱 껍데기 (B4)

- 쓴 날: 2026-11-18 · 쓴 역할: B4(디자인 체계 · 앱 껍데기) · 상태: 2차(1차 + 탭 · 표 · 나눔 칸 · 켜기/끄기 · 체크 · 요약 칸 · 파일 줄 · 안내 상자 · 얼굴 · 진행 중 띠 · 기록 · 접는 목록 · 사진 칸 · 실시간 한 줄기 자리 · PWA) + 3차(공정표 칸 `ScheduleChart` · 크게 보기 `Lightbox`).
- 읽는 이: B2(고객 화면) · B3(업체 · 관리자 화면) · B5(AI 칸). 이 문서만 보고 쓸 수 있게 경로 · props · 쓰는 화면 · 폰/웹 차이 · 예시를 적었어요.
- 모양 기준: 9판 화면(`design/screens/*.html`) · `design-system.md`. 검증 숫자: `verification/b4.md`.
- 한눈에 보기: 개발 서버에서 `/dev/ui`(조각 모음, 빌드 · 운영에서는 404).

## 0. 먼저 지킬 것

1. **숫자는 계산 엔진 값만.** 조각은 금액 · 날짜 · 기한을 만들지 않고 모양만 바꿔요(`lib/format.ts`). `Money` · `QuoteLines` · `CalcBox`에는 API 값을 그대로 넘겨요.
2. **색 · 글자 크기는 토큰만.** 화면 CSS는 2 · 3층 토큰(`--mj-text-sub` · `--mj-type-label` · `--mj-btn-h-md` …)만 써요. 1층(`--mj-gray-500`)은 쓰지 않아요. 간격만 `--mj-space-*`를 바로 써요. 글자 크기는 13 · 14 · 16 · 18 · 20 · 28 · 38 일곱 단계뿐이에요.
3. **기준점 둘: 768 · 1024.** 폰 < 768 · 태블릿 768~1023(웹 머리 + 본문 한 줄) · 웹 ≥ 1024(본문 + 옆 칸 · 공사 띠 전부) · 넓은 웹 ≥ 1280(여백 28 · 옆 칸 344). CSS는 숫자로, 스크립트는 `components/site/breakpoints.ts`의 `BP` · `MQ` + `useMedia()`만.
4. **누를 곳 44, 촘촘한 곳 40.** 조각이 이미 맞춰 뒀어요. 화면에서 새 링크 · 단추를 만들면 `min-height: var(--mj-hit)`(또는 `--mj-hit-min`)을 줘요. 글 속 링크만 예외(`Button variant="inline"`).
5. **옛 이름은 별칭이에요.** `--ink` · `--accent` · `--surface` · `--fs-*` · `--radius*` 같은 v2 이름은 `globals.css` 맨 위에서 새 토큰을 가리켜요. 옛 화면은 그대로 돌고, 새 코드는 `--mj-*`만 써요. 옛 공용 클래스(`mj-btn` · `mj-input` · `mj-st` …)도 그대로 있어요.
6. **화면 글**은 해요체 · 영어 상태값 없음. 상태 이름은 `lib/labels.ts`의 `visitState()`를 써요.

## 1. 화면 틀(뼈대) 예시

붙는 머리 · 공사 띠 · 아래 띠는 `<body>` 바로 아래(다른 칸으로 감싸지 않게) 둬야 화면 끝까지 붙어요. 순서: 머리 → (공사 띠) → `Main` → (`BottomBar` 또는 `TabBar`).

```tsx
// 공사 화면(예: /projects/[id]/standard) — 웹: 머리 + 공사 띠 + 이동 경로 · 제목 + [본문 | 옆 AI 칸], 폰: ‹ 제목 · AI에게 묻기 + 아래 단추 띠
import { AppHeader } from "@/components/site/AppHeader";
import { ProjectBand } from "@/components/site/ProjectBand";
import { Main, PageHead, WithAside } from "@/components/site/Frame";
import { AsideOpenButton } from "@/components/site/AsideSlot";
import { BottomBar } from "@/components/ui/BottomBar";
import { Button } from "@/components/ui/Button";

export default async function Page() {
  return (
    <>
      <AppHeader phone={{ title: "표준견적서", back: `/projects/${id}`, action: <AsideOpenButton /> }} />
      <ProjectBand name="상계동 아파트 도배" href={`/projects/${id}`} current={1} todo={[{ label: "업체 보기", href: `/projects/${id}/vendors` }]} />
      <Main>
        <PageHead title="표준견적서" crumbs={[{ label: "내 공사", href: "/my" }, { label: "상계동 아파트 도배", href: `/projects/${id}` }, { label: "표준견적서" }]} />
        <WithAside aside={<AiPanel projectId={id} />}>{/* 본문 묶음들 */}</WithAside>
      </Main>
      <BottomBar note="시장 데이터 기준으로 계산한 참고 금액이에요. 업체 견적이 아니에요.">
        <Button variant="secondary" size="lg" href={`/projects/${id}/plan`}>예상 공정표</Button>
        <Button size="lg" href={`/projects/${id}/vendors`}>업체 보기</Button>
      </BottomBar>
    </>
  );
}
```

```tsx
// 탭 화면(홈 · 내 공사 · 채팅 · 알림 · 내 정보 / 업체 작업함 · 업체 정보): 폰은 로고형(또는 제목만) 머리 + 아래 탭 바
<>
  <AppHeader phone={{ title: "알림" }} />   {/* 첫 화면(홈 · 작업함)은 phone 없이 → 로고형 */}
  <Main><PageHead title="알림" />{/* … */}</Main>
  <TabBar />                                  {/* 손님 · 관리자는 아무것도 그리지 않아요 */}
</>
```

- 레이아웃이 웹 머리를 그리고 화면이 폰 머리만 다르게 쓰고 싶으면: 레이아웃 `<AppHeader only="web" />` + 화면 `<AppHeader only="phone" phone={{ … }} />`. 이때도 둘 다 `<body>` 바로 아래(레이아웃은 감싸지 않는 조각 `<>…</>`)에 둬요.
- 아래 단추 띠가 있는 흐름 화면에는 `TabBar`를 두지 않아요(9판 규칙).
- 옛 화면은 `SiteHeader`를 그대로 써요(아래 2.2).

## 2. 껍데기 `components/site/`

### 2.1 `AppHeader` — 역할별 머리(서버)

- 경로: `components/site/AppHeader.tsx` (모양은 `HeaderBar.tsx`)
- props: `phone?: { title; back?; close?; action?; lead?; dark? }` · `only?: "web" | "phone"` · `admin?: boolean`
- 쓰는 화면: 거의 모두(폰 C01~C63 · V01~V25, 웹 A01~A04 · D01~D19)
- 폰(< 768) 52px: `phone`을 주면 뒤로형(‹ 44×44 '뒤로' + 제목 18/700 + 오른쪽 단추 하나), `close`면 닫기형(× '닫기'), `dark`면 사진 보기. 안 주면 로고형(손님은 오른쪽 '로그인'). 길 찾기는 `TabBar`.
- 웹(≥ 768) 64px: 로고(+ '업체' · '관리자') + 역할 메뉴 + 오른쪽 '알림 n'(펼침) · '이름 ▾'(내 정보 · 자주 묻는 질문 · 로그아웃). 손님은 '로그인'.
  - 손님: 표준견적서 받기 · 자주 묻는 질문 / 고객: 표준견적서 받기 · 내 공사 · 채팅 / 업체: 작업함 · 채팅 · 업체 정보(W6 B) / 관리자: 업체 심사 · 신고 · 링크 · 회원 — '표준견적서 받기'는 copy-fixes CF-09
  - 메뉴 · 로고 링크는 너비도 44 이상. 머리는 늘 한 줄(64)이고, 승인 전 업체 안내('심사 중이라 승인 뒤 열려요')는 좁으면 말줄임(다 읽는 글은 `title` · 잠긴 메뉴의 `aria-describedby`).
  - '이름 ▾ → 로그아웃'(`components/site/logout.ts`)은 서버 세션을 지운 뒤 이 기기의 손님 답(B2a `lib/guest/store.ts` `clearGuest()`)도 지워요(security-02 #6).
  - 승인 전 업체는 작업함 · 채팅이 잠기고 옆에 잠금 문구(`nav.ts` `vendorLock`).
- 붙는 머리(`position: sticky`). `scroll-padding-top`이 머리 + 공사 띠 높이만큼 잡혀 있어 초점이 가려지지 않아요.
- 메뉴 · 탭 목록 · 지금 메뉴 판단은 `components/site/nav.ts`(`NAV` · `TABS` · `ACCOUNT` · `isCurrent`).
- `/chat` · `/admin/reports`는 9판 메뉴대로 먼저 넣었어요. B2 · B3가 화면을 만들기 전까지 404예요.

```tsx
<AppHeader />                                                       // 홈 · 작업함: 폰 로고형
<AppHeader phone={{ title: "실측 일정", back: `/projects/${id}`, action: <AsideOpenButton /> }} />
<AppHeader phone={{ title: "마루와벽", back: "/chat", lead: <Avatar …/>, action: <Menu label="더 보기" icon="more" items={…} /> }} />
<AppHeader phone={{ title: "시공 사례", close: `/projects/${id}/vendors/${vid}`, dark: true }} />
```

### 2.2 `SiteHeader` — 옛 화면 머리(그대로)

- 경로: `components/site/SiteHeader.tsx` · props: `variant?: "user" | "admin"`
- 웹 머리는 v3와 같고, 폰은 로고 + 종 + '메뉴' 펼침(옛 모양)이에요. 붙지 않는 머리라 옛 화면의 붙는 옆 칸을 가리지 않아요. 고객이면 오른쪽 아래 '공사 상담'(예시 답변)이 B5의 AI 칸으로 바뀌기 전까지 남아요.
- 새 화면은 `AppHeader` + `TabBar`로 바꿔요. `app/error.tsx`는 `HeaderBar`를 그대로 써요.

### 2.3 `TabBar` — 폰 아래 탭 바(서버)

- 경로: `components/site/TabBar.tsx`(모양 `TabBarNav.tsx`) · props 없음(로그인한 역할로 그려요)
- 고객 5칸 홈 · 내 공사 · 채팅 · 알림 · 내 정보 / 업체 4칸 작업함 · 채팅 · 업체 정보 · 알림. 64px + 아래 안전 영역, 아이콘 24 + 글자 13, 탭 58×56(360px 폰).
- 알림 수는 빨간 수 + 읽는 이름 '알림, 새 알림 3개'. 폰만(≥ 768에서는 숨김). `Main` 바로 뒤에 둬요(붙는 띠라 본문을 가리지 않아요).
- 쓰는 화면: C23 C24 C40 C41 C42 C44 C45 C53 · V02 V03 V08 V19 V21 V24 V25

### 2.4 `ProjectBand` — 위쪽 공사 띠(W1 A)

- 경로: `components/site/ProjectBand.tsx`
- props: `name` · `href`(한 공사 화면) · `current`(0부터) · `steps?`(기본 6단계, `href`를 주면 끝난 · 지금 단계가 링크) · `sub?: { steps; current }`(실측 뒤 작은 단계) · `todo?: BandTask[]` · `waiting?: BandTask[]` · `sticky?`(기본 true)
  - `BandTask = { label: "마루와벽 날짜 고르기"; href?; due?: "11.19(목) 21:40까지" }` — `due`는 `dueText()` 값
- 웹 ≥ 1024: 공사 이름 · 6단계 막대 + 이름(13) · 지금 할 일 상자(76px, 작은 단계가 있으면 92px). 768~1023: 한 줄 56px(공사 이름 · '지금 4/6 · 실측 일정' · 할 일). 폰: 숨김.
- 할 일 · 기다림이 둘 이상이면 상자 전체가 '지금 할 일 n · 기다림 n ▾' 펼침 단추 → 업체별 줄(44px, '할 일' · '기다림' 표시). 하나면 상자 전체가 그 링크. Esc · 바깥 누르기로 닫히고 초점이 돌아와요.
- 단계 링크는 링크 자체가 막대 + 이름 칸(40px)이고, 작은 단계 알약 링크도 알약(22px)은 그대로 두고 링크만 위아래 40px예요. 띠 높이(76 · 92)는 그대로예요.
- 쓰는 화면: D01 D03 D06 D07 D08 D15~D19 + 모든 웹 공사 화면. B2는 `app/projects/[id]/layout.tsx`에서 그려요.

```tsx
<ProjectBand name="상계동 아파트 도배" href={`/projects/${id}`} current={3}
  todo={[{ label: "마루와벽 날짜 고르기", href: `/projects/${id}/visits/${v1}` }]}
  waiting={[{ label: "결도배 답 기다림", due: dueText(v2.reply_due_at) }]} />
<ProjectBand name="…" href="…" current={5} sub={{ steps: AFTER_VISIT_STEPS, current: 2 }} todo={[{ label: "공사 날짜 수락", href: "…" }]} />
```

### 2.5 `Main` · `PageHead` · `WithAside` — 본문 틀

- 경로: `components/site/Frame.tsx`
- `Main({ children, narrow? })`: `<main id="main">`(건너뛰기 링크가 가는 곳) · 옆 여백 16/24/28 · 최대 1200(narrow 780) · 묶음 사이 12/16.
- `PageHead({ title, crumbs?, desc?, badge?, action?, phoneTitle? })`: 웹은 이동 경로(14 · 회색 · 밑줄 없음, 줄 40) + 제목 20/800 + 설명 14. 폰은 머리가 제목을 보여서 h1을 숨기고(읽기에는 남음) 설명만 보여요. 머리가 로고형이면 `phoneTitle`.
- `WithAside({ children, aside?, label? = "AI에게 묻기" })`: ≥ 1024에서 `[본문 | 옆 칸 320(넓은 웹 344)]`. 옆 칸이 없으면 본문 한 줄. 태블릿(768~1023)은 본문 위 오른쪽에 'AI에게 묻기' 단추를 하나 그려요(웹 머리라서).

### 2.6 옆 AI 칸 자리 `AsideSlot` · `AsidePanel` · `AsideOpenButton`(N2 A) — 내용은 B5

- 경로: `components/site/AsideSlot.tsx`
- 웹 ≥ 1024: 본문 첫 묶음과 같은 윗줄에서 시작해 붙어요.
  - 붙은 뒤: `top: min(위 띠 + 16px, 100dvh − 476px)` · `height: max(460px, 100dvh − 위 띠 − 32px)`. 창이 낮으면 입력 칸이 창 아래에 붙어요(1280×620에서 위 144 · 아래 604). 9판의 `100cqh`(위 띠 아래 스크롤 칸 높이)를 실제 화면에서는 `100dvh − --mj-sticky-top`으로 계산해요(토큰 `--mj-aside-top` · `--mj-aside-h`).
  - 붙기 전(첫 화면): 높이 = `100dvh − 칸이 시작하는 위치 − 16px`(최소 `--mj-aside-start-min-h` 320)라 입력 칸이 처음부터 창 안이에요. 내리면 아래 끝은 그대로이고 위만 올라가다 붙어요.
  - 칸이 시작하는 위치는 `AsideSlot`이 재서 `--mj-aside-start`로 넘겨요. 스크립트 전 첫 그림은 위 띠 + 108(이동 경로 + 제목 한 줄)로 짐작해요.
  - 칸 안 내용(B5)은 `AsidePanel`의 `height: 100%`를 따르면 돼요. 칸 높이를 따로 정하지 않아요.
- 폰 · 태블릿: 숨겨 두고 `AsideOpenButton`(또는 `openAside()`)을 누르면 전체 화면 층(`role="dialog"`)으로 열려요. 주소에 `?ai=1`을 얕게(`history.pushState`) 붙여 뒤로 가기 · × · Esc로 닫혀요. 열리면 칸 제목으로 초점이 가고 뒤 페이지는 멈춰요.
- `AsidePanel({ title, head?, foot?, children, listLabel? })`: 머리(제목 + 층일 때 ×) · 스크롤 목록(대화만 칸 안에서 스크롤, `overscroll-behavior: contain`, 얇은 막대 8px) · 바닥(빠른 질문 칩 · 입력 칸, 늘 보임).
- `useAside()` → `{ layer, close, titleId }`(B5가 층인지 알아야 할 때).
- 접은 모양(9판 '접기')은 N5와 함께 고를 일이라 아직 없어요. `head`에 자리만 있어요.

```tsx
// B5
<WithAside aside={<AsidePanel title="AI에게 묻기" listLabel="AI 대화" foot={<><QuickChips/><Composer/></>}>{messages}</AsidePanel>}>…</WithAside>
```

### 2.7 알림 종 · 펼침 `NotifyBell`

- 경로: `components/site/NotifyBell.tsx` — `AppHeader`가 고객 · 업체 웹 머리에 넣어요(따로 쓸 일은 없어요).
- '알림 n'(44px, 읽는 이름 '알림, 새 알림 3개') → 펼침 370px: 최근 5개(`NotifyRow`) · '모두 읽음'(`POST /notifications/read-all`) · '모두 보기'(`/notifications`). 펼칠 때만 `GET /notifications`를 불러요. 알림을 누르면 `POST /notifications/{id}/read`를 보내고 그 일로 가요(`link`가 사이트 안 경로일 때만).
- 안 읽은 수는 서버가 그린 값으로 시작하고, 실시간 한 줄기(`LiveProvider`)의 `notif`로 바뀌어요. 펼쳐 둔 채 새 알림이 오면 목록을 다시 불러요. 아래 탭 바 '알림' 수도 같은 값이에요.

### 2.8 실시간 한 줄기 자리 `LiveProvider` · `useLive`(routes.md 3장)

- 경로: `components/site/LiveProvider.tsx` — `app/layout.tsx`가 한 번 감싸요(탭 하나에 연결 하나). 줄기를 여는 코드는 B2b `lib/backend/stream.ts`의 `openStream`(EventSource `/api/stream` · 다시 잇기 · resync)이고 여기 `SOURCE`에 이어 뒀어요.
- 이벤트(api.md 8장): `ready` · `msg {thread_id, seq}` · `read {thread_id, seq}` · `notif {unread}` · `state {kind, project_id, id}` · `resync {}` — 타입 `LiveEvent` · `LiveType` · `LiveSource`.
- `useLive()` → `{ unread, setUnread, subscribe, publish, connected }`
- `useLiveEvent(type | "*", fn)` — 화면에서 듣기. 예: `useLiveEvent("state", (e) => { if (e.data.project_id === id) router.refresh(); })` · 채팅은 `msg`, 놓친 게 있으면 `resync`에서 다시 읽어요.
- `useLiveUnread(서버 값)` — 머리 · 탭 바의 안 읽은 수. 마지막에 알게 된 값이 이겨요(서버가 새로 그린 값 · `notif` · 화면의 `setUnread`). 알림 화면(B2)에서 읽음 처리한 뒤 `useLive().setUnread(n)`을 불러 주세요.
- 줄기에는 id만 와요. 원본은 늘 REST로 다시 읽어요(B2b stream.ts 머리말). 보기용 머리처럼 따로 떼어 둘 곳만 `<LiveProvider source={null}>`.

### 2.9 앱 설치(PWA, dev-01)

| 파일 | 하는 일 |
| --- | --- |
| `app/manifest.ts` | `/manifest.webmanifest`: 이름 · 짧은 이름 '믿집' · `start_url` `/` · `display: standalone` · `lang: ko` · 바탕 · 머리 색 흰색 · 아이콘 3개. 화면 방향은 막지 않아요(WCAG 1.3.4) |
| `app/icons/mark.tsx` · `app/icons/[id]/route.tsx` | Next `ImageResponse`로 그린 PNG(내려받는 파일 없음, 빌드 때 정적): `/icons/192.png` · `/icons/512.png`(둥근 네모) · `/icons/maskable-512.png`(꽉 찬 바탕 · 그림 80%) |
| `app/apple-icon.tsx` | iOS 홈 화면 180 PNG(꽉 찬 바탕). Next가 `<link rel="apple-touch-icon">`을 넣어요 |
| `app/icon.svg` | 브라우저 탭 아이콘(파랑 `#1b66d8`로 바꿈) |
| `app/offline/page.tsx` | 오프라인 안내 한 장('인터넷에 연결되지 않았어요' + [다시 시도] = 같은 주소 다시 열기). 로그인 정보 · 공사 내용은 넣지 않아요 |
| `public/sw.js` | 설치 때 `/offline`과 그 CSS만 받아 둬요. 화면 열기가 네트워크로 안 되면 원래 주소 그대로 오프라인 안내. 화면 · API · 글꼴 · 사진은 받아 두지 않아요. 머리는 B7 `next.config.ts` |
| `components/site/SwRegister.tsx` | 운영에서만 `/sw.js` 등록(`updateViaCache: "none"`). 개발에서는 등록된 워커를 지워요(옛 화면이 남지 않게) |
| `app/layout.tsx` | 뿌리를 요청 때 그려요(`await connection()`, B7 nonce CSP). `viewport-fit=cover` · `theme-color #ffffff` · `apple-mobile-web-app-capable` · 제목 '믿집'. 앱 모드 안전 영역은 머리 위(`body::before`) · 탭 바 · 아래 단추 띠(`--mj-safe-bottom`)가 비워요 |

- 앱 모드에서만 숨길 것(예: '앱처럼 쓰기' 안내)은 `.mj-browser-only` 클래스를 붙여요(`display-mode: standalone`에서 숨김).
- `sw.js`를 바꾸면 안의 `CACHE` 판 번호를 올려요.

## 3. ui 조각 `components/ui/`

| 조각 | 파일 | 서버 화면에서 | 쓰는 화면(9판) |
| --- | --- | --- | --- |
| 아이콘 | `Icon.tsx` | 됨 | 탭 바 · 머리 · 끌어다 놓기 · 빈 화면 · 상태 |
| 단추 · 글자 단추 · 아이콘 단추 | `Button.tsx` | 됨(글 · href만) | 87곳 |
| 아래 단추 띠 | `BottomBar.tsx` | 됨 | 40곳(C02~C08 · C13 · C16 … · V01 …) |
| 입력 칸 · 여러 줄 · 고르기 | `Field.tsx` | 브라우저 | 19곳 + 여러 줄 C39 V25 |
| 고르기 칩 | `ChoiceChip.tsx` | 브라우저 | 27곳 |
| 단계 · 작은 단계 | `Steps.tsx` | 됨 | C42 C43 D09 |
| 금액 · 큰 숫자 | `Money.tsx` | 됨 | 큰 숫자 37곳 · 중간 23곳 |
| 견적서 줄 표 | `QuoteLines.tsx` | 됨 | C01 C07 C11 C40 C41 C57~C60 D01 D07 D10 D12 D13 |
| 믿집 계산 상자 | `CalcBox.tsx` | 됨 | C03 C09 D01 D03 D06 D07 D15 D16 D18 V10 V12 |
| 업체 카드 · 담기 띠 | `VendorCard.tsx` | 브라우저 | C10 C12 D06 |
| 비교표(업체를 열로) | `CompareTable.tsx` | 됨 | D03 D18 · 폰 카드 C14 C15 C18 C20 C32 C33 |
| 상태 칩 · 범례(N4 C) | `StateTag.tsx` | 됨 | D04 V03 V08 · C14 D03 |
| 배지 · 안 읽은 수 · 기한 배지 | `Badge.tsx` | 됨 | 35곳 |
| 가운데 창 · 확인 창(W2 A) | `Dialog.tsx` | 브라우저 | A04 C34 C41 C59 C61 D13 + 웹으로 옮긴 시트 |
| 아래 시트 ↔ 가운데 창 · 고르기 줄 | `Sheet.tsx` | 브라우저 | 12곳(C03 C15 C30 C31 C49 C52 C53 C58 V05 V25 …) |
| 작은 메뉴 ↔ 시트 | `Menu.tsx` | 브라우저 | ⋯ C29 · + C26 · 웹 D05 D09 |
| 알림 줄 · 묶음 | `NotifyRow.tsx` | 브라우저 | C44 V21 · 웹 D09 |
| 빈 화면 | `EmptyState.tsx` | 됨 | C23 C56 · C12 C22 |
| 끌어다 놓기 칸(I9) | `FileDrop.tsx` | 브라우저 | C13 C26 C39 V01 V10 V12 V13 V14 V16 |
| 달력 · 범례 | `Calendar.tsx` | 브라우저 | C13 C16 C19 C21 C28 C35 C52 V04 V07 V11 D14~D17 |
| 반나절 칸 | `HalfDayPicker.tsx` | 브라우저 | C16 C19 C21 C61 D15 D16 |
| 별점 · 별 고르기 | `Stars.tsx` | 브라우저 | 보여 주기 C10 C11 C48 C49 D06 D07 V24 V25 · 고르기 C39 |
| 토스트 | `Toast.tsx` | 브라우저(`useToast`) | 저장 · C16 '방금 다른 고객이 골랐어요' |
| 탭 · 거르기 알약 · 종류 알약 | `Tabs.tsx` | 주소 탭은 됨(href) · 이 화면 안 탭은 브라우저 | C11 D07 C43 C63 V15 · 작업함 V03 D04 V08 · 관리자 A02 |
| 표 + 옆 자세히 칸 · 폰 카드 | `DataTable.tsx`(+ `ScrollBox.tsx`) | 됨(`onSelect`만 브라우저 조각 안) | D04 V03 · A01~A04 · D02 D19 |
| 나눔 칸 | `Segmented.tsx` | 브라우저 | A03 C02 C03 C11 C55 D02 D07 D11 V10 V12 V15 |
| 켜기/끄기 | `Switch.tsx` | 브라우저 | D14 V04 V05 V15 |
| 체크 · 체크 묶음 | `Check.tsx` | 브라우저 | A01 A02 A04 C05 C13 C36 D08 D19 V02 V05 |
| 요약 칸 | `Summary.tsx`(`SummaryRows` · `KeyValue`) | 됨 | C15 C17 C34 C61 D04 · D14 D19 · 옆 칸 |
| 파일 줄 | `FileRow.tsx` | 됨 | A01 A04 C33 D18 V01 V10 V14 |
| 안내 상자 | `Notice.tsx` | 됨 | C06 C08 C19 C33 C35 … V06 V08 |
| 얼굴 | `Avatar.tsx` | 됨 | C10 C11 C24~C31 D05~D07 V09 V19 |
| 진행 중 공사 띠 | `ResumeStrip.tsx` | 됨 | C40 C41 · D10 |
| 기록 | `EventLog.tsx` | 됨 | C63 V23 |
| 접는 목록(자주 묻는 질문) | `Accordion.tsx` | 됨(스크립트 없음) | C54 |
| 사진 칸 | `PhotoGrid.tsx` | 됨(`onOpen` · `onRemove`만 브라우저 조각 안) | C11 C13 C37 C38 D04 D07 D14 V12 V13 V16 |
| 공정표 칸 · 업체 일정 반나절 칸 | `ScheduleChart.tsx` | 됨 | C08 C36 D19 · V08 D14 |
| 크게 보기 | `Lightbox.tsx` | 브라우저 | C47(C11 D07 사례 · C48 V24 리뷰 사진) |

'브라우저'는 `"use client"` 조각이에요. 서버 화면에서도 그릴 수 있지만 함수(onChange 등)는 브라우저 조각 안에서 넘겨요.

### 3.1 `Icon`

- `Icon({ name, size = 24, label?, strokeWidth?, filled? })` — 24 격자 · 선 1.8(16 이하 2) · `currentColor` · 기본 `aria-hidden`. `label`을 주면 그림이 이름을 가져요(드물어요, 보통은 단추가 이름).
- 이름(`ICON_NAMES`): 9판 `home doc chat bell user box store camera pin check calendar` · Lucide/Feather `back chevron-left chevron-right chevron-down chevron-up close more plus minus send external search lock upload download image info warn error clock star` · 상태 `dot-todo ring-wait dash-done alert-late`.
- 허가서: `components/ui/ICONS_LICENSE.txt`(ISC + MIT). 새 모양은 Lucide에서 경로만 옮기고 거기에 이름을 더해요. 화면 글에 ‹ › × ⋯ ★ ✓ 같은 글자 기호를 직접 쓰지 않아요.

### 3.2 `Button` · `IconButton`

- `Button({ variant?, size?, block?, gray?, arrow?, icon?, busy?, disabled?, href?, external?, ...button/a props })`
  - `variant`: `primary` 주(파랑) · `weak` 약한(파랑 옅은) · `secondary` 보조(9판 회색) · `danger` 위험 · `text` 글자 단추(파랑 14/600, 누를 곳 44) · `inline` 글 속 얇은 밑줄 · `kakao` 준비 중(늘 꺼짐)
  - `size`: `lg` 52(아래 띠) · `md` 44(기본) · `sm` 40(표 · 카드 안)
  - `href`면 Next `Link`. `arrow`는 다른 화면으로 가는 글자 단추의 ›(U4: '자세히 ›'). 이 화면 안 동작(바꾸기 · 접기 · 요청 취소)은 › 없이, 회색은 `gray`. `external`은 새 창 ↗ + 숨은 '(새 창)'.
  - `disabled`는 `aria-disabled`(초점은 받고 눌러도 무시) · `busy`는 `aria-busy` + 꺼짐 — 글은 부르는 쪽이 '보내는 중'으로 바꿔요.
- `IconButton({ icon, label, href?, size? = 44 })` — 이름이 꼭 있어요: ‹ '뒤로' · × '닫기' · ⋯ '더 보기' · + '더 보내기'(copy-guide A1).
- 웹에서 단추를 최소 160으로 맞추는 것은 `BottomBar`가 해요.

```tsx
<Button size="lg" href={`/projects/${id}/vendors`}>업체 보기</Button>
<Button variant="text" arrow href="/faq">자세히</Button>
<Button variant="danger" onClick={cancel} busy={sending}>{sending ? "보내는 중" : "실측 취소"}</Button>
<p>믿집에서 공사를 끝낸 고객만 써요 · <Button variant="inline" href="#rules">리뷰 기준</Button></p>
```

### 3.3 `BottomBar`

- `BottomBar({ children, note?, summary?: { label, value } })` — 단추 1~2개(`size="lg"`).
- 폰: 아래에 붙는 띠(sticky, 위 1px 줄, 아래 안전 영역). 하나는 가득, 둘은 1:1. 긴 이름은 자르지 않고 두 줄로. `note`는 단추 위 가운데 한 줄, `summary`는 '마루와벽 · 12.15(화) 오전' 같은 고른 것 요약.
- 웹(≥ 768): 본문 끝 오른쪽 정렬, 단추 최소 160. `note` · `summary`는 왼쪽.
- `Main` 바깥 · 바로 뒤에 둬요. 이 띠가 있으면 `TabBar`는 빼요.

### 3.4 `Field` · `TextArea` · `SelectField`

- 공통 props: `label`(꼭) · `error?`(칸 아래 한 줄 + `aria-invalid` · `aria-describedby`) · `hint?`(최소로) · `optional?`('(선택)') · `hideLabel?` + input/textarea/select props.
- `Field`만: `unit?`(칸 오른쪽 안 '㎡' · '원' · '만 원' · '일' · '평') · `num?`(숫자 칸, 웹 최대 240, 기본 `inputMode="decimal"`) · `locked?`(읽기만 + 자물쇠, C50).
- 48px · 글자 16(iOS 확대 막음) · 1px 테두리 gray-500(3.5:1) · 초점 2px 파랑 · 오류 2px 빨강 + 칸 아래 글(아이콘 + 글). 웹 최대 520.
- 검사는 제출 때 한 번, 첫 틀린 칸으로 초점(I6 B) — 부르는 쪽이 해요(`ref`를 받아요).
- `SelectField({ options: { value, label }[] })`.

```tsx
<Field label="공급면적" unit="㎡" num value={m2} onChange={(e) => setM2(e.target.value)} error={err.m2} ref={m2Ref} />
<TextArea label="업체에 남길 말" optional rows={4} />
```

### 3.5 `ChoiceChips`

- `ChoiceChips({ legend, options: { value, label, disabled?, soon?, proposed? }[], value, onChange, multiple?, name?, hideLegend?, error? })` — 하나(라디오) · 여럿(`multiple`, 체크) · 준비 중(`soon`: 꺼짐 + '준비 중' 배지) · 제안(`proposed`, 주황).
- 40px · 14/600. 고르면 파랑 옅은 바탕 + 1.5px 파랑 테두리(색 + 테두리 두께로 알려요). 진짜 input이라 화살표 키 · 폼 보내기가 돼요.
- 벽지: `options={DOBAE_GRADES.map(g => ({ value: g.key, label: g.label }))}` → '합지' · '실크'.

### 3.6 `Steps` · `SubSteps`

- `Steps({ steps? = PROJECT_STEPS, current, label? })` — 폰: 막대 6칸 + '지금 3/6 · 업체 담기' 한 줄(이름 여섯은 읽기용 목록) · 웹(≥ 768): 막대 + 이름 13.
- `SubSteps({ steps? = AFTER_VISIT_STEPS, current })` — 실측 뒤 작은 단계 알약(✓ 끝남 · 지금 파랑).
- 상수: `PROJECT_STEPS`(기본 정보 · 표준견적서 · 업체 담기 · 실측 일정 · 실측 · 실측 뒤) · `AFTER_VISIT_STEPS`(견적서 비교 · 업체 확정 · 공사 날짜 · 공사 · 끝 확인).

### 3.7 `Money` · `BigFigure`

- `Money({ value: number | null, size? = "text" | "line" | "mid" | "big", full?, delta?, paren?, empty? = "가견적 준비 중" })`
  - 기본: 만 단위 '197만 4,069원'(`won`) · `full`: '1,974,069원'(`wonFull`, 견적서 줄 · 합계 칸) · `delta`: '+5만 5,000원' · `paren`: 합계 밖 '(299,635원)' 회색 · `null`이면 `empty` 글.
  - 크기: `big` 28(웹 38)/800 · `mid` 20/800 · `line` 16/700. 고정폭 숫자.
- `BigFigure({ value?, children?, size? = "big", label?, caption?, sub?, past? })` — 큰 숫자 하나 + 아래 줄. 금액이면 `caption` 기본 '부가세 포함'. 날짜 · 기간은 `children`으로(예: `halfDayText(day, "am", true)`). `past`면 회색 + '지났어요' 배지.
- 화면마다 큰 숫자는 하나(둘이면 하나를 `mid`로). 360px 폰에서 28px '1,234만 5,678원'은 209.7px(Pretendard 잼)이라 묶음 288px 안에 들어가요.

```tsx
<BigFigure value={std.total} caption="부가세 포함 · 예상 2일" sub="예산 300만 원 안이에요" />
<Money value={v.estimate_total} size="mid" />            {/* null이면 '가견적 준비 중' */}
```

### 3.8 `QuoteLines`

- `QuoteLines({ lines: QuoteLine[], totals?: { supply?, vat?, total }, vatSplit?, showCode?, caption })`
  - `QuoteLine = { key, name, code?, note?, qty?, unit?, unitPrice?, amount, state? }` — `state`는 표준견적서 줄 상태 6종(`included bundled separate optional after_visit excluded`).
  - 담긴 칸 < 560px: 줄 목록(이름 16/600 + 아래 '풀 포함 · 130.1㎡ × 5,993원', 오른쪽 금액 16/700). ≥ 560px: 표(줄 · 수량 · 단가 · 금액(원), 숫자 오른쪽). 컨테이너 쿼리라 옆 칸 · 카드 안에서도 알아서 바뀌어요.
  - 선택 · 실측 후는 괄호 금액 + '합계 밖', 묶음 포함 · 안 함은 '—'. 합계 위 2px 진한 줄.
  - `vatSplit`: 공급가 · 부가세를 나눠 보여요 — **표준견적서 합계 칸에만**(copy-guide F1-2). 나머지는 '합계 · 부가세 포함'.
  - `showCode`: 1201 같은 단가 양식 번호 — **업체 화면(D02 · V02)에만**. 고객 화면은 빼요(CF-42).
- 조각은 더하지 않아요. `totals`도 API 값을 넘겨요.

### 3.9 `CalcBox` — 믿집 계산 상자

- `CalcBox({ lines: CalcLine[], tone? = "ai" | "form", title? = "믿집 계산" })`
  - `CalcLine = { terms: (CalcTerm | "×" | "+" | "−" | "÷")[], result: CalcTerm, note? }` · `CalcTerm = { n: number | string, unit?: "원" | "㎡" | "평" | "일" | "품" | "명" | "%" | "", paren?, label? }`
  - '173.5㎡ × 1,727원 = (299,635원)'처럼 식과 답을 한 줄로 이어요(W15). `n`은 엔진 값(소수 문자열 그대로 가능). 상자는 계산하지 않아요.
  - `ai`: AI 답 안(흰 바탕 + 테두리) · `form`: 양식 안(옅은 회색, 예: 평으로 넣기 C03).

```tsx
<CalcBox lines={[{ terms: [{ n: line.qty, unit: "㎡" }, "×", { n: line.unit_price, unit: "원" }], result: { n: line.amount, unit: "원", paren: true }, note: "합계 밖" }]} />
```

### 3.10 `VendorCard` · `ShortlistTray`

- `VendorCard({ name, href, amount, compare?, badge?, rating?: { avg, count }, jobs?, extra?, state, onToggle?, busy? })`
  - `state`: `add` 담기 · `added` 담음(눌림 ✓) · `full` 담을 수 없어요 · `preparing` 가견적 준비 중(D06) · `excluded` '이 벽지는 안 해요'(D07)
  - 이름 · 금액 쪽은 자세히로 가는 링크, '담기'는 따로 단추(40px, `aria-pressed`, 업체 이름을 설명으로 이어 읽음 — CF-76).
  - `compare`는 '표준견적서보다 41% 많아요'처럼 엔진 값으로 만든 글. 별점은 '★ 4.7 (3)' + 읽는 글 '별점 4.7, 리뷰 3개'.
- `ShortlistTray({ count, max? = 3, action, note? })` — '담은 업체 2곳 · 1곳 더 담을 수 있어요' + 다음 단추. 폰에서는 화면 아래에 두려면 `BottomBar` 안에 넣거나 B2가 붙여요(9판 C10 k-tray).

### 3.11 `CompareTable` — 비교표(W4 A)

- `CompareTable({ caption, columns: CompareCol[], rows: CompareRow[], empty?: { title, action? }, max? = 3 })`
  - `CompareCol = { key, name, highlight?(할 일 있는 열: 옅은 파랑), dim?(유효기간 지남: 회색), aside?(열 머리 아래 작은 글 · 배지) }`
  - `CompareRow = { key, label, hint?, big?(큰 숫자 줄), action?(단추 줄, 라벨 없음), cells: Record<colKey, ReactNode> }`
  - 담긴 칸 ≥ 600px: 표(첫 열 170 라벨, 업체가 열) · 좁으면: 업체마다 카드를 세로로, 줄 순서 같게(할 일 있는 카드는 2px 파랑 테두리). 빈 열은 '1곳 더 담을 수 있어요' + 다음 길.
- 실측 일정(D03: 상태 · 날짜 · 다음 할 일 · 기한 · 단추) · 실측 견적서(D18: 합계 · 업체가 적은 금액 · 가견적과 차이 · 공사 기간 · 포함됐나요 · 유효기간 · 실측 · 파일 · 확정).

### 3.12 `StateTag` · `StateLegend`(N4 C)

- `StateTag({ tone: "todo" | "wait" | "ok" | "done" | "late", children })` — 작은 아이콘(● ○ ✓ – !)만 색, 글자 14/700 진한 회색. 색만으로 알리지 않아요.
- `StateLegend({ tones? })` — 작업함 아래 범례 한 줄.
- 말 · tone은 `lib/labels.ts` `visitState(status, "customer" | "vendor")`에서: `const v = visitState(row.status, "vendor"); <StateTag tone={v.tone}>{v.label}</StateTag>`.

### 3.13 `Badge` · `Count` · `DueBadge`

- `Badge({ tone? = "mute", children })` — 24px · 13/700. `now` 지금(파랑) · `wait` 기다림(주황) · `ok` 확정(초록) · `bad` 지남 · 거절(빨강) · `mute` 준비 중 · 닫힘 · 잡아 둠(회색).
- `Count({ n, max? = 99 })` — 안 읽은 수 20px(보이는 수는 읽지 않아요. 무엇의 수인지는 부르는 쪽 이름에: '채팅, 안 읽은 대화 1개').
- `DueBadge({ due, now, relative?, who?, overText? = "지났어요" })` — '11.25(수) 09:05까지' → 서울 날짜로 오늘 · 내일이면 주황 → 지나면 빨강 '지났어요'. `due` · `now`는 서버 · 엔진 시각(ISO). `relative`면 '내일 21:40까지'(업체 폰 작업함 · 일정 탭). `who`: '· 고객이 골라요'.

### 3.14 `Dialog` · `ConfirmDialog`(W2 A)

- `Dialog({ open, onClose, title, children?, actions?, dismissible? = true, wide? })` — `<dialog>` + `showModal()`: 뒤를 막고 초점을 가둬요. 처음부터 열린 창(`open` 기본값이 true)도 개발 모드(React 두 번 실행)에서 그대로 열려 있어요(`useModal`). Esc · 바깥 누르기 · 웹 ×로 닫고, 닫으면 누른 단추로 초점을 돌려줘요. 폰 · 웹 모두 가운데 카드(웹 460, `wide` 560). 열리면 뒤 페이지 스크롤이 멈춰요.
- `ConfirmDialog({ open, onClose, title, children?, confirmLabel, onConfirm, danger?, busy? })` — [닫기 | 동작] 52px. 제목은 질문 한 문장('마루와벽으로 확정할까요?'), 본문은 무엇이 바뀌는지 · 되돌릴 수 있는지(W11). `busy` 동안은 닫히지 않고 '보내는 중'.
- 쓰는 화면: C34 업체 확정 · C61 이 날짜로 확정 · A04 거절 · C41 이어 하기 · C59/D13 가입 카드(가입 · 로그인만, W9) · 웹으로 옮긴 양식.

### 3.15 `Sheet` · `OptionRow`

- `Sheet({ open, onClose, title, children?, actions?, hideClose?, dismissible? })` — 폰: 아래 시트(위 모서리 24 · 손잡이 · 보이는 [닫기] · 최대 85dvh 안 스크롤 · 아래 안전 영역). 열 때 기록 한 칸을 넣어 **뒤로 가기로 닫혀요**. 웹(≥ 768): 가운데 창 460 + ×([닫기] 단추는 빠져요).
- `OptionRow({ children, onClick?, href?, danger?, selected?, disabled? })` — 48px 줄. `selected`를 주면 고르기 줄(둥근 체크, 이유 고르기 C30 C31 C52 V05).
- 시트 위에 시트를 겹치지 않아요. 시트 안에서 다른 화면으로 가는 줄은 `Menu`를 쓰세요(기록 칸을 먼저 걷고 옮겨요).

```tsx
<Sheet open={open} onClose={() => setOpen(false)} title="실측을 왜 취소하나요?"
  actions={<Button size="lg" block variant="danger" disabled={!why} onClick={send}>실측 취소</Button>}>
  <div role="radiogroup" aria-label="취소 이유">{REASONS.map((r) => <OptionRow key={r.key} selected={why === r.key} onClick={() => setWhy(r.key)}>{r.label}</OptionRow>)}</div>
</Sheet>
```

### 3.16 `Menu` — 작은 메뉴 ↔ 시트

- `Menu({ label, icon?, text?, title?, items: MenuItem[], align? = "end" })` · `MenuItem = { label, href?, onSelect?, danger?, disabled?, hint? }`
- 웹(≥ 768): 누른 단추 옆 240px · 줄 44 · 열면 첫 줄로 초점 · Esc · 바깥 누르기로 닫고 단추로 초점. 폰: 같은 줄을 시트(48px 줄 + [닫기])로.
- 아이콘 단추면 `label`이 이름(⋯ '더 보기' · + '더 보내기'). 글자 단추면 `text` + ▾.

```tsx
<Menu label="더 보기" icon="more" title="마루와벽" items={[
  { label: "실측 일정 보기", href: `/projects/${id}/visits` },
  { label: "실측 취소", danger: true, onSelect: () => setCancel(true) },
  { label: "신고 · 차단", danger: true, onSelect: () => setReport(true) },
]} />
```

### 3.17 `NotifyRow` · `NotifyList`

- `NotifyRow({ href, title, sub?, time?, unread?, onOpen? })` — '[누가] [일어난 일]해요' + '공사 이름 · 11.21 10:12'(`listStamp`). 안 읽음은 빨간 점 + 숨은 글 '새 알림'. `href`는 사이트 안 경로만(`safeLink`).
- `NotifyList({ fresh, past })` — '새 알림' · '지난 알림' 묶음(C44 · V21).

### 3.18 `EmptyState`

- `EmptyState({ icon?, title, children?, action?, as? = "h2" })` — 아이콘 칸 72 · 제목 20/700 · 설명 · 다음 할 일 하나(W10). 막다른 화면을 만들지 않아요.

```tsx
<EmptyState icon="chat" title={<>실측 날짜가 정해지면<br />업체와 채팅할 수 있어요</>} action={<Button variant="text" arrow href={`/projects/${id}/visits`}>실측 일정 보기</Button>}>마루와벽 날짜를 고르면 바로 열려요</EmptyState>
```

### 3.19 `FileDrop`(I9 A)

- `FileDrop({ kind? = "photo" | "doc", label, onFiles, accept?, multiple? = true, types?, busy?, error?, disabled? })`
- 손가락 기기(`pointer: coarse`): '눌러서 앨범 · 카메라에서 골라요'(서류는 '눌러서 파일 · 앨범 · 카메라에서 골라요'). 마우스: '사진을 끌어다 놓거나 눌러서 골라요' + [파일 고르기]. 끌어 오는 동안 파랑 테두리 · '여기에 놓으면 올라가요 · 사진 2장'.
- **칸 아래 안내 줄은 두지 않아요**(I9). 받는 형식은 `types`로 칸 안 작은 글. 오류(형식 · 크기)는 칸 아래 한 줄(`error`).
- 올리기(`POST /files`) · 사진 칸 · 파일 줄은 부르는 쪽이 그려요(사진 위치 정보 지움은 서버).

### 3.20 `Calendar` · `CalendarLegend` · `HalfDayPicker`

- `Calendar(props)` — DayPicker(`@daypicker/react`, 지금 의존성) 위에 9판 모양. 화살표 키 · 달 넘기기 · 초점은 DayPicker가 맡아요.
  - `mode`: `"single"`(value `string | null`) · `"multiple"`(날 하나씩, `string[]`, 공사 날짜 C35 V11) · `"range"`(`{ from, to? } | null`, 업체 기간 V04 D14)
  - 공통: `label` · `today`(서버 값, 시계 안 읽음) · `month?` · `marks?: Record<"YYYY-MM-DD", ("available" | "unavailable" | "proposed" | "booked" | "holiday")[]>` · `wish?: { from, to }`(희망 띠) · `vendor?: { from, to }`(업체 띠) · `notes?: Record<날짜, { text: 두 글자, label?: 읽을 말 }>` · `only?: string[]`(이 날만 고름) · `min?`(기본 오늘) · `max?` · `wide?`(웹 ≥ 1024 칸 64 · 동그라미 42)
  - 날 상태: 업체 가능(파랑 테두리) · 안 됨(옅게 + 가로줄, 꺼짐) · 고른 날(파랑) · 제안(주황 테두리 → 고르면 주황) · 잡힘(회색) · 일요일 · 공휴일(빨강 글자) · 오늘(밑줄).
  - 날마다 읽는 이름: '12월 15일 화요일, 업체 가능, 오전만 돼요'(날짜 + 상태 + `notes.label`).
  - 폰 칸 40(칸 아래 글이 있으면 52) · 동그라미 32 · 칸 아래 글은 두 글자까지(오전 · 오후 · 마감 · 신정 · 희망).
- `CalendarLegend({ items, wishText? })` — `wish vendor available selected unavailable proposed booked holiday` 중에서. 예: `wishText={`내 희망 ${rangeText(w.from, w.to)}`}`.
- `HalfDayPicker({ legend, value: "am" | "pm" | null, onChange, slots: { am?: "open" | "proposed" | "closed", pm?: … } })` — 50px 칸 둘. 마감은 '오후 · 마감'(꺼짐). 시각은 확정 뒤 채팅으로 정해요.

```tsx
<CalendarLegend items={["wish", "available", "selected", "unavailable"]} wishText={`내 희망 ${rangeText(v.wish_from, v.wish_to)}`} />
<Calendar mode="single" label="마루와벽 날짜 고르기" today={today} month={v.window_from} value={day} onChange={setDay}
  wish={{ from: v.wish_from, to: v.wish_to }} marks={marks} notes={notes} only={pickable} />
{day ? <HalfDayPicker legend={dateLong(day)} value={half} onChange={setHalf} slots={slotsOf(day)} /> : null}
```

### 3.21 `Stars` · `StarInput`

- `Stars({ value, count?, size? = "md" | "sm" })` — '★ 4.8 (5)' 숫자가 주인공, 읽는 글 '별점 4.8, 리뷰 5개'(CF-71).
- `StarInput({ value, onChange, label? })` — 별 5개 단추 44×44(`radiogroup`, 화살표 키), 고른 별 #c48200, 읽는 이름 '5점 만점에 4점'.

### 3.22 `Toast` · `useToast`

- `const toast = useToast(); toast.show("저장했어요"); toast.show("방금 다른 고객이 골랐어요. 다른 날을 골라 주세요.", { tone: "error" })` — `ToastProvider`는 `app/layout.tsx`에 있어요.
- 어두운 바탕 흰 글자 14 · 4초 · `role="status"`(늘 있는 읽기 칸). 폰에서 탭 바 · 아래 단추 띠가 있으면 그 위에 떠요.
- 놓치면 안 되는 말은 토스트로만 두지 않고 그 칸 아래에도 남겨요.

### 3.23 `Tabs` · `TabPanel` — 탭 · 거르기 알약(design-system 3.1 Tabs · FilterPills)

- `Tabs({ label, items: TabOption[], value, onChange?, id?, variant? = "line" | "pill" | "type", fill? })` · `TabOption = { key, label, href?, count?, tone?, disabled? }`
  - `line` 밑줄 탭 44 · 16/600, 지금은 2px 진한 줄 + 굵게(가견적 · 사례 · 리뷰 / 요약 · 기록 / 기본 · 사례 · 링크). `fill`이면 폰에서 칸을 같은 너비로.
  - `pill` 거르기 알약 40 · 14/600, 지금은 진한 바탕 흰 글자. `tone`(N4 C 아이콘) · `count`(할 일 3)를 붙여요(작업함 · 관리자 상태).
  - `type` 종류 알약, 지금은 파랑 옅은 바탕 + 1.5px 파랑 테두리(관리자 종류: 전체 · 채팅 · 업체 · 링크).
- **주소 탭**(칸마다 `href`, `onChange` 없음): `<nav aria-label>` 안 링크 · 지금 칸 `aria-current="page"` · 스크롤 그대로. 서버 화면이 `?tab=`을 읽어요 → 작업함 `/vendor?tab=todo|waiting|sched|jobs|done` · `/projects/{id}?tab=log` · `/vendor/profile?tab=` · `/admin/reports?status=&kind=`.
- **이 화면 안 탭**(`onChange` + `id`): `role="tablist"` · ←/→ · Home · End로 옮기며 바로 바꿔요. 내용은 `<TabPanel tabsId={id} tabKey="…" active={…}>`.
- 넘치면 줄을 바꾸지 않고 옆으로 넘겨요(폰). 지금 칸이 처음부터 보이게 옆으로만 맞춰요.

```tsx
<Tabs variant="pill" label="작업함 탭" value={tab} items={[
  { key: "todo", label: "할 일", count: sum.todo, tone: "todo", href: "/vendor?tab=todo" },
  { key: "waiting", label: "기다림", count: sum.waiting, tone: "wait", href: "/vendor?tab=waiting" },
  { key: "sched", label: "일정", tone: "ok", href: "/vendor?tab=sched" }, /* 공사 · 끝남 */ ]} />
<Tabs id="vd" label="업체 상세" value={view} onChange={setView} fill items={[{ key: "estimate", label: "가견적" }, { key: "cases", label: "사례", count: 6 }, { key: "reviews", label: "리뷰", count: 5 }]} />
<TabPanel tabsId="vd" tabKey="estimate" active={view === "estimate"}>…</TabPanel>
```

### 3.24 `DataTable` · `CellText` · `ScrollBox` — 표 + 옆 자세히 칸(design-system 3.3)

- `DataTable({ caption, columns: DataColumn[], rows, rowKey, selected?, rowHref?, onSelect?, rowTone?, card?, detail?, detailLabel?, detailOnPhone? = true, empty?, head?, foot?, minWidth? = 560, showCaption? })`
  - `DataColumn = { key, label, cell?(row), num?, align?, width?, primary?, hideOnCard? }` — `primary` 칸이 줄 머리(`th scope=row`)가 되고 고르기 링크 · 단추가 들어가 **줄 전체를 덮어요**(어디를 눌러도 그 줄). 다른 칸의 단추 · 입력은 그 위로 올라와 따로 눌려요.
  - 폰(< 768): 카드 목록(`card(row)`로 V03 카드를 그려요, 없으면 줄 이름 + 칸 이름 · 값 줄). 768부터 표(머리 13/600 · 칸 14 · 줄 52 이상 · 숫자 오른쪽 고정폭). 1024부터 `[표 | 옆 자세히 칸 360]`, 칸은 위 띠 아래에 붙고 길면 칸 안에서 스크롤. 좁으면 자세히 칸은 목록 아래(`detailOnPhone={false}`면 폰에서 숨김).
  - 고른 줄: 옅은 파랑 + 왼쪽 3px 파랑(`aria-current="true"`). `rowTone`: `warn` 주황 옅게 · `bad` 빨강 옅게(뜻은 칸 글로도).
  - 고르기: 서버 화면은 `rowHref`(예: `?tab=todo&sel=<id>`, 스크롤 그대로) · 브라우저 조각 안에서는 `onSelect`.
  - 표가 칸보다 넓으면 `ScrollBox`가 초점 받는 옆으로 넘김 상자가 되고 '옆으로 넘겨 볼 수 있어요'를 보여요. 표는 너비를 정한 열의 합 + 정하지 않은 열마다 180px보다 좁아지지 않아요.
- `CellText({ main, sub? })` — 두 줄 칸('상계동 69.4㎡' / '노원구 · 아파트 · …').
- 이 파일은 `"use client"`가 아니에요: 서버 화면에서 `cell` · `card` 함수를 그대로 넘겨요.

```tsx
<DataTable caption="작업함" rows={rows} rowKey={(r) => r.visit_id} selected={sel}
  rowHref={(r) => `/vendor?tab=${tab}&sel=${r.visit_id}`}
  columns={[
    { key: "at", label: "받은 때", num: true, width: "104px", cell: (r) => listStamp(r.received_at) },
    { key: "home", label: "집", primary: true, cell: (r) => <CellText main={r.area_label} sub={r.home} /> },
    { key: "st", label: "상태", width: "164px", cell: (r) => <StateTag tone={r.state.icon}>{r.state.label}</StateTag> },
    { key: "next", label: "다음 일", width: "150px", cell: (r) => r.next.label },
    { key: "due", label: "기한", num: true, width: "128px", cell: (r) => (r.next.due_at ? dueText(r.next.due_at) : "—") },
  ]}
  head={<Tabs variant="pill" label="작업함 탭" value={tab} items={TABS} />} foot={<StateLegend />} detailOnPhone={false}
  card={(r) => <InboxCard row={r} />} detail={sel ? <InboxDetail id={sel} /> : <p>줄을 고르면 자세히 보여요</p>} />
```

### 3.25 `Segmented` — 나눔 칸

- `Segmented({ legend, options: { value, label, sub?, disabled? }[], value?, defaultValue?, onChange?, name?, hideLegend?, disabled?, full? })` — 2~3칸, 칸 40 · 14/600. 고른 칸은 흰 바탕 + 1.5px 파랑 테두리 + 굵게. 웹 최대 360(`full`이면 칸 너비 다, 표 안 D02).
- 진짜 radio라 ←/→ · 폼 보내기가 돼요. `sub`는 칸 안 둘째 줄(C11 '합지 / −31만 1,850원' — 금액은 엔진 값).

### 3.26 `Switch` — 켜기/끄기

- `Switch({ label, desc?, checked?, defaultChecked?, onChange?(on), disabled?, name?, value?, hideLabel? })` — 52×32 · 끔 gray-500 · 켬 파랑 · 줄 전체가 누를 곳(48). 진짜 checkbox + `role="switch"`.
- 누르면 바로 바뀌는 설정에만(바로 확정 받기 · 주말 실측). [저장]을 눌러야 바뀌는 것은 `Check`.

### 3.27 `Check` · `CheckGroup` — 체크

- `Check({ label, hint?, type? = "checkbox" | "radio", round?, row?, danger?, name?, value?, checked?, defaultChecked?, onChange?(on), disabled?, required? })` — 24px · 2px 테두리(3.5:1) · 고르면 파랑 + 흰 ✓. 네모 = 여럿(관리자 확인 칸 A01 · 동의 C05), 둥근 = 하나(`type="radio"`, 처리 고르기 A02). `row`면 줄 48 + 옅은 줄(9판 k-opt). `ref`를 받아요(첫 틀린 칸으로 초점).
- `CheckGroup({ legend, hideLegend?, children })` — fieldset + legend.
- 시트 · 창 안에서 눌러 바로 고르는 이유 줄은 `OptionRow`(3.15).

### 3.28 `SummaryRows` · `KeyValue` — 요약 칸

- `SummaryRows({ items: { label, sub?, value, strong?, mute?, num? }[], size? = "md" | "sm" })` — 왼쪽 이름(+ 작은 글) · 오른쪽 값(16/700). `sm`은 옆 칸 · 자세히 칸(값 14). `strong`은 합계 줄(위 2px 진한 줄). 화면 읽기는 `dl`.
- `KeyValue({ items: { label, value, num? }[], cols? = 2 | 3 | 4 })` — 칸 위 작은 이름 + 아래 값 격자. 폰 2열 · 웹 `cols`열(D14 D19).

### 3.29 `FileRow` — 파일 줄

- `FileRow({ name, size?: 바이트 | 글, note?, href?, openLabel? = "열기", action?, busy?, error? })` — 종류 칸 40(PDF 빨강 · XLS 초록 · JPG · PNG · HEIC 파랑) · 이름 14/600 말줄임(전체 이름은 `title`) · '1.2MB · 위치 정보 지움'. `href`면 '열기 ↗'(새 창 · 숨은 '(새 창)'), `action`에 '빼기' 단추. `busy`면 '올리는 중', `error`면 빨간 테두리 + 줄 아래 글.

### 3.30 `Notice` — 안내 상자

- `Notice({ tone? = "info" | "gray" | "white" | "warn", title?, children?, icon? })` — 14/1.5 · 모서리 16. **적게 써요**(사용자 결정). 오류는 칸 아래 글 · 토스트로.

### 3.31 `Avatar` — 얼굴

- `Avatar({ name, size? = "s" 32 | "m" 44 | "l" 56, warm?, label? })` — 이름 첫 글자. 옆에 이름이 보이면 읽지 않아요(기본 `aria-hidden`). 업체 상세 큰 얼굴은 `warm`.

### 3.32 `ResumeStrip` — 진행 중 공사 띠(S5 A)

- `ResumeStrip({ href, title, sub?, badge? })` — 어두운 띠 · 흰 글 16/700 · 파란 배지 · ›. 띠 전체가 링크(56 이상). 폰 홈 맨 위(C40 C41) · 웹 머리 아래(D10).

### 3.33 `EventLog` — 기록

- `EventLog({ items: { key, at: ISO, who, what }[], label? = "기록" })` — 시각 13/700('11.21 10:12', `listStamp`) · 누가 13/700 · 무엇 14. 서버가 준 순서 그대로(C63 · V23). 업체가 쓴 글은 글자로만.

### 3.34 `Accordion` — 접는 목록

- `Accordion({ items: { key, q, a, open? }[], name? })` — `<details>` · 질문 줄 48 · 답은 옅은 회색 칸. 스크립트 없이 열고 닫혀요. `name`을 주면 같은 묶음에서 하나만 펼쳐져요. `key`가 `id`가 돼서 `#q-grade`로 바로 갈 수 있어요.

### 3.35 `PhotoGrid` — 사진 칸

- `PhotoGrid({ photos: { key, src, alt, label?, href? }[], label, onOpen?, onRemove?, add? })` — 폰 3열 · 웹 칸 너비로 112px 이상씩. 사진 위 글은 흰 바탕 라벨로만. 누르면 크게 보기(C47): `onOpen(i)`(같은 화면에서 `Lightbox` 열기, 단추 이름 '거실 벽 사진, 크게 보기') 또는 `href`(주소 `?photo=n`). `onRemove`면 오른쪽 위 × '거실 빼기'(44). `add` 칸에 '더 넣기'.
- 주소는 같은 사이트(`/api/files/…`)만. 위치 정보는 서버가 지워요.

### 3.36 `ScheduleChart` — 공정표 칸 · 업체 일정 반나절 칸

- `ScheduleChart({ caption, days: ChartDay[], rows: ChartRow[], half?, today?, labelHead? = "공정", showAfter?, legend?, note?, showCaption? })`
  - `ChartDay = { day: 'YYYY-MM-DD', off?, holiday? }` — 열이 될 날. API가 준 날을 **보일 만큼만** 넘겨요(쉬는 날 포함, 조각은 날을 만들지 않아요).
  - `ChartRow = { key, name, sub?, cells: ChartCell[] }` — 줄(공정 · 업체 팀). `ChartCell = { day, half?: "am" | "pm", kind?, label?, note?, href? }`
  - `kind`: `work` 공사(파랑 옅게) · `dry` 자연 건조(빗금 · 회색 테두리) · `clean` 입주 청소(흰 바탕 테두리) · `booked` 확정(초록) · `hold` 잡아 둠(주황 점선) · `pending` 바꾸는 중(파랑 점선). 색과 테두리 모양으로 같이 알리고 `legend`로 범례를 그려요.
  - 붙어 있는 같은 칸(같은 kind · label · href)은 한 막대(colSpan)로 이어 그려요. 막대 글은 `label ?? name` + `note`('도배 · 2일'). 쉬는 날을 건너뛰는 공사는 막대가 둘로 나뉘어요(엔진이 그 날을 비워 줘요).
- 웹(≥ 768): 표 — 첫 열 150(줄 이름 + 작은 글) · 날 열(`half`면 오전 · 오후 두 칸) · 쉬는 날 열 회색 · 공휴일 이름 빨강 · 오늘은 '오늘'. 넓으면 `ScrollBox`(옆으로 넘김 상자). 날마다 읽는 이름 '1월 4일 월요일, 쉬는 날, 신정'.
- 폰(< 768): 날마다 세로 목록(C36) — 칸이 있는 날은 '오전 도배' · '오후 공릉동 76.0㎡ · 확정' 줄, 쉬는 날은 흐린 '쉬는 날' 한 줄. `href` 칸은 40px 링크.
- **건조 · 청소 칸은 D22 B대로 기본 숨김**이에요(엔진 `fix_plan`은 도배 뒤 자연 건조 2일 · 입주 청소 1일을 늘 붙여요, 팀 확인 중). 팀이 정하면 `showAfter`.
- 누르는 막대(`href`)는 보이는 막대 32px를 44px 링크가 감싸요(반나절 칸 48 · 링크 너비 43 이상).
- 폰 날짜 묶음(V08): `heads="near"` + `restHead="이번 주"` → '오늘 · 12월 15일(화)' · '내일 · 12월 16일(수)' 묶음, 그 뒤 날은 '이번 주' 한 묶음(줄에 '12.17(목) 오전 · 창동 84.0㎡'). `heads="day"`는 날마다 묶음(모레까지 말이 붙어요). 줄 = '오전 · 상계동 69.4㎡' + 둘째 줄(`note`, 줄이 여럿이면 '1팀 · …') + 오른쪽 상태 칩(확정 ✓ · 잡아 둠 ○). 쉬는 날은 빼요. `today`(서버 값)가 있어야 '오늘' · '내일'이 붙어요.
- 쓰는 화면: C08 예상(날 칸) · C36 · D19 확정(`half`, 오른쪽에 공사 전 할 일은 화면이 그려요) · V08 · D14 업체 일정(`half` · `labelHead="팀"` · 칸 `kind: booked | hold` · 폰 `heads="near" restHead="이번 주"`).

```tsx
// B2a /plan — GET /projects/{id}/plan 의 days(PlanDayOut) · blocks(PlanBlockOut)를 그대로. 건조 · 청소를 숨기면 days도 마지막 공사 날까지만
const last = plan.days.findLastIndex((d) => d.kind === "work");
const days = plan.days.slice(0, last + 1).map((d) => ({ day: d.day, off: d.kind === "off", holiday: d.holiday }));
const rows = plan.blocks.filter((b) => b.kind === "work").map((b) => ({
  key: b.trade ?? b.label, name: tradeLabel(b.trade ?? ""), sub: [b.vendor_name, b.crew ? `${b.crew}명` : null].filter(Boolean).join(" · "),
  cells: plan.days.filter((d) => d.trade === b.trade && d.kind === "work").map((d) => ({ day: d.day, note: `${b.days}일` })) }));
<ScheduleChart caption="확정 공정표" half={final} days={days} rows={rows} today={today} legend={["work", "off"]}
  note="반나절로 계산해 하루 단위로 잡았어요. 공휴일은 건너뛰어요." />
// B3 V08 · D14 — GET /vendor/schedule 의 items(VendorSlotOut)
const rows = seats.map((n) => ({ key: `s${n}`, name: `${n}팀`, cells: items.filter((x) => x.seat === n)
  .map((x) => ({ day: x.day, half: x.half, kind: x.kind, label: x.area_label, href: `/vendor/requests/${x.visit_id}` })) }));
<ScheduleChart caption={`${dateLong(from)} 주 일정`} half labelHead="팀" days={weekDays} rows={rows} today={today} legend={["booked", "hold", "off"]}
  heads="near" restHead="이번 주" />  {/* 칸 note에 '실측 · 빈 집' · '오늘 18:00까지 수락해요' */}
```

### 3.37 `Lightbox` — 크게 보기(C47 photo_view)

- `Lightbox({ open, onClose, photos: { key, src, alt, title?, sub? }[], start? = 0, label? = "사진", onIndex?, pushHistory? = true })`
- 폰(< 768): 화면 전체 어두운 바탕 · 위 × '닫기' + '시공 사례 2 / 6' · 손가락으로 옆으로 넘김(스크롤 맞춤) · 아래 설명(제목 16/700 · 작은 글) · 점 · ‹ › 단추(넘김만으로 옮기지 않게, WCAG 2.5.1). 열 때 기록 한 칸 → 뒤로 가기로 닫혀요.
- 웹(≥ 768): 가운데 760 · 사진 양옆 ‹ ›(44) · 키보드 ← → · Home · End · Esc · 바깥 누르기로 닫혀요. 닫으면 누른 사진으로 초점이 돌아와요.
- 바뀌면 '시공 사례 3 / 6, 안방 천장 · 실크벽지'를 읽어 줘요. 지금 사진 말고는 읽지 않아요(`aria-hidden`). 가까운 사진만 먼저 받아요.
- 주소로 열고 닫을 때(`?photo=n`, routes.md C47)는 `pushHistory={false}` + `onIndex`로 주소를 바꿔요(기록이 두 번 생기지 않게).
- 쓰는 화면: C47(C11 · D07 시공 사례), 리뷰 사진(C48 · V24), 집 사진(D04 · C13).

```tsx
const [at, setAt] = useState<number | null>(null);
<PhotoGrid label="시공 사례 사진" photos={cases.map((c) => ({ key: c.id, src: c.src, alt: c.alt, label: c.room }))} onOpen={setAt} />
<Lightbox open={at !== null} start={at ?? 0} onClose={() => setAt(null)} label="시공 사례"
  photos={cases.map((c) => ({ key: c.id, src: c.src, alt: c.alt, title: `${c.room} · ${c.paper}`, sub: `${areaText(c.m2, "supply")} · ${c.when} · ${c.vendor}` }))} />
```

## 4. `lib/format.ts` · `lib/labels.ts`(B4가 맡아요)

| 함수 · 값 | 결과 | 근거 |
| --- | --- | --- |
| `won(n)` · `wonFull(n)` · `wonDelta(n)` | '197만 4,069원' · '1,974,069원' · '+5만 5,000원'(그대로) | copy-guide F1 |
| `dateShort(iso, today?)` | '12.15(화)', 올해가 아니면 '2027.1.4(월)'. 0을 안 붙여요 | copy-01 · F2 |
| `dateLong(iso, today?)` | '12월 15일(화)'(화면 주인공 날짜 · 채팅 날 줄) | F2 |
| `dateSpoken(iso)` | '12월 15일 화요일'(짧은 꼴의 읽는 이름, `<time aria-label>`) | A10 |
| `timeSeoul(t)` · `listStamp(t)` | '09:05' · '11.21 10:12'(알림 · 기록) | F3 |
| `dueText(t, { now?, relative?, today? })` · `dueState(t, now)` | '11.25(수) 09:05까지' · '내일 21:40까지' / `over · near · normal` | F4 |
| `rangeText(from, to, { weekday?, long? })` | '12.7~12.21' · '12.7(월)~12.21(월)' · '12월 13일~18일' | F5 |
| `halfDayText(iso, "am" | "pm", long?)` · `HALF_LABEL` | '12.15(화) 오전' | F3 |
| `areaText(m2, basis?)` | '공급 69.4㎡' | F7 |
| `fileSize(bytes)`(있던 것) | '1.2MB' · '82KB'(파일 줄) | FileRow |
| `DOBAE_GRADES` · `gradeLabel` | '합지' · '실크' · 없으면 '벽지 미정'(코드 값 economy · basic 그대로) | U9 · D07 · CF-81 |
| `sizeLabel` | ㎡가 있으면 '공급 69.4㎡'(옛 평형대만 있으면 '30평대') | CF-82 |
| `BUDGETS` 'undecided' · 이유 '그 밖' | '아직 몰라요' · '그 밖' | CF-85 |
| `visitState(status, side)` · `VISIT_STATE_CUSTOMER` · `VISIT_STATE_VENDOR` | 실측 상태 13개 → 화면 말 + 상태 칩 tone | copy-guide 1.9 · data-model |

- 옛 `md` · `ymd` · `dotDate` · `stampSeoul`은 지금 화면이 써서 그대로 뒀어요(`dotDate(...).slice(0, 7)`처럼 꼴에 기대는 곳이 있어요). 새 화면은 위 새 함수를 써요.
- 화면 묶음이 필요한 말 · 꼴은 B4에 요청해 주세요(하루 한 번 모아 반영, plan-build 2장).

## 5. 아직 없는 것(다음 차례 · 요청하면 먼저)

- '앱처럼 쓰기' 설치 안내 단추(설치 이벤트 · iOS 안내 글) — 화면 자리(B2 `/account`)가 정해지면.
- 채팅 조각은 B2 `components/thread`, AI 칸 내용은 B5.
- 옆 AI 칸 접은 모양(N5 결정 뒤).
