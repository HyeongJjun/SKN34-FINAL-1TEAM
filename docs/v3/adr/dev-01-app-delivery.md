# dev-01 앱 방식: 같은 Next.js를 PWA로 설치 (웹 푸시 없음)

- 상태: 고름
- 날짜: 2026-11-18 · 쓴 역할: 개발자
- 관련 화면 · 이야기: 폰 화면 전체(c · v), D15 C(화면 알림만), 완료 기준 '폰 · 웹 모두' · 관련 코드: `frontend/app/layout.tsx`, 새 `frontend/app/manifest.ts`, 새 `frontend/public/sw.js`

## 배경

지시문은 웹(데스크톱)과 앱(폰)을 같은 코드로 만들라고 해요. 지금은 manifest · 서비스 워커가 없어요. 폰 사람이 '앱'처럼 홈 화면에서 여는 길을 정해야 B4(껍데기)가 시작할 수 있어요. 9판 D15 C는 웹 푸시 · 알림톡 없이 화면 알림만 쓰기로 했어요.

## 대안

| 안 | 내용 | 좋은 점 | 걸리는 점 |
| --- | --- | --- | --- |
| A | PWA: `app/manifest.ts` + 아이콘 + 작은 `sw.js`(오프라인 안내 한 장) | 코드 한 벌 · 바로 배포 · 스토어 심사 없음 · 새 의존성 없음 | 스토어에 없음. iOS는 공유 → 홈 화면 추가를 사람이 해요 |
| B | A + Serwist로 화면 캐시 | 오프라인에서도 옛 화면 | 금액 · 기한이 오래된 채로 보일 위험. Turbopack용 route handler · esbuild 설정이 더 생겨요 |
| C | Capacitor로 감싸 스토어 배포 | 스토어에 보여요 | Next SSR은 앱 안에서 안 돌아요(정적 내보내기 필요). `server.url`은 운영용이 아니에요. 웹사이트 포장은 4.2 심사 위험. 연 99달러 + 빌드 · 서명 유지 |
| D | Expo/React Native 앱 따로 | 네이티브 화면 | 화면 109개를 두 벌 만들어요. 팀 일정 밖 |
| E | 안드로이드만 TWA로 Play 등록 | PWA 그대로 Play에 올림(25달러 한 번) | iOS는 그대로. Digital Asset Links 관리 |

## 고른 것과 이유

- 고른 안: **A**. 스토어가 꼭 필요해지면 **E → C** 순서로 더해요.
- 이유
  - Next.js 공식 안내가 manifest(`app/manifest.ts`)와 홈 화면 설치를 바로 다뤄요(S1). Chrome 설치 조건에 서비스 워커는 없어서(S5) 작은 `sw.js`는 오프라인 안내용으로만 둬요.
  - 웹 푸시는 iOS에서 홈 화면 설치 뒤에만 되고(S1 · S3) 9판 D15 C가 화면 알림만 쓰기로 했어요. 그래서 푸시 구독 · VAPID 키를 지금 만들지 않아요.
  - 우리 화면은 금액 · 기한이 늘 바뀌어서 화면 캐시(B)는 틀린 숫자를 보일 위험이 커요. 계산 엔진 값만 보여야 하는 규칙과 부딪혀요.
  - Capacitor는 정적 파일을 앱에 넣는 구조이고 `server.url`은 운영용이 아니에요(S7). 웹을 감싼 앱은 4.2 '포장만 바꾼 웹사이트' 문구에 걸릴 수 있어요(S6). 비용도 연 99달러(S9)예요.
  - Expo는 React Native 코드를 따로 써야 해요(S11). 화면 109개를 두 벌 만들 시간이 없어요.
  - iOS 26부터 홈 화면에 추가하면 기본으로 웹 앱으로 열려요(S4, 사례). 설치 안내는 iOS · 안드로이드 문구를 따로 둬요.

## 근거 (직접 열어 확인한 것만)

1. S1 Next.js PWA 안내 — https://nextjs.org/docs/app/guides/progressive-web-apps (확인 2026-11-18) — manifest · 웹 푸시(iOS 16.4+ 홈 화면) · `sw.js` 머리
2. S3 WebKit 웹 푸시 — https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/ (확인 2026-11-18) — 홈 화면 추가 + 사용자 동작 뒤 권한
3. S4 firt.dev iOS PWA 메모 — https://firt.dev/notes/pwa-ios/ (확인 2026-11-18) — iOS 26 기본 웹 앱 열기(사례)
4. S5 web.dev 설치 조건 — https://web.dev/articles/install-criteria (확인 2026-11-18) — 서비스 워커는 조건에 없음
5. S6 App Review Guidelines 4.2 — https://developer.apple.com/app-store/review/guidelines/ (확인 2026-11-18)
6. S7 Capacitor 설정 — https://capacitorjs.com/docs/config (확인 2026-11-18) — `server.url`은 운영용 아님
7. S8 TWA — https://developer.chrome.com/docs/android/trusted-web-activity (확인 2026-11-18)
8. S9 · S10 스토어 비용 — https://developer.apple.com/programs/ · https://support.google.com/googleplay/android-developer/answer/6112435 (확인 2026-11-18)
9. S11 Expo — https://docs.expo.dev/ (확인 2026-11-18)

## 만들 것 (B4)

- `app/manifest.ts`: `name: '믿집'`, `short_name: '믿집'`, `start_url: '/'`, `display: 'standalone'`, `lang: 'ko'`, 192 · 512 아이콘(+ maskable), `theme_color`는 토큰 값.
- `public/sw.js`: install 때 `/offline` 한 장만 넣고, 화면 이동이 네트워크 실패일 때만 그 장을 보여요. API · 화면은 캐시하지 않아요. `/sw.js`에 `Cache-Control: no-cache` · CSP 머리(B7, S1).
- 설치 안내: 내 정보 아래 '앱처럼 쓰기' 한 줄. 안드로이드는 `beforeinstallprompt`가 있을 때만 단추, iOS는 '공유 → 홈 화면에 추가' 글.

## 검증

- 방법: `pnpm build` 뒤 Chrome DevTools Application 탭에서 manifest 오류 0 · 설치 가능 표시, 폰(안드로이드 Chrome · iOS Safari)에서 홈 화면 추가 → 전체 화면으로 열림, 비행기 모드에서 이동하면 오프라인 안내가 보이는지.
- 결과: 검증 대기(B4가 만든 뒤 리드가 확인).

## 다시 볼 조건

- 고객 · 업체가 스토어 앱을 요구하거나 마케팅이 스토어 검색을 필요로 할 때 → E(TWA) 먼저.
- 9판 D15(알림)를 바꿔 웹 푸시를 켤 때 → 구독 표 · VAPID 키 · 홈 화면 설치 안내를 더해요.
- 업체가 현장에서 오프라인으로 써야 할 때 → B(Serwist)를 그 화면에만.
