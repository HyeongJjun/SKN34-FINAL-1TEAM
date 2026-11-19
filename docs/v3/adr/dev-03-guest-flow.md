# dev-03 비회원 흐름: 답은 이 기기에만, 계산은 저장 없는 API, 가입하면 한 번에 옮김

- 상태: 고름
- 날짜: 2026-11-18 · 쓴 역할: 개발자
- 관련 화면 · 이야기: C01 · C02 · C03 · C57 · C58 · C59 · D10~D13, C41, J1, N1 A, 팀 확인 16 · 관련 코드: 새 `backend/app/guest/`, `backend/app/project/`, `frontend/components/start/draft.ts`, 새 `frontend/lib/guest/`

## 배경

9판 N1 A는 가입 전에 기본 정보 → 표준견적서를 모두 보여 주고 '업체 보기' · '예상 공정표'에서 가입하게 해요. 넣은 답은 이 기기에 저장되고 가입하면 이어져요. 팀 확인 16은 '어디에 둘지'와 '로그인 없는 계산 요청의 한도'를 정하라고 해요. 지금 견적 API는 모두 로그인이 필요해요.

## 대안

| 안 | 내용 | 좋은 점 | 걸리는 점 |
| --- | --- | --- | --- |
| A | 답은 localStorage(JSON), 계산은 `POST /guest/standard`(저장 안 함), 가입 뒤 `POST /projects`에 같은 답 + `Idempotency-Key` | 서버에 개인정보 없음 · 표 · 정리 일 없음 · 지금 `draft.ts`와 같은 방식 | 기기를 바꾸면 이어지지 않아요. Safari가 7일 안 쓰면 지울 수 있어요 |
| B | 서버에 손님 표(guest_drafts) + 서명 쿠키 | 기기 사이 이어짐(쿠키가 같으면) | 익명 행 정리 · 남용 방지 · 쿠키 동의 문구가 늘어요 |
| C | 기본 정보 전에 가입 먼저 | 가장 단순 | N1 A(사용자 결정)와 달라요 |
| D | IndexedDB | 사진 Blob도 넣어요 | 9판은 사진을 요청서(C13 · D08)에서 받아서 지금은 필요 없어요 |

## 고른 것과 이유

- 고른 안: **A**.
- 이유
  - 답은 작은 JSON(1KB 안쪽)이라 localStorage 5MiB로 넉넉해요(S26). 사진은 9판에서 가입 뒤 요청서에서 받아서 Blob 저장이 필요 없어요(D는 다시 볼 조건으로).
  - 서버에 아무것도 남기지 않아 손님 데이터 정리 · 동의 문제가 없어요. 금액은 서버 계산 엔진이 다시 계산해서 화면이 보낸 숫자를 믿지 않아요.
  - 로그인 없는 API는 손님마다 요청 수 · 본문 크기 상한을 둬요(S27): IP 해시마다 분당 20회 · 하루 300회, 본문 4KB, 칸마다 범위 검사. Redis가 안 되면 지금 `ratelimit.hit`처럼 통과시켜요(계산만이라 위험이 작아요).
  - 가입 뒤 옮기기는 `Idempotency-Key`(기기 답에 저장한 UUID)로 한 번만 만들어요. 같은 키가 처리 중이면 409, 이미 만들었으면 만든 것을 돌려줘요(S25). C41 '같은 집 공사가 둘 생기지 않아요'와 맞아요.
  - Safari는 7일 안 누르면 스크립트 저장을 지울 수 있어서(S26) 화면에 '답은 이 기기에 저장돼요'를 그대로 두고, 지워졌으면 처음부터 넣게 해요.

## 정한 세부

- 키: `mj_guest_v3` = `{v: 3, key: <uuid>, saved_at, info: {trade, scope, spaces, faces, housing, sido, sgg, emd, area_m2, area_basis, occupied, grade, budget_won, start_date}}`. 지금 `mj_start_draft_v4`는 읽어서 바꿔 넣고 지워요.
- `POST /guest/standard`: 로그인 필요 없음, 응답에 표준견적서 줄 · 합계 · 예상 일수 · 예산 안/밖. DB · 로그에 입력을 쓰지 않아요.
- 가입 · 로그인 성공 → `POST /projects`(헤더 `Idempotency-Key`) → 201이면 기기 답을 지우고 `/projects/{id}/vendors`로 가요. 이미 진행 중 공사가 있으면 C41 창을 먼저 보여요.
- AI 칸은 로그인 뒤에만 써요(C58 · D12). 로그인 전에는 자주 묻는 질문 칩(정적 글)만 보여요.

## 근거 (직접 열어 확인한 것만)

1. S26 MDN 저장 한도 · 지움 — https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria (확인 2026-11-18)
2. S27 OWASP API4:2023 — https://api-security.owasp.org/editions/2023/en/0xa4-unrestricted-resource-consumption (확인 2026-11-18)
3. S25 IETF Idempotency-Key draft-08 — https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header (확인 2026-11-18)

## 검증

- 방법: pytest — 로그인 없이 계산 200 · 저장 행 0, 분당 21번째 429, 4KB 넘으면 413, 같은 키 두 번 `POST /projects` → 행 1개. e2e J1: 홈 → 기본 정보 → 표준견적서 → 업체 보기 → 가입 → 업체 보기에 같은 조건.
- 결과: 검증 대기(B1a · B8).

## 다시 볼 조건

- 기본 정보에 사진을 넣기로 바꿀 때 → D(IndexedDB)로 사진만.
- '폰에서 넣고 PC에서 이어서'를 가입 전에도 원할 때 → B.
- 계산 API 남용이 보이면(로그) → 한도를 낮추고 Cloudflare 규칙을 더해요(B7).
