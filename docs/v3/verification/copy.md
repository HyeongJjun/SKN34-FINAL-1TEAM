# 글 점검(copy) 검증 기록

실제로 돌린 것만 적어요. 2026-11-18은 9판 설계 원본(`docs/v3/design/`)만 봤고, 2026-11-19에 만든 화면(B2a · B2b · B3 · B4)을 예시 모드로 띄워 봤어요.

- 스크립트 위치(작업 임시 폴더): `C:\Users\lsm15\AppData\Local\Temp\claude\9fde9263e2ae7b10\4f9af5b4-65b7-4ec0-9f70-41add44e991c\scratchpad\copy3\` — 11-18: `a11y_scan.py` · `links_scan.py` · `term_scan.py` / 11-19: `ssr_dump.py` · `ssr_check.py` · `ssr_diff.py` · `cf_status.py` · `add_col.py` · `urls_all.txt`. 임시 폴더라 지워질 수 있어요. 저장소로 옮길지는 리드가 정해요.

## 2026-11-18 9판 설계 원본

| 날짜 | 무엇 | 명령 · 방법 | 결과 | 남은 일 |
| --- | --- | --- | --- | --- |
| 2026-11-18 | 기호만 있는 누를 곳의 읽는 이름 | `python a11y_scan.py docs/v3/design/screens` | '‹' 68곳(이름 없음 0) · '⋯' 7곳(이름 없음 7) · '+' 7곳(0) · '×' 4곳(이름 없음 1, C09) | CF-68 · CF-69 반영 뒤 0곳인지 다시 봐요 → 11-19에 봄 |
| 2026-11-18 | 링크 역할(클래스별 글) | `python links_scan.py docs/v3/design/screens` | 글자 단추(k-tb) 64개 중 다른 화면으로 가는데 '›'가 없는 것 22개 · 얇은 밑줄(k-lk) 6개 · '›' 줄(k-row) 32개 | CF-67 |
| 2026-11-18 | 용어 갈래 쓰임(화면 수) | `python term_scan.py docs/v3/design/screens.json` | '동까지만' 8 · '동네' 1 · '동 · 호 · 연락처' 9 · '주소 · 연락처' 1 · '주소 · 번호' 1 · '표준보다' 4 · '표준견적서보다' 0 · '다음 일' 2 · '다음 할 일' 1 · '수락' 15 · '받기'(단추) 3 · '재요청' 2 · '한 번 더 요청' 4 · '공종' 4 · '공정'(같은 뜻) 3 · '견적서 받기' 20 · '버전' 4 · '1판' 2 · '.ics' 3 · '예상 N일' 8 · '반나절로 계산' 3 | CF-01~CF-14 · CF-16 · CF-34~CF-38 |
| 2026-11-18 | 말끝(해요체) | screens.json `text` 문장 끝을 정규식으로 셈 | '-습니다 · -다' 0곳 · '-세요' 39줄(채팅 본문 포함) 모두 부탁 · 권유 · 주의 줄 | 고칠 것 없음(W1) |
| 2026-11-18 | 기한 · 범위 꼴 | screens.json 글에서 날짜 정규식으로 셈 | 기한: 긴 꼴 11화면 · 짧은 꼴 8 · 요일 없음 9 / 물결표: 띄움 7 · 붙임 19 | CF-60 · CF-61 · ADR copy-01 |
| 2026-11-18 | 화면 글 속 영어 | screens.json 글에서 영문자 낱말을 셈(주소 줄 · 그림 설명 제외) | AI 28화면 · PDF · JPG · XLS(파일 형식) · PC 3 · ics 3 · M/D 1 · VAT 0 | CF-14 · CF-41 |
| 2026-11-18 | 고객 화면에서 '고객' 3인칭 | 고객 · 고객 웹 화면 글에서 '고객' 낱말을 셈 | 고쳐야 할 곳 1(D08). 나머지는 '다른 고객' · 리뷰 기준 · 함께 보는 기록 · 약관이라 그대로 | CF-17 |
| 2026-11-18 | 고칠 목록 숫자 대조 | `copy-fixes.md` 표 줄을 셈 | 85줄 · 높음 6 · 중간 34 · 낮음 45 · 번호 겹침 0 · 빠짐 0 · 칸 수 모두 8 | 요약 표와 맞음 |

## 2026-11-19 만든 화면

- 띄운 방법: `cd frontend && NEXT_DIST_DIR=.next-dev-ux API_INTERNAL_URL=http://127.0.0.1:8030 MJ_V3A_MOCK=1 NEXT_PUBLIC_MOCK_V3B=1 NEXT_PUBLIC_MJ_V3_MOCK=1 pnpm exec next dev --port 3109`(백그라운드). 앱 안 브라우저는 새 탭 하나만 썼어요. 끝난 뒤 dev 서버(next dev · start-server 두 프로세스)를 끄고 3109 포트가 닫힌 것을 봤고, 탭을 닫았어요.
- 예시 모드: 고객 공사 `MJ_V3A_MOCK`(공사 4개 · 업체 3곳) · 실측 뒤 흐름 `NEXT_PUBLIC_MOCK_V3B`(쿠키 `mj_v3b_step` · `mj_v3b_role`) · 업체 · 관리자 `NEXT_PUBLIC_MJ_V3_MOCK`(`?mock=`). 주소 목록은 `urls_all.txt`예요.

