# v2 프로젝트 구조

AGENTS.md 2장의 층 규칙을 따른다. `chat · knowledge · agent · mcp_server.py`는 보류라 빈 뼈대 그대로 둔다.

## backend/app

| 패키지 | 층 | 하는 일 |
| --- | --- | --- |
| `calc/` | 도구 | 순수 계산. `common` · `dobae` · `mokgong`(수량 · 단가 · 품 0.5 올림 · 반올림 · 부가세 · 면세), `standard_quote`(집 면적 · 합계), `schedule`(반나절 계산 → 하루 단위 날짜, 휴일 · 겹침 · 건조 · 청소, 기한, 연락처 기한, 단계 판정), `estimate`(업체 단가 × 표준 수량), `quote_diff`(표준 대비 %) |
| `refprice/` | 기반 | `book` · `house`(2026H2 단가 · 출처 · 버전), `holidays`(공휴일). 코드 상수 |
| `notify/` | 기반 | 화면 알림 쓰기(같은 트랜잭션, `dedup_key`) · 목록 · 읽음 |
| `files/` | 기반 | 올리기 · 사진 처리 · 저장. kind에 `price_doc` · `quote_doc` · `work_photo` |
| `auth/` · `account/` | 기반 · 대상 | 가입(휴대폰 칸) · 로그인 · 세션 · 탈퇴 |
| `project/` | 대상 | 집 정보 만들기 · 보기 · 고치기, 요청 번호, `lock_for_visit()` |
| `vendor/` | 대상 | 업체 가입 · 심사(보완 · 이력) · 업체 정보 · 연락 방식 · 자주 묻는 5가지 · 링크 · 사진 · 가견적 단가 묶음 |
| `quote/` | 흐름 | 표준견적서 버전(`ensure_standard`), 업체 실측 견적서(임시 저장 · 보내기 · 다시 올리기) |
| `visit/` | 흐름 | 이 집 업체 목록 · 업체 자세히(가견적), 실측 요청 · 동의 · 취소 · 못 받아요, 연락처 공개 계산, 견적 파일 내주기 |
| `schedule/` | 흐름 | 예상 · 확정 공정표, 업체 확정 · 다시 고르기, 공사 날짜 올림 → 수락 · 다른 날짜 요청 · 바꾸기, 추가 금액, 공사 끝냈어요, 내 공사 지금 할 일 |

부르는 방향: `schedule → visit → quote → (vendor | project) → (files | refprice | notify) → auth`, 모두 `calc`를 쓸 수 있다. 다른 기능은 그 기능 service의 공개 함수로만 부른다.

## frontend

```
app/                      시안 판마다 라우트 하나(features.md '화면 경로')
components/
  site/                   역할별 머리 · 알림 종 · 바닥글 · 상태 화면
  start/                  견적 받기(목차 + 긴 폼) · DateCalendar · 사진
  project/                내 공사 지금 할 일 · 표준견적서 · 공정표 · 공사 날짜 · 서류
  vendors/                업체 고르기 · 업체 자세히 · 실측 요청 · 견적서 비교 · 확정
  pro/                    업체 화면: 작업함 · 업체 정보 · 실측 견적서 올리기 · 공사 일정
  my/ · auth/ · admin/     내 정보 · 가입 · 로그인 · 관리자 심사
  ui/                     ActButton · Money · Dialog 같은 공용 조각
lib/api/                  project · vendor · quote · visit · schedule · admin · notify
lib/mock/                 API가 생긴 화면부터 지운다
```