| 날짜 | 무엇 | 명령 · 방법 | 결과 | 남은 일 |
| --- | --- | --- | --- | --- |
| 2026-11-19 | 화면 글 뽑기(서버가 그린 HTML) | `python -I ssr_dump.py http://localhost:3109 urls_all.txt ssr/dump_final.json` | 주소 91개(고객 56 · 업체 30 · 관리자 5) · 200 89 · 404 1(C56 없는 화면, 원래 404) · 500 1(`/projects/{id}/docs`, API 꺼짐 · 예시 없음) · 글 5,559줄 | 공사 서류 화면은 API를 켜고 다시 봐요 |
| 2026-11-19 | 금지 말 · 영어 · 말끝 · 날짜 꼴 · 이름 없는 단추 · 대체 글 | `python -I ssr_check.py design/screens.json ssr/dump_final.json` | 남은 위반 0. 걸린 39줄은 모두 규칙에 맞는 글이에요: 채팅 · AI 칸 '보내기' 25 · 읽는 글 '포함: 철거' · '제안: 12.16(수) 오후' 8(CF-77대로) · 두 자리 달 '2026.10.20' 4 · C32 단추 '실측 받았어요' 1 · C54 결제 답 1(NF-05로 고친 뒤 다시 봄) | — |
| 2026-11-19 | 9판 글과 대조 | `python -I ssr_diff.py design/screens.json ssr/dump_final.json` + 사람이 읽음 | 75화면 · 9판 줄 2,077 중 같은 글이 없는 줄 679. 읽어 보니 CF를 반영해 바뀐 글 · 예시 데이터 차이(날짜 · 동네 · 금액) · 웹 · 폰 글이 한 HTML에 함께 · AI 칸 자리(B5)가 대부분이고, 고칠 글은 NF-04 · CF-31이었어요 | — |
| 2026-11-19 | CF 85줄 반영 확인 | `python -I cf_status.py frontend ssr/dump_final.json`(옛 글 · 고친 글을 화면 글과 소스에서 찾음) + 걸린 곳마다 소스를 읽음 | 반영함 78 · 일부 반영 3(CF-62 · CF-67 · CF-79) · 화면에 그 글 없음 4(CF-17 · CF-22 · CF-57 AI 칸 · CF-84 코드 이름) | copy-fixes.md '반영' 칸 |
| 2026-11-19 | 열어야 보이는 상태(시트 · 창 · 웹 표) | 앱 안 브라우저에서 단추를 눌러 열고 보이는 글을 뽑음 | 11상태: C02 지역 고르기 창 · 면적 · 예산 칸, V05 못 받아요 창, A04 거절 창, D03 · D18 웹 표, D02 단가 아래 줄, D04 웹 작업함, D14 웹 기간 답하기, C12 담기 띠, C48 링크 신고 창 | — |
| 2026-11-19 | 읽는 이름이 겹치는 단추 · 링크 | 화면마다 보이는 단추 · 링크의 읽는 이름을 모아 같은 이름 · 다른 곳을 셈(1280 · 375) | 17개 주소 20번. 겹침 3곳: C48 '링크 신고' ×2 · V18 '넣기' ×2 → 고침(NF-01 · NF-02) / V03 폰 카드 제목 ×3 → 남김(NF-09) | — |
| 2026-11-19 | 고친 뒤 다시 보기 | 같은 탭 · 같은 뽑기 | C12 '3곳까지 담을 수 있어요'만 · D18 표 칸 '277만 4,200원보다 …' · C33 카드는 '가견적 …' 그대로 · D14 '잡힘' 곧은 따옴표 · C48 신고 창 이유 · '네이버 플레이스 링크 신고' · V18 '외부 리뷰 링크 넣기' · C54 답 한 문장 | — |
| 2026-11-19 | lint | `pnpm lint`(oxlint app components lib) · 고친 파일 9개만 `pnpm exec oxlint <파일>` | 둘 다 exit 0 | — |
| 2026-11-19 | typecheck | `pnpm typecheck` | exit 2 · 오류 9건, 모두 예시 데이터 파일(`lib/mock/v3a/project.ts` 1 · `v3a/vendors.ts` 3 · `v3b/story.ts` 2 · `v3c/admin.ts` 1 · `v3c/vendor.ts` 2). 01:28에 바뀐 `lib/backend/schema.d.ts`의 새 칸(`paper_ok` · `done_photos` · `link_label` 등)이 예시에 없어서예요. 고친 파일의 오류는 0 | 리드: 예시 데이터를 새 API 타입에 맞추기 |

### 고친 곳 (10곳 · 파일 9개, 글 · 읽는 이름만)

| 종류 | 곳 | 파일 |
| --- | --- | --- |
| 용어 통일 | 2 | `components/report/ReportSheet.tsx`(wrong_place) · `components/admin/text.ts`(not_vendor) — NF-03 |
| 길이(같은 말 두 번) | 4 | `components/vendors/VendorList.tsx` 폰 · 웹 담기 띠 2(CF-31) · `components/compare/v3.ts` + `QuoteBoard.tsx` 웹 표 1(NF-04) · `components/home/faq.ts` 1(NF-05) |
| 표기 | 1 | `components/pro/visit/PeriodForm.tsx` 따옴표(NF-06) |
| 접근성(읽는 이름 · 기호 숨김) | 3 | `components/vendors/ReviewLinks.tsx` 링크 신고 이름 · '↗' 숨김 2(NF-01) · `components/pro/profile/LinksForm.tsx` 넣기 이름 1(NF-02) |

- 영어 상태값이 화면에 보이는 곳: 0곳(위 자동 점검의 영어 낱말 결과).
- 배치 · 동작 · 금액 · 상태값 계산은 손대지 않았어요. `components/ai/**` · 백엔드는 열어 보기만 했어요.

### 남은 것

- 리드 확인: NF-07(D04 위치 안내 두 번 · 보이는 곳 바꾸기) · NF-08(업체 화면 '공급' · 백엔드 `area_label` 글).
- 남김: NF-09(V03 폰 카드 제목 같은 이름) · NF-10(D09 '모두 보기 ›') · NF-11(칸 오류 바로 읽기 · B4 공용 부품) · NF-12(예시 알림 긴 날짜 꼴).
- B5 몫: AI 칸 글(CF-17 · CF-22 · CF-57 · C09 창).
- 못 본 것: `/projects/{id}/docs`(500, API 꺼짐). D04 옆 자세히의 '못 받아요'(`?decline=1`)로 들어갔을 때 창이 저절로 열리는지는 확인하지 못했어요(뒤 탭이라 그랬을 수 있어요 · 글이 아니라 동작). B2b 흐름 화면 위 공사 띠는 B2a 예시 공사 단계('지금 3/6')로 고정이라, 단계별 띠 글은 실제 API로 다시 봐야 해요.
- 하지 않은 것: 낭독기(VoiceOver · TalkBack)로 듣기 · 사용자 시험. 웹 근거 중 NN/g 빈 화면 · Cancel vs Close · 확인 창 글은 열리지 않아 쓰지 않았어요(copy-guide 5장).
