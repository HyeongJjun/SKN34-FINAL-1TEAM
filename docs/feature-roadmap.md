# 기능 개발표 — 믿집

[문서 목차](README.md) · [API 안내](api/README.md) · [API 목록](api/endpoints.md) · [v2 구조](v2/structure.md) · [v2 ERD](v2/erd.md) · [개발 흐름](development-flow.md) · [개발 안내](development.md) · [검증 안내](testing.md) · [에이전트 협약](agent-contract.md) · [기준 데이터](reference-data.md) · [이번 근거 점검](verification/2026-11-18-documentation.md)

> 기준: 2026-11-18, `dev` 커밋 `1a3e65661924e93225914ebb4b440bbd8330cc2a` (PR #141 병합). 현재 코드와 라우터 등록·화면 호출을 먼저 확인하고 이슈·PR 병합 기록과 CI를 대조했다. 아래는 서비스 기능별 실제 동작을 한 행에 기록한다.

**개발 상태**: `구현`=현재 코드의 동작 경로가 존재함, `부분`=API 또는 화면·임시 저장·시연 기능만 존재하거나 사용자 흐름 일부만 연결됨, `진행`=열린 이슈/PR의 제안으로 기준 커밋에 미반영, `미구현`=구체 처리 코드가 없음, `미확인`=운영 환경 등 코드 밖의 실태를 확인하지 못함. 구현은 실서비스 배포 완료를 뜻하지 않는다.

**검증 상태**: `CI`=관련 테스트 또는 CI 검사 경로가 있고 기준 `dev`의 [CI 성공](https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/actions/runs/44270185547)을 확인함, `로컬`=기준 HEAD에서 별도로 실행한 해당 검사 통과(해당 검사는 CI에서 실행하지 않음), `코드`=코드·호출을 읽었으나 해당 동작의 자동 또는 수동 통과 근거는 확보하지 못함, `미검증`=동작 확인 자료 없음. `CI`여도 실제 LLM·AWS 운영·브라우저 E2E 검증은 별도다. 실행 범위는 [검증기록](verification/2026-11-18-documentation.md)을 참조한다.

**근거 읽기**: 이슈는 담당자와 개발 제안을 나타내고 PR은 코드 반영 이력을 나타낸다. 이슈 종료와 개발 완료는 별개이며 병합과 배포도 별개다. `없음`은 확인된 직접 이슈·PR이 없다는 뜻이다. 이슈/PR 번호는 현재 저장소의 기록만 사용했다.

## 회원·계정

| ID | 기능 | 세부 동작 | 개발 | 검증 | 코드 근거 | 테스트 근거 | 이슈·PR 및 이슈 담당 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AUT-01 | 이메일 회원 | 고객 계정 만들기·세션 쿠키 발급 (v2에서 휴대폰 입력 추가) | 구현 | CI | [auth/router.py](../backend/app/auth/router.py) · [auth/service.py](../backend/app/auth/service.py) · [page/signup/page.tsx](../frontend/app/signup/page.tsx) | [tests/test_auth.py](../backend/tests/test_auth.py) | [PR #3][p3] (가입·세션 최초) · [PR #39][p39] (휴대폰 필수·화면 변경) |
| AUT-02 | 로그인 | 이메일·비밀번호 로그인과 세션 발급 | 구현 | CI | [auth/router.py](../backend/app/auth/router.py) · [page/login/page.tsx](../frontend/app/login/page.tsx) | [tests/test_auth.py](../backend/tests/test_auth.py) | [PR #3][p3] (인증 최초) · [PR #39][p39] (로그인 화면 개편) |
| AUT-03 | 세션 | 로그아웃 시 세션 폐기와 쿠키 삭제 | 구현 | CI | [auth/router.py](../backend/app/auth/router.py) | [tests/test_auth.py](../backend/tests/test_auth.py) | [PR #3][p3] |
| AUT-04 | 내 정보 | 본인 정보·권한·업체 승인 상태 조회 (v2에서 연락처·심사 세부 정보 확장) | 구현 | CI | [auth/router.py](../backend/app/auth/router.py) · [auth/service.py](../backend/app/auth/service.py) · [lib/session.ts](../frontend/lib/session.ts) | [tests/test_auth.py](../backend/tests/test_auth.py) | [PR #3][p3] (내 정보 조회) · [PR #39][p39] (연락처·업체 심사정보 확장) |
| AUT-05 | 내 정보 | 이름 수정 및 v2에서 연락처 부분 수정 지원 | 구현 | CI | [auth/router.py](../backend/app/auth/router.py) · [auth/service.py](../backend/app/auth/service.py) · [page/account/page.tsx](../frontend/app/account/page.tsx) | [tests/test_auth.py](../backend/tests/test_auth.py) | [PR #3][p3] (이름 수정) · [PR #39][p39] (휴대폰·부분 수정) |
| AUT-06 | 연락처 | 로그인 고객의 휴대폰 번호 입력·수정 | 구현 | CI | [page/signup/phone/page.tsx](../frontend/app/signup/phone/page.tsx) · [auth/service.py](../backend/app/auth/service.py) | [tests/test_auth.py](../backend/tests/test_auth.py) | [PR #39][p39] |
| AUT-07 | 회원 탈퇴 | 비밀번호 재확인 후 탈퇴와 세션 삭제 | 구현 | CI | [account/router.py](../backend/app/account/router.py) · [page/account/page.tsx](../frontend/app/account/page.tsx) | [tests/test_account.py](../backend/tests/test_account.py) | [PR #3][p3] (탈퇴 API) · [PR #39][p39] (계정 화면 개편) |
| AUT-08 | 권한 | 고객·업체·관리자 접근 역할 검사 | 구현 | CI | [auth/deps.py](../backend/app/auth/deps.py) · [lib/session.ts](../frontend/lib/session.ts) | [tests/test_guards.py](../backend/tests/test_guards.py) | [PR #3][p3] (권한 검사) · [PR #39][p39] (v2 화면 분기) |
| AUT-09 | 소셜 인증 | 카카오 로그인 실제 인증·계정 연동 | 미구현 | 미검증 | [page/login/page.tsx](../frontend/app/login/page.tsx) | 없음 | 없음 |
| AUT-10 | 계정 복구 | 비밀번호 재설정 메일·토큰 처리 | 미구현 | 미검증 | [page/reset-password/page.tsx](../frontend/app/reset-password/page.tsx) | 없음 | 없음 |
| AUT-11 | 전화 인증 | 문자 전송·번호 인증 | 미구현 | 미검증 | [page/signup/phone/page.tsx](../frontend/app/signup/phone/page.tsx) | 없음 | 없음 |

## 프로젝트·집 정보

| ID | 기능 | 세부 동작 | 개발 | 검증 | 코드 근거 | 테스트 근거 | 이슈·PR 및 이슈 담당 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| PRJ-01 | 지역 선택 | 시도·시군구 코드 목록 제공 | 구현 | 코드 | [project/router.py](../backend/app/project/router.py) · [page/start/page.tsx](../frontend/app/start/page.tsx) | 없음 | [PR #39][p39] |
| PRJ-02 | 프로젝트 생성 | 고객 집 정보·공종·면적 저장 | 구현 | CI | [project/router.py](../backend/app/project/router.py) · [page/start/page.tsx](../frontend/app/start/page.tsx) | [tests/test_project.py](../backend/tests/test_project.py) | [PR #39][p39] |
| PRJ-03 | 프로젝트 보기 | 소유자·관리자 권한으로 집 정보 조회 | 구현 | CI | [project/router.py](../backend/app/project/router.py) | [tests/test_project.py](../backend/tests/test_project.py) | [PR #39][p39] |
| PRJ-04 | 프로젝트 편집 | 실측 요청 전까지 집 정보 수정 | 구현 | CI | [project/router.py](../backend/app/project/router.py) | [tests/test_project_edit.py](../backend/tests/test_project_edit.py) | [PR #39][p39] |
| PRJ-05 | 준비 체크 | 사전 신고 등 준비 항목 확인 상태 저장 | 구현 | CI | [project/router.py](../backend/app/project/router.py) | [tests/test_project.py](../backend/tests/test_project.py) | [PR #39][p39] |
| PRJ-06 | 내 공사 | 프로젝트 목록·단계별 할 일 조회 | 구현 | CI | [schedule/router.py](../backend/app/schedule/router.py) · [page/my/page.tsx](../frontend/app/my/page.tsx) | [tests/test_overview.py](../backend/tests/test_overview.py) | [PR #39][p39] |
| PRJ-07 | 집 상세 | 현재 단계·공정·납부 예정 정보 표시 | 구현 | CI | [schedule/router.py](../backend/app/schedule/router.py) · [page/projects/[id]/page.tsx](../frontend/app/projects/[id]/page.tsx) | [tests/test_overview.py](../backend/tests/test_overview.py) | [PR #39][p39] |

## 업체 가입·프로필·관리자 심사

| ID | 기능 | 세부 동작 | 개발 | 검증 | 코드 근거 | 테스트 근거 | 이슈·PR 및 이슈 담당 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| VEN-01 | 업체 가입 | 사업자등록증 첨부·가입 신청 | 구현 | CI | [vendor/router.py](../backend/app/vendor/router.py) · [page/signup/vendor/page.tsx](../frontend/app/signup/vendor/page.tsx) | [tests/test_vendor.py](../backend/tests/test_vendor.py) | [PR #39][p39] |
| VEN-02 | 업체 심사 | 관리자의 신청 목록·상태별 건수·검색 | 구현 | CI | [vendor/router.py](../backend/app/vendor/router.py) · [page/admin/vendors/page.tsx](../frontend/app/admin/vendors/page.tsx) | [tests/test_vendor_review.py](../backend/tests/test_vendor_review.py) | [PR #39][p39] |
| VEN-03 | 업체 심사 | 신청 상세·이전 결정 기록 조회 | 구현 | CI | [vendor/router.py](../backend/app/vendor/router.py) · [page/admin/vendors/[id]/page.tsx](../frontend/app/admin/vendors/[id]/page.tsx) | [tests/test_vendor_review.py](../backend/tests/test_vendor_review.py) | [PR #39][p39] |
| VEN-04 | 업체 심사 | 관리자 승인·보완 요청·거절 및 중복 결정 방지 | 구현 | CI | [vendor/service.py](../backend/app/vendor/service.py) · [vendor/router.py](../backend/app/vendor/router.py) | [tests/test_vendor_review.py](../backend/tests/test_vendor_review.py) | [PR #39][p39] |
| VEN-05 | 업체 심사 | 보완 요청을 받은 업체의 다시 제출 | 구현 | CI | [vendor/router.py](../backend/app/vendor/router.py) | [tests/test_vendor_review.py](../backend/tests/test_vendor_review.py) | [PR #39][p39] |
| VEN-06 | 업체 심사 | 거절된 업체의 재신청 | 구현 | CI | [vendor/router.py](../backend/app/vendor/router.py) | [tests/test_vendor_review.py](../backend/tests/test_vendor_review.py) | [PR #39][p39] |
| VEN-07 | 업체 심사 | 업체가 자신의 심사 상태·처리 결과 조회 | 구현 | CI | [vendor/router.py](../backend/app/vendor/router.py) · [page/vendor/page.tsx](../frontend/app/vendor/page.tsx) | [tests/test_vendor_review.py](../backend/tests/test_vendor_review.py) | [PR #39][p39] |
| VEN-08 | 업체 정보 | 승인된 업체의 프로필 조회·수정·버전 충돌 검사 | 구현 | CI | [vendor/router.py](../backend/app/vendor/router.py) · [page/vendor/profile/page.tsx](../frontend/app/vendor/profile/page.tsx) | [tests/test_vendor_profile.py](../backend/tests/test_vendor_profile.py) | [PR #39][p39] |
| VEN-09 | 업체 정보 | 연락 방법·비용·FAQ 5항목 관리 | 구현 | CI | [vendor/service.py](../backend/app/vendor/service.py) · [page/vendor/profile/page.tsx](../frontend/app/vendor/profile/page.tsx) | [tests/test_vendor_profile.py](../backend/tests/test_vendor_profile.py) | [PR #39][p39] |
| VEN-10 | 시공 사례 | 업체 포트폴리오 사진 연결·제외 | 구현 | CI | [vendor/router.py](../backend/app/vendor/router.py) · [files/router.py](../backend/app/files/router.py) | [tests/test_vendor_profile.py](../backend/tests/test_vendor_profile.py) | [PR #39][p39] |
| VEN-11 | 가견적 단가 | 업체가 초안 단가·근거 파일 관리 | 구현 | CI | [vendor/router.py](../backend/app/vendor/router.py) · [page/vendor/profile/page.tsx](../frontend/app/vendor/profile/page.tsx) | [tests/test_vendor_price.py](../backend/tests/test_vendor_price.py) | [PR #39][p39] |
| VEN-12 | 가견적 단가 | 확인한 단가 묶음만 고객 계산에 사용·이전 묶음 보존 | 구현 | CI | [vendor/service.py](../backend/app/vendor/service.py) | [tests/test_vendor_price.py](../backend/tests/test_vendor_price.py) | [PR #39][p39] |
| VEN-13 | 단가 자료 | 가견적 근거 문서 추가·제외 | 구현 | CI | [vendor/router.py](../backend/app/vendor/router.py) | [tests/test_vendor_price.py](../backend/tests/test_vendor_price.py) | [PR #39][p39] |
| ADM-01 | 관리자 회원 | 회원 목록 화면을 실제 사용자 DB 조회로 연결 | 부분 | 코드 | [lib/api/admin.ts](../frontend/lib/api/admin.ts) · [page/admin/members/page.tsx](../frontend/app/admin/members/page.tsx) | 없음 | 없음 |
| ADM-02 | 관리자 회원 | 회원 관리 변경·권한 조정 API | 미구현 | 미검증 | [page/admin/members/page.tsx](../frontend/app/admin/members/page.tsx) | 없음 | 없음 |

## 업체 선택·가견적·실측 요청

| ID | 기능 | 세부 동작 | 개발 | 검증 | 코드 근거 | 테스트 근거 | 이슈·PR 및 이슈 담당 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| VIS-01 | 업체 선택 | 해당 집 공종에 맞는 업체 목록과 가견적 정렬 | 구현 | CI | [visit/router.py](../backend/app/visit/router.py) · [page/projects/[id]/vendors/page.tsx](../frontend/app/projects/[id]/vendors/page.tsx) | [tests/test_visit_vendors.py](../backend/tests/test_visit_vendors.py) | [PR #39][p39] · [PR #55][p55] |
| VIS-02 | 업체 선택 | 업체 상세·가견적·연락 방식 확인 | 구현 | CI | [visit/router.py](../backend/app/visit/router.py) · [page/projects/[id]/vendors/[vid]/page.tsx](../frontend/app/projects/[id]/vendors/[vid]/page.tsx) | [tests/test_visit_vendors.py](../backend/tests/test_visit_vendors.py) | [PR #39][p39] · [PR #55][p55] |
| VIS-03 | 업체 선택 | 해당 업체 포트폴리오 사진 공개 범위 검사 | 구현 | CI | [visit/router.py](../backend/app/visit/router.py) | [tests/test_visit_vendors.py](../backend/tests/test_visit_vendors.py) | [PR #39][p39] |
| VIS-04 | 실측 요청 | 공정당 최대 3곳에 실측 요청 | 구현 | CI | [visit/router.py](../backend/app/visit/router.py) · [UI/vendors/RequestDialog.tsx](../frontend/components/vendors/RequestDialog.tsx) | [tests/test_visit_request.py](../backend/tests/test_visit_request.py) | [PR #39][p39] |
| VIS-05 | 실측 요청 | 선택 업체별 연락처 제공 동의·요청 문구 생성 | 구현 | CI | [visit/service.py](../backend/app/visit/service.py) | [tests/test_visit_request.py](../backend/tests/test_visit_request.py) | [PR #39][p39] |
| VIS-06 | 실측 요청 | 내 요청 목록·상태·남은 요청 가능 건수 조회 | 구현 | CI | [visit/router.py](../backend/app/visit/router.py) · [page/projects/[id]/visits/page.tsx](../frontend/app/projects/[id]/visits/page.tsx) | [tests/test_visit_request.py](../backend/tests/test_visit_request.py) | [PR #39][p39] |
| VIS-07 | 실측 요청 | 견적서 수신 전 고객 요청 취소 | 구현 | CI | [visit/router.py](../backend/app/visit/router.py) | [tests/test_visit_request.py](../backend/tests/test_visit_request.py) | [PR #39][p39] |
| VIS-08 | 실측 요청 | 공사 날짜 수락 전 같은 공정 전체 요청을 닫고 다시 고르기 | 구현 | CI | [schedule/router.py](../backend/app/schedule/router.py) | [tests/test_reselect.py](../backend/tests/test_reselect.py) | [PR #39][p39] |
| VIS-09 | 업체 작업함 | 업체가 받은 실측 요청 상세·고객 연락처 권한 조회 | 구현 | CI | [visit/router.py](../backend/app/visit/router.py) · [page/vendor/requests/[visitId]/page.tsx](../frontend/app/vendor/requests/[visitId]/page.tsx) | [tests/test_visit_inbox.py](../backend/tests/test_visit_inbox.py) | [PR #39][p39] |
| VIS-10 | 업체 작업함 | 업체의 요청 거절·새 요청 읽음 처리 | 구현 | CI | [visit/router.py](../backend/app/visit/router.py) | [tests/test_visit_inbox.py](../backend/tests/test_visit_inbox.py) | [PR #39][p39] |
| VIS-11 | 실측 견적서 | 업체가 견적서 파일·금액·기간·세금 방식 임시 저장 | 구현 | CI | [visit/router.py](../backend/app/visit/router.py) · [page/vendor/requests/[visitId]/quote/page.tsx](../frontend/app/vendor/requests/[visitId]/quote/page.tsx) | [tests/test_vendor_quote.py](../backend/tests/test_vendor_quote.py) | [PR #39][p39] |
| VIS-12 | 실측 견적서 | 필수 칸 검사 후 실측 견적서 보내기 | 구현 | CI | [visit/router.py](../backend/app/visit/router.py) | [tests/test_vendor_quote.py](../backend/tests/test_vendor_quote.py) | [PR #39][p39] |
| VIS-13 | 실측 견적서 | 수정 후 임시 저장한 실측 견적서를 새 버전으로 다시 올리고 이전 버전 보존·비교 | 구현 | CI | [visit/service.py](../backend/app/visit/service.py) · [schedule/router.py](../backend/app/schedule/router.py) | [tests/test_quote_compare.py](../backend/tests/test_quote_compare.py) | [PR #39][p39] |
| VIS-14 | 실측 견적서 | 업체·요청 고객에게 견적 파일만 권한별 제공 | 구현 | CI | [visit/router.py](../backend/app/visit/router.py) | [tests/test_quote_file_share.py](../backend/tests/test_quote_file_share.py) | [PR #39][p39] |
| VIS-15 | 실측 견적서 | 변경 없는 다시 보내기는 `already_sent` 409, 동시 재제출은 한 건만 성공 | 구현 | CI | [visit/service.py](../backend/app/visit/service.py) | [tests/test_quote_compare.py](../backend/tests/test_quote_compare.py) | [PR #39][p39] |
| VIS-16 | 실측 견적서 | 업체 확정 뒤 견적서 임시 수정·재제출 409 차단 | 구현 | CI | [visit/service.py](../backend/app/visit/service.py) | [tests/test_quote_compare.py](../backend/tests/test_quote_compare.py) | [PR #39][p39] |

## 표준견적·공정표·업체 확정

| ID | 기능 | 세부 동작 | 개발 | 검증 | 코드 근거 | 테스트 근거 | 이슈·PR 및 이슈 담당 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| QUO-01 | 표준견적서 | 도배·목공 공공 기준 수량·단가·공급가·부가세 계산 | 구현 | CI | [calc/standard_quote.py](../backend/app/calc/standard_quote.py) · [calc/dobae.py](../backend/app/calc/dobae.py) · [calc/mokgong.py](../backend/app/calc/mokgong.py) | [tests/test_calc_standard_quote.py](../backend/tests/test_calc_standard_quote.py) | [PR #39][p39] |
| QUO-02 | 표준견적서 | 계산 당시 단가·조건·버전으로 표준견적서 저장·조회 | 구현 | CI | [quote/service.py](../backend/app/quote/service.py) · [quote/router.py](../backend/app/quote/router.py) | [tests/test_standard.py](../backend/tests/test_standard.py) | [PR #39][p39] |
| QUO-03 | 가견적 | 확인된 업체 단가와 표준 수량으로 예상금액 산출 | 구현 | CI | [calc/estimate.py](../backend/app/calc/estimate.py) · [visit/service.py](../backend/app/visit/service.py) | [tests/test_calc_estimate.py](../backend/tests/test_calc_estimate.py) | [PR #39][p39] |
| QUO-04 | 견적 비교 | 업체별 실측 견적과 표준견적서·차액 비교 | 구현 | CI | [schedule/router.py](../backend/app/schedule/router.py) · [page/projects/[id]/quotes/page.tsx](../frontend/app/projects/[id]/quotes/page.tsx) | [tests/test_quote_compare.py](../backend/tests/test_quote_compare.py) | [PR #39][p39] |
| QUO-05 | 업체 확정 | 고객이 본 견적 버전으로 업체 확정·동시 확정 보호 | 구현 | CI | [schedule/router.py](../backend/app/schedule/router.py) · [page/projects/[id]/quotes/[visitId]/confirm/page.tsx](../frontend/app/projects/[id]/quotes/[visitId]/confirm/page.tsx) | [tests/test_deal.py](../backend/tests/test_deal.py) | [PR #39][p39] |
| QUO-06 | 업체 다시 고르기 | 공사 날짜 수락 전 확정 취소·요청 닫기 | 구현 | CI | [schedule/router.py](../backend/app/schedule/router.py) | [tests/test_reselect.py](../backend/tests/test_reselect.py) | [PR #39][p39] |
| QUO-07 | 견적 금액 AI 추출 | 실측 견적서 파일 내용을 자동 OCR로 읽어 금액 입력 | 미구현 | 미검증 | [visit/router.py](../backend/app/visit/router.py) | 없음 | 없음 |
| SCH-01 | 예상 공정표 | 공정 순서·반나절 작업량·휴일 반영 자동 계산 | 구현 | CI | [calc/schedule.py](../backend/app/calc/schedule.py) · [schedule/router.py](../backend/app/schedule/router.py) | [tests/test_calc_schedule.py](../backend/tests/test_calc_schedule.py) | [PR #39][p39] |
| SCH-02 | 예상 공정표 | 프로젝트 시작일·주말 여부를 바꿔 재계산 | 구현 | CI | [schedule/router.py](../backend/app/schedule/router.py) | [tests/test_plan.py](../backend/tests/test_plan.py) | [PR #39][p39] |
| SCH-03 | 예상 공정표 | 고객이 아직 날짜를 수락하지 않았다면 예상본 제공 | 구현 | CI | [schedule/router.py](../backend/app/schedule/router.py) · [page/projects/[id]/plan/page.tsx](../frontend/app/projects/[id]/plan/page.tsx) | [tests/test_plan.py](../backend/tests/test_plan.py) | [PR #39][p39] |
| SCH-04 | 공사 날짜 | 업체의 작업 날짜·인원 미리 보기와 충돌 확인 | 구현 | CI | [schedule/router.py](../backend/app/schedule/router.py) · [page/vendor/jobs/[dealId]/page.tsx](../frontend/app/vendor/jobs/[dealId]/page.tsx) | [tests/test_dates.py](../backend/tests/test_dates.py) | [PR #39][p39] |
| SCH-05 | 공사 날짜 | 업체의 날짜 제출·재제출·이력 관리 | 구현 | CI | [schedule/router.py](../backend/app/schedule/router.py) | [tests/test_dates.py](../backend/tests/test_dates.py) | [PR #39][p39] |
| SCH-06 | 공사 날짜 | 고객이 날짜 수락·다른 날짜 요청(최대 2회) | 구현 | CI | [schedule/router.py](../backend/app/schedule/router.py) · [page/projects/[id]/schedule/page.tsx](../frontend/app/projects/[id]/schedule/page.tsx) | [tests/test_dates.py](../backend/tests/test_dates.py) | [PR #39][p39] |
| SCH-07 | 확정 공정표 | 날짜 수락 뒤 확정 공정표 버전 계산·조회 | 구현 | CI | [schedule/service.py](../backend/app/schedule/service.py) · [page/projects/[id]/plan/page.tsx](../frontend/app/projects/[id]/plan/page.tsx) | [tests/test_final_plan.py](../backend/tests/test_final_plan.py) | [PR #39][p39] |
| SCH-08 | 업체 작업함 | 대기·공사·완료 목록과 탭별 수 제공 | 구현 | CI | [schedule/router.py](../backend/app/schedule/router.py) · [page/vendor/page.tsx](../frontend/app/vendor/page.tsx) | [tests/test_visit_inbox.py](../backend/tests/test_visit_inbox.py) | [PR #39][p39] |
| SCH-09 | 추가 금액 | 공사 중 추가 금액·공사 사진 기록 | 구현 | CI | [schedule/router.py](../backend/app/schedule/router.py) | [tests/test_extras.py](../backend/tests/test_extras.py) | [PR #39][p39] |
| SCH-10 | 추가 금액 | 고객이 추가 금액 확인·업체와 상의 응답 | 구현 | CI | [schedule/router.py](../backend/app/schedule/router.py) | [tests/test_extras.py](../backend/tests/test_extras.py) | [PR #39][p39] |
| SCH-11 | 공사 완료 | 업체가 공사 완료·남은 일 완료 상태 등록 | 구현 | CI | [schedule/router.py](../backend/app/schedule/router.py) | [tests/test_finish.py](../backend/tests/test_finish.py) | [PR #39][p39] |
| SCH-12 | 공사 완료 | 고객이 완료 수락 또는 남은 일 통보 | 구현 | CI | [schedule/router.py](../backend/app/schedule/router.py) | [tests/test_finish.py](../backend/tests/test_finish.py) | [PR #39][p39] |
| SCH-13 | 내 공사 | 현재 상태 요약·다음 날짜·준비 할 일 조회 | 구현 | CI | [schedule/router.py](../backend/app/schedule/router.py) · [page/projects/[id]/page.tsx](../frontend/app/projects/[id]/page.tsx) | [tests/test_overview.py](../backend/tests/test_overview.py) | [PR #39][p39] · [PR #59][p59] |
| SCH-14 | 서류 모음 | 견적서·공정표·추가 금액 관련 문서 모아 보기 | 구현 | CI | [schedule/router.py](../backend/app/schedule/router.py) · [page/projects/[id]/docs/page.tsx](../frontend/app/projects/[id]/docs/page.tsx) | [tests/test_overview.py](../backend/tests/test_overview.py) | [PR #39][p39] · [PR #59][p59] |
| SCH-15 | 예상 공정표 | 사용자 입력 물량·DB 정형 기준 품·인원으로 참고 작업일 계산하는 새 경로 | 진행 | 미검증 | [schedule/router.py](../backend/app/schedule/router.py) · [data_ingest.py](../backend/app/data_ingest.py) | 없음 | [#102][i102] (담당 gksrkd2) |
| SCH-16 | 일정 MCP | 일정 조회·변경 시뮬레이션·승인 대기 MCP 도구 서버 | 미구현 | 미검증 | [mcp_server.py](../backend/app/mcp_server.py) | 없음 | 없음 |
| SCH-17 | 일정 변경 요청 | 이미 수락한 날짜에 고객이 변경 이유·희망 시작일을 남기고 업체가 해당 날짜 중 제안 | 구현 | CI | [schedule/router.py](../backend/app/schedule/router.py) · [schedule/service.py](../backend/app/schedule/service.py) | [tests/test_final_plan.py](../backend/tests/test_final_plan.py) | [PR #39][p39] |
| SCH-18 | 업체 날짜 변경 | 이미 수락한 날짜에 업체가 `kind=change`로 변경 제안 (고객 요청이 없으면 이유 필수·누락 422) | 구현 | CI | [schedule/service.py](../backend/app/schedule/service.py) · [page/vendor/jobs/[dealId]/page.tsx](../frontend/app/vendor/jobs/[dealId]/page.tsx) | [tests/test_final_plan.py](../backend/tests/test_final_plan.py) | [PR #39][p39] |
| SCH-19 | 날짜 변경 영향 | 고객 수락 전 원래 날짜 유지·변경 후 공정표 미리 보기·다른 공정과 겹치면 수락 409 | 구현 | CI | [schedule/service.py](../backend/app/schedule/service.py) · [page/projects/[id]/plan/page.tsx](../frontend/app/projects/[id]/plan/page.tsx) | [tests/test_final_plan.py](../backend/tests/test_final_plan.py) | [PR #39][p39] |
| SCH-20 | 날짜 변경 수락 | 고객이 새 날짜를 수락하면 해당 업체 일정 수정·확정 공정표 새 버전·이력·알림 생성 | 구현 | CI | [schedule/router.py](../backend/app/schedule/router.py) · [schedule/service.py](../backend/app/schedule/service.py) | [tests/test_final_plan.py](../backend/tests/test_final_plan.py) | [PR #39][p39] |
| SCH-21 | 관계 업체 재조정 | 날짜 변경 영향을 받은 다른 업체에게 자동 재확정 요청·전체 일정 재승인까지 처리 | 미구현 | 미검증 | [schedule/service.py](../backend/app/schedule/service.py) | 없음 | 없음 |

## 파일·알림

| ID | 기능 | 세부 동작 | 개발 | 검증 | 코드 근거 | 테스트 근거 | 이슈·PR 및 이슈 담당 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| FIL-01 | 파일 올리기 | 도면·공간·시공·견적·단가·공사 사진 업로드 | 구현 | CI | [files/router.py](../backend/app/files/router.py) · [files/service.py](../backend/app/files/service.py) | [tests/test_files.py](../backend/tests/test_files.py) | [PR #39][p39] |
| FIL-02 | 파일 안전 | 종류·크기 제한·사진 위치정보 제거 | 구현 | CI | [files/service.py](../backend/app/files/service.py) · [files/images.py](../backend/app/files/images.py) | [tests/test_files.py](../backend/tests/test_files.py) | [PR #39][p39] |
| FIL-03 | 파일 저장 | 개발 로컬 저장과 AWS S3 저장 추상화 | 구현 | CI | [files/storage.py](../backend/app/files/storage.py) | [tests/test_storage_s3.py](../backend/tests/test_storage_s3.py) | [PR #25][p25] |
| FIL-04 | 파일 보기 | 업로드 소유자·관리자 파일 접근 제한 | 구현 | CI | [files/router.py](../backend/app/files/router.py) | [tests/test_files.py](../backend/tests/test_files.py) | [PR #39][p39] |
| FIL-05 | 도면 자동 판독 | 고객 업로드 평면도 이미지 OCR·도형 인식 | 미구현 | 미검증 | [UI/v2/store.ts](../frontend/components/v2/store.ts) | 없음 | 없음 |
| NTF-01 | 화면 알림 | 상태 변경 시 중복 방지 키로 알림 저장 | 구현 | CI | [notify/service.py](../backend/app/notify/service.py) | [tests/test_notify.py](../backend/tests/test_notify.py) | [PR #39][p39] |
| NTF-02 | 화면 알림 | 알림 목록·프로젝트별 필터 조회 | 구현 | CI | [notify/router.py](../backend/app/notify/router.py) · [page/notifications/page.tsx](../frontend/app/notifications/page.tsx) | [tests/test_notify.py](../backend/tests/test_notify.py) | [PR #39][p39] |
| NTF-03 | 화면 알림 | 종 배지의 안 읽은 알림 수 조회 | 구현 | CI | [notify/router.py](../backend/app/notify/router.py) | [tests/test_notify.py](../backend/tests/test_notify.py) | [PR #39][p39] |
| NTF-04 | 화면 알림 | 한 건 읽음·모두 읽음 기록 | 구현 | CI | [notify/router.py](../backend/app/notify/router.py) | [tests/test_notify.py](../backend/tests/test_notify.py) | [PR #39][p39] |
| NTF-05 | 외부 발송 | 문자·이메일로 상태 알림 발송 | 미구현 | 미검증 | [worker.py](../backend/app/worker.py) | 없음 | 없음 |
| NTF-06 | 기한 감시 | 기한 초과 알림 자동 cron 작업 | 미구현 | 미검증 | [worker.py](../backend/app/worker.py) | 없음 | 없음 |

## v2 빠른 예산·도면·견적·계산

| ID | 기능 | 세부 동작 | 개발 | 검증 | 코드 근거 | 테스트 근거 | 이슈·PR 및 이슈 담당 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| V2-01 | 상담 화면 | 목적 선택·스타일·집 정보·범위·자재 단계 UI | 구현 | 코드 | [page/v2/page.tsx](../frontend/app/v2/page.tsx) · [UI/v2/V2App.tsx](../frontend/components/v2/V2App.tsx) | 없음 | [#99][i99] (담당 lsm15111) · [PR #100][p100] · [#131][i131] (담당 lsm15111) · [PR #130][p130] |
| V2-02 | 노출 공종 | 현재 상담 화면에서 도배만 노출 | 구현 | 코드 | [UI/v2/data.ts](../frontend/components/v2/data.ts) | 없음 | [#131][i131] (담당 lsm15111) · [PR #130][p130] |
| V2-03 | 빠른 예산 | 집 평형·시공 범위·등급으로 시장 범위 산출 | 구현 | CI | [v2/router.py](../backend/app/v2/router.py) · [UI/v2/budget/QuickCard.tsx](../frontend/components/v2/budget/QuickCard.tsx) | [tests/test_calc_quick_budget.py](../backend/tests/test_calc_quick_budget.py) | [#131][i131] (담당 lsm15111) · [PR #130][p130] |
| V2-04 | 도면 목록 | 내장 예시 평면도 목록 제공 | 구현 | CI | [refprice/floor_plans.py](../backend/app/refprice/floor_plans.py) · [v2/router.py](../backend/app/v2/router.py) | [tests/test_v2_preview.py](../backend/tests/test_v2_preview.py) | [#99][i99] (담당 lsm15111) · [PR #100][p100] |
| V2-05 | 도면 수량 | 예시 평면도 공간별 벽·바닥·천장·벽지 수량 계산 | 구현 | CI | [calc/plan_qty.py](../backend/app/calc/plan_qty.py) · [UI/v2/intake/plans.ts](../frontend/components/v2/intake/plans.ts) | [tests/test_calc_plan_qty.py](../backend/tests/test_calc_plan_qty.py) | [#99][i99] (담당 lsm15111) · [PR #100][p100] |
| V2-06 | 도면 선택 | 평면도·확장·공간 범위·천장 여부 선택 | 구현 | 코드 | [UI/v2/intake/PlanStep.tsx](../frontend/components/v2/intake/PlanStep.tsx) | 없음 | [#99][i99] (담당 lsm15111) · [PR #100][p100] |
| V2-07 | 도면 파일 | 사용자가 올린 도면을 화면에서 임시 미리 보기 | 부분 | 코드 | [UI/v2/store.ts](../frontend/components/v2/store.ts) · [UI/v2/Board.tsx](../frontend/components/v2/Board.tsx) | 없음 | [#99][i99] (담당 lsm15111) · [PR #100][p100] |
| V2-08 | 견적 미리 보기 | 기존 프로젝트+예시 평면·목공 자재로 서버 계산 API 제공 | 부분 | CI | [v2/preview_service.py](../backend/app/v2/preview_service.py) · [v2/router.py](../backend/app/v2/router.py) | [tests/test_v2_preview.py](../backend/tests/test_v2_preview.py) | [#99][i99] (담당 lsm15111) · [PR #100][p100] |
| V2-09 | 자재 목록 | 목공 자재·단가 항목 API와 재료 선택 화면 | 부분 | CI | [v2/router.py](../backend/app/v2/router.py) · [UI/v2/materials/index.ts](../frontend/components/v2/materials/index.ts) | [tests/test_v2_preview.py](../backend/tests/test_v2_preview.py) | [#99][i99] (담당 lsm15111) · [PR #100][p100] |
| V2-10 | 정밀 도배 | 면적·현장 조건·벽지 종류를 반영한 견적 계산 | 구현 | CI | [calc/precise_dobae.py](../backend/app/calc/precise_dobae.py) · [v2/service.py](../backend/app/v2/service.py) | [tests/test_calc_precise_dobae.py](../backend/tests/test_calc_precise_dobae.py) | [#99][i99] (담당 lsm15111) · [PR #100][p100] · [#131][i131] (담당 lsm15111) · [PR #130][p130] |
| V2-11 | 정밀 목공 | 문짝·몰딩·걸레받이 등 선택 사양 계산 엔진 | 구현 | CI | [calc/precise_mokgong.py](../backend/app/calc/precise_mokgong.py) · [v2/service.py](../backend/app/v2/service.py) | [tests/test_calc_precise_mokgong.py](../backend/tests/test_calc_precise_mokgong.py) | [#99][i99] (담당 lsm15111) · [PR #100][p100] |
| V2-12 | 표준견적 | v2 입력으로 견적 내역·범위·합계 반환 | 구현 | CI | [v2/router.py](../backend/app/v2/router.py) · [UI/v2/doc/api.ts](../frontend/components/v2/doc/api.ts) | [tests/test_calc_v2_quote.py](../backend/tests/test_calc_v2_quote.py) | [#99][i99] (담당 lsm15111) · [PR #100][p100] |
| V2-13 | 예상 공정표 | v2 날짜·공정 선택·휴일을 반영한 일정 계산 | 구현 | CI | [calc/v2_plan.py](../backend/app/calc/v2_plan.py) · [UI/v2/doc/api.ts](../frontend/components/v2/doc/api.ts) | [tests/test_calc_v2_plan.py](../backend/tests/test_calc_v2_plan.py) | [#99][i99] (담당 lsm15111) · [PR #100][p100] |
| V2-14 | 받은 견적 확인 | 견적 금액·자재·시장 범위 차이 비교 | 구현 | CI | [calc/v2_check.py](../backend/app/calc/v2_check.py) · [UI/v2/doc/api.ts](../frontend/components/v2/doc/api.ts) | [tests/test_calc_v2_check.py](../backend/tests/test_calc_v2_check.py) | [#99][i99] (담당 lsm15111) · [PR #100][p100] |
| V2-15 | 추가 항목 | 목공 추가 항목 목록·범위 금액 계산 | 구현 | CI | [v2/router.py](../backend/app/v2/router.py) · [calc/v2_tools.py](../backend/app/calc/v2_tools.py) | [tests/test_calc_v2_tools.py](../backend/tests/test_calc_v2_tools.py) | [#99][i99] (담당 lsm15111) · [PR #100][p100] |
| V2-16 | 업체 가견적 | 업체 입력 단가×v2 표준 수량 계산 | 구현 | CI | [v2/service.py](../backend/app/v2/service.py) · [UI/v2/doc/api.ts](../frontend/components/v2/doc/api.ts) | [tests/test_v2_api.py](../backend/tests/test_v2_api.py) | [#99][i99] (담당 lsm15111) · [PR #100][p100] |
| V2-17 | 실측 금액 | 금액 입력·세금 방식에 따른 실측 견적 합계 계산 | 구현 | CI | [v2/service.py](../backend/app/v2/service.py) · [UI/v2/doc/api.ts](../frontend/components/v2/doc/api.ts) | [tests/test_v2_api.py](../backend/tests/test_v2_api.py) | [#99][i99] (담당 lsm15111) · [PR #100][p100] |
| V2-18 | 셀프 계산기 | 벽지·벽 면적 계산 | 구현 | CI | [v2/router.py](../backend/app/v2/router.py) · [UI/v2/tools/calc7.ts](../frontend/components/v2/tools/calc7.ts) | [tests/test_calc_v2_tools.py](../backend/tests/test_calc_v2_tools.py) | [#99][i99] (담당 lsm15111) · [PR #100][p100] |
| V2-19 | 셀프 계산기 | 몰딩·걸레받이 길이 계산 | 구현 | CI | [v2/router.py](../backend/app/v2/router.py) · [UI/v2/tools/calc7.ts](../frontend/components/v2/tools/calc7.ts) | [tests/test_calc_v2_tools.py](../backend/tests/test_calc_v2_tools.py) | [#99][i99] (담당 lsm15111) · [PR #100][p100] |
| V2-20 | 셀프 계산기 | 도장 면적 계산 | 구현 | CI | [v2/router.py](../backend/app/v2/router.py) · [UI/v2/tools/calc7.ts](../frontend/components/v2/tools/calc7.ts) | [tests/test_calc_v2_tools.py](../backend/tests/test_calc_v2_tools.py) | [#99][i99] (담당 lsm15111) · [PR #100][p100] |
| V2-21 | 체크리스트 | 상담용 체크 카드 결과를 브라우저에만 저장 | 부분 | 코드 | [UI/v2/tools/CheckCard.tsx](../frontend/components/v2/tools/CheckCard.tsx) | 없음 | [#99][i99] (담당 lsm15111) · [PR #100][p100] |
| V2-22 | 상담 사례 | 내 인테리어 건 목록·한 건 조회 | 구현 | CI | [v2/router.py](../backend/app/v2/router.py) · [UI/v2/cases.ts](../frontend/components/v2/cases.ts) | [tests/test_v2_cases.py](../backend/tests/test_v2_cases.py) | [#99][i99] (담당 lsm15111) · [PR #100][p100] |
| V2-23 | 상담 사례 | 새 건 생성·최대 30건 제한 | 구현 | CI | [v2/case_service.py](../backend/app/v2/case_service.py) · [UI/v2/cases.ts](../frontend/components/v2/cases.ts) | [tests/test_v2_cases.py](../backend/tests/test_v2_cases.py) | [#99][i99] (담당 lsm15111) · [PR #100][p100] |
| V2-24 | 상담 사례 | 진행상태·견적·일정을 서버 재계산하여 저장 | 구현 | CI | [v2/case_service.py](../backend/app/v2/case_service.py) · [UI/v2/cases.ts](../frontend/components/v2/cases.ts) | [tests/test_v2_cases.py](../backend/tests/test_v2_cases.py) | [#99][i99] (담당 lsm15111) · [PR #100][p100] |
| V2-25 | 상담 사례 | 저장한 건 다시 열기·이름 변경·삭제 | 구현 | CI | [v2/router.py](../backend/app/v2/router.py) · [UI/v2/cases.ts](../frontend/components/v2/cases.ts) | [tests/test_v2_cases.py](../backend/tests/test_v2_cases.py) | [#99][i99] (담당 lsm15111) · [PR #100][p100] |
| V2-26 | 상담 사례 | 이전 브라우저 임시 저장분을 한 번 서버로 옮기기 | 부분 | 코드 | [UI/v2/cases.ts](../frontend/components/v2/cases.ts) | 없음 | [#99][i99] (담당 lsm15111) · [PR #100][p100] |
| V2-27 | 상담 사진 | 실제 사진 첨부를 LLM 입력 이미지로 전달 | 부분 | 코드 | [UI/v2/ai/ask.tsx](../frontend/components/v2/ai/ask.tsx) · [v2/ask.py](../backend/app/v2/ask.py) | 없음 | [#99][i99] (담당 lsm15111) · [PR #100][p100] |

## AI 관문·대화·도구

| ID | 기능 | 세부 동작 | 개발 | 검증 | 코드 근거 | 테스트 근거 | 이슈·PR 및 이슈 담당 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AI-01 | 의도 분류 | 학습된 TF-IDF·로지스틱 회귀로 역할·신뢰도 추론 | 구현 | CI | [agent/intent.py](../backend/app/agent/intent.py) | [tests/test_agent_gate.py](../backend/tests/test_agent_gate.py) | [#72][i72] (담당 HyeongJjun) · [PR #87][p87] · [#75][i75] (담당 HyeongJjun) |
| AI-02 | 입구 관문 | 낮은 신뢰도에서 Jev 한 번 질의·실패 처리 | 구현 | CI | [agent/gate.py](../backend/app/agent/gate.py) · [agent/llm.py](../backend/app/agent/llm.py) | [tests/test_agent_gate.py](../backend/tests/test_agent_gate.py) | [#72][i72] (담당 HyeongJjun) · [PR #87][p87] · [#95][i95] (담당 HyeongJjun) · [PR #96][p96] |
| AI-03 | 입구 관문 | 개발·테스트 설정으로 Jev 사용 끄기 | 구현 | CI | [agent/gate.py](../backend/app/agent/gate.py) | [tests/test_agent_gate.py](../backend/tests/test_agent_gate.py) | [#112][i112] (담당 HyeongJjun) · [PR #113][p113] |
| AI-04 | 입구 관문 | 대기 중인 질문 답변이면 이전 역할 유지 | 구현 | CI | [agent/route.py](../backend/app/agent/route.py) · [v2/ask_chat.py](../backend/app/v2/ask_chat.py) | [tests/test_v2_ask_chat.py](../backend/tests/test_v2_ask_chat.py) | [#120][i120] (담당 HyeongJjun) · [PR #122][p122] |
| AI-05 | 입구 관문 | 범위 밖 공종은 LLM 없이 고정 안내 | 구현 | CI | [v2/ask.py](../backend/app/v2/ask.py) · [agent/gate.py](../backend/app/agent/gate.py) | [tests/test_v2_ask.py](../backend/tests/test_v2_ask.py) | [#72][i72] (담당 HyeongJjun) · [PR #87][p87] · [#128][i128] (담당 HyeongJjun) · [PR #129][p129] |
| AI-06 | 입구 관문 | Jev 실패 시 v2 상담 화면에 선택지 카드 제공 | 미구현 | 미검증 | [v2/ask.py](../backend/app/v2/ask.py) · [agent/gate.py](../backend/app/agent/gate.py) | 없음 | [#123][i123] (담당 HyeongJjun) |
| AI-07 | 역할 상담 | 일반 안내·공종 상담에서 지시문 chat_v3 사용 | 구현 | 코드 | [v2/ask.py](../backend/app/v2/ask.py) · [v2/prompts/chat_v3.md](../backend/app/v2/prompts/chat_v3.md) | 없음 | [#131][i131] (담당 lsm15111) · [PR #130][p130] |
| AI-08 | 공종 상담 | 질문 낱말로 도배·목공을 고르고 공종별 지시문 추가 | 구현 | CI | [v2/ask.py](../backend/app/v2/ask.py) · [agent/trades/dobae.py](../backend/app/agent/trades/dobae.py) | [tests/test_v2_ask.py](../backend/tests/test_v2_ask.py) | [#131][i131] (담당 lsm15111) · [PR #130][p130] |
| AI-09 | 공종 에이전트 | 독립 하위 공종 에이전트가 조건·주의점 응답 생성 | 미구현 | 미검증 | [agent/trade_agent.py](../backend/app/agent/trade_agent.py) | 없음 | [#71][i71] (담당 HyeongJjun) · [PR #81][p81] · [#85][i85] (담당 없음) |
| AI-10 | 견적 설명 | 계산된 견적 사실을 넣어 LLM 설명 생성 | 구현 | CI | [v2/ask.py](../backend/app/v2/ask.py) · [v2/prompts/quote_explanation_v2.md](../backend/app/v2/prompts/quote_explanation_v2.md) | [tests/test_v2_ask.py](../backend/tests/test_v2_ask.py) | [#99][i99] (담당 lsm15111) · [PR #100][p100] · [#131][i131] (담당 lsm15111) · [PR #130][p130] |
| AI-11 | 일정 설명 | 계산된 일정 사실을 넣어 LLM 설명 생성 | 구현 | CI | [v2/ask.py](../backend/app/v2/ask.py) · [v2/prompts/schedule_v1.md](../backend/app/v2/prompts/schedule_v1.md) | [tests/test_v2_ask.py](../backend/tests/test_v2_ask.py) | [#99][i99] (담당 lsm15111) · [PR #100][p100] |
| AI-12 | LLM 호출 | 역할별 모델 설정·도구 호출·스텁 경로 처리 | 구현 | CI | [agent/llm.py](../backend/app/agent/llm.py) · [v2/ask.py](../backend/app/v2/ask.py) | [tests/test_v2_ask.py](../backend/tests/test_v2_ask.py) | [#71][i71] (담당 HyeongJjun) · [PR #81][p81] · [#131][i131] (담당 lsm15111) · [PR #130][p130] |
| AI-13 | 서버 도구 | 지식 검색·금액 계산 도구를 백엔드에서 호출 | 구현 | CI | [v2/ask_tools.py](../backend/app/v2/ask_tools.py) · [v2/ask.py](../backend/app/v2/ask.py) | [tests/test_v2_ask.py](../backend/tests/test_v2_ask.py) | [#99][i99] (담당 lsm15111) · [PR #100][p100] · [#131][i131] (담당 lsm15111) · [PR #130][p130] |
| AI-14 | 화면 도구 | 고객 입력 제안·단계 카드 실행 결과를 Redis 턴으로 재개 | 구현 | CI | [v2/ask.py](../backend/app/v2/ask.py) · [UI/v2/ai/tools.ts](../frontend/components/v2/ai/tools.ts) | [tests/test_v2_ask.py](../backend/tests/test_v2_ask.py) | [#99][i99] (담당 lsm15111) · [PR #100][p100] |
| AI-15 | 동시성 | 같은 화면 도구 턴 중복 재개 방지·잘못된 결과 422 | 구현 | CI | [v2/ask.py](../backend/app/v2/ask.py) · [v2/ask_chat.py](../backend/app/v2/ask_chat.py) | [tests/test_v2_ask_chat.py](../backend/tests/test_v2_ask_chat.py) | [#119][i119] (담당 HyeongJjun) · [PR #121][p121] |
| AI-16 | 출력 보호 | 근거 없는 숫자·기간 문장을 검사해 제거 | 구현 | CI | [v2/guard.py](../backend/app/v2/guard.py) | [tests/test_v2_guard.py](../backend/tests/test_v2_guard.py) | [#99][i99] (담당 lsm15111) · [PR #100][p100] |
| AI-17 | 출력 보호 | 전화번호·동호수 가림 | 구현 | CI | [agent/intent.py](../backend/app/agent/intent.py) · [v2/guard.py](../backend/app/v2/guard.py) | [tests/test_v2_guard.py](../backend/tests/test_v2_guard.py) | [#95][i95] (담당 HyeongJjun) · [PR #96][p96] |
| AI-18 | 출처 확인 | 상담 답의 [K번호] 인용을 검증하고 출처 제공 | 구현 | CI | [v2/ask.py](../backend/app/v2/ask.py) · [knowledge/service.py](../backend/app/knowledge/service.py) | [tests/test_knowledge_search.py](../backend/tests/test_knowledge_search.py) | [#131][i131] (담당 lsm15111) · [PR #130][p130] |
| AI-19 | 후속 질문 | 질문 은행·출처를 바탕으로 답할 수 있는 질문 추천 | 구현 | CI | [knowledge/suggest.py](../backend/app/knowledge/suggest.py) · [v2/ask.py](../backend/app/v2/ask.py) | [tests/test_knowledge_search.py](../backend/tests/test_knowledge_search.py) | [#131][i131] (담당 lsm15111) · [PR #130][p130] |
| AI-20 | 대화 저장 | 질문·응답 저장과 대화 rev 충돌 409 | 구현 | CI | [chat/service.py](../backend/app/chat/service.py) · [v2/ask_chat.py](../backend/app/v2/ask_chat.py) | [tests/test_chat_store.py](../backend/tests/test_chat_store.py) | [#104][i104] (담당 HyeongJjun) · [PR #105][p105] · [#111][i111] (담당 HyeongJjun) · [PR #114][p114] |
| AI-21 | 대화 저장 | 실패·범위 밖 고정 안내 미저장·되물음 waiting 저장 | 구현 | CI | [v2/ask_chat.py](../backend/app/v2/ask_chat.py) | [tests/test_v2_ask_chat.py](../backend/tests/test_v2_ask_chat.py) | [#120][i120] (담당 HyeongJjun) · [PR #122][p122] · [#128][i128] (담당 HyeongJjun) · [PR #129][p129] |
| AI-22 | 대화 보기 | 새로고침 뒤 서버에 저장된 과거 대화를 화면에 복원 | 미구현 | 미검증 | [chat/router.py](../backend/app/chat/router.py) · [UI/v2/ai/ask.tsx](../frontend/components/v2/ai/ask.tsx) | 없음 | [#127][i127] (담당 HyeongJjun) |
| AI-23 | 응답 전송 | 대화 API에서 SSE 글자 단위 스트리밍 | 미구현 | 미검증 | [v2/router.py](../backend/app/v2/router.py) · [chat/router.py](../backend/app/chat/router.py) | 없음 | [#86][i86] (담당 HyeongJjun) |
| AI-24 | 안전 검사 | 화면 도구 결과를 허용 숫자의 신뢰 근거로 제한 | 부분 | 코드 | [v2/ask.py](../backend/app/v2/ask.py) · [v2/guard.py](../backend/app/v2/guard.py) | 없음 | [#124][i124] (담당 HyeongJjun) |
| AI-25 | 미병합 수정 | 평형·기간·빈 질문 개선과 chat_v4 지시문 | 진행 | 미검증 | [v2/prompts/chat_v3.md](../backend/app/v2/prompts/chat_v3.md) | 없음 | [#139][i139] (담당 HyeongJjun) · [PR #140][p140] (열림) |
| AI-26 | 사용 제한 | v2 상담 호출 횟수·도구 호출 상한 적용 | 구현 | CI | [v2/ask.py](../backend/app/v2/ask.py) | [tests/test_v2_ask.py](../backend/tests/test_v2_ask.py) | [#99][i99] (담당 lsm15111) · [PR #100][p100] |

## 기준 데이터 적재·RAG 검색

| ID | 기능 | 세부 동작 | 개발 | 검증 | 코드 근거 | 테스트 근거 | 이슈·PR 및 이슈 담당 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| RAG-01 | 자료 모델 | 자료 버전·정형 4종·지식 청크·임베딩 스키마 | 구현 | CI | [refprice/models.py](../backend/app/refprice/models.py) · [knowledge/models.py](../backend/app/knowledge/models.py) | [tests/test_reference_schema.py](../backend/tests/test_reference_schema.py) | [#61][i61] (담당 gksrkd2) · [PR #64][p64] |
| RAG-02 | 자료 보관 | 원본 식별자·페이지·provenance·이전 버전 보존 | 구현 | CI | [knowledge/ingest.py](../backend/app/knowledge/ingest.py) · [refprice/ingest.py](../backend/app/refprice/ingest.py) | [tests/test_data_ingest.py](../backend/tests/test_data_ingest.py) | [#68][i68] (담당 gksrkd2) · [PR #74][p74] |
| RAG-03 | CSV 적재 | `app.data_ingest` 수동 CLI의 `plan/load/embed/verify`: CSV 계획 확인·행 검사·DB 적재·임베딩·검증 | 구현 | CI | [data_ingest.py](../backend/app/data_ingest.py) · [knowledge/ingest.py](../backend/app/knowledge/ingest.py) · [refprice/ingest.py](../backend/app/refprice/ingest.py) | [tests/test_data_ingest.py](../backend/tests/test_data_ingest.py) | [#68][i68] (담당 gksrkd2) · [PR #74][p74] |
| RAG-04 | 임베딩 | `embed --execute` 배치·재시도·중단 후 재개·같은 본문 벡터 재사용 | 구현 | CI | [data_ingest.py](../backend/app/data_ingest.py) · [knowledge/ingest.py](../backend/app/knowledge/ingest.py) | [tests/test_data_ingest.py](../backend/tests/test_data_ingest.py) | [#68][i68] (담당 gksrkd2) · [PR #74][p74] |
| RAG-05 | 지식 자료 활성화 | `verify --require-embeddings --activate` 통과 시 RAG 지식 버전 활성·이전 활성 버전 종료 | 구현 | CI | [data_ingest.py](../backend/app/data_ingest.py) · [knowledge/repository.py](../backend/app/knowledge/repository.py) | [tests/test_data_ingest.py](../backend/tests/test_data_ingest.py) | [#68][i68] (담당 gksrkd2) · [PR #74][p74] · [PR #106][p106] |
| RAG-06 | 정형자료 | 평면도·공사단가·생산성·임금 4종 테이블 적재 구조 | 구현 | CI | [refprice/ingest.py](../backend/app/refprice/ingest.py) · [refprice/models.py](../backend/app/refprice/models.py) | [tests/test_reference_schema.py](../backend/tests/test_reference_schema.py) | [#61][i61] (담당 gksrkd2) · [PR #64][p64] |
| RAG-07 | 정형자료 현행 정책 | 미사용 정형 4종은 적재·재적재·`--activate` 때도 `status=False` 유지 (자료 행 보존) | 구현 | CI | [data_ingest.py](../backend/app/data_ingest.py) · [refprice/models.py](../backend/app/refprice/models.py) | [tests/test_data_ingest.py](../backend/tests/test_data_ingest.py) | [PR #106][p106] (현행 비활성 정책) |
| RAG-08 | 검색 색인 | 활성 지식 데이터로 BM25 색인 구성·갱신 | 구현 | CI | [knowledge/service.py](../backend/app/knowledge/service.py) · [knowledge/bm25.py](../backend/app/knowledge/bm25.py) | [tests/test_knowledge_search.py](../backend/tests/test_knowledge_search.py) | [#131][i131] (담당 lsm15111) · [PR #130][p130] |
| RAG-09 | 의미 검색 | pgvector 유사도와 BM25 순위 RRF 결합 | 구현 | CI | [knowledge/repository.py](../backend/app/knowledge/repository.py) · [knowledge/bm25.py](../backend/app/knowledge/bm25.py) | [tests/test_knowledge_search.py](../backend/tests/test_knowledge_search.py) | [#131][i131] (담당 lsm15111) · [PR #130][p130] |
| RAG-10 | 검색 제한 | 공종별 가중치·법·안전·금액 질문 출처 우선순위 | 구현 | CI | [knowledge/bm25.py](../backend/app/knowledge/bm25.py) | [tests/test_knowledge_search.py](../backend/tests/test_knowledge_search.py) | [#131][i131] (담당 lsm15111) · [PR #130][p130] |
| RAG-11 | 출처 보존 | 공통 9열·원본 해시·쪽 번호 정규화 | 구현 | CI | [knowledge/json_csv.py](../backend/app/knowledge/json_csv.py) · [knowledge/sources.py](../backend/app/knowledge/sources.py) | [tests/test_knowledge_search.py](../backend/tests/test_knowledge_search.py) | [#133][i133] (담당 HyeongJjun) · [PR #135][p135] |
| RAG-12 | 상담 자료 | 상담 검색 지식 CSV 정리·중복 청크 제거 | 구현 | 코드 | [knowledge/json_csv.py](../backend/app/knowledge/json_csv.py) · [data/consult_knowledge_rag.csv](../data/consult/consult_knowledge_rag.csv) | 없음 | [#133][i133] (담당 HyeongJjun) · [PR #135][p135] |
| RAG-13 | 시공일지 | 쪽 이미지 비교·경계 합치기 전처리 도구 | 구현 | 코드 | [data/sigong_ilji/tools/merge.py](../data/sigong_ilji/tools/merge.py) · [data/sigong_ilji/SPEC.md](../data/sigong_ilji/SPEC.md) | 없음 | [#134][i134] (담당 HyeongJjun) · [PR #136][p136] · [PR #138][p138] |
| RAG-14 | 안내서 자료 | 가이드북 59행을 해시·원본 쪽·공종 범위 기준으로 정리 | 구현 | CI | [data/13_interior_guide_book_rag.csv](../data/processed/13_interior_guide_book_rag.csv) | [tests/test_data_ingest.py](../backend/tests/test_data_ingest.py) | [PR #141][p141] · [#142][i142] (담당 lsm15111) |
| RAG-15 | 운영 자료 | AWS DB에 지식(RAG) 자료의 활성 버전이 실제 존재하는지 확인 | 미확인 | 미검증 | [knowledge/repository.py](../backend/app/knowledge/repository.py) | 없음 | 없음 |
| RAG-16 | 자료 자동화 | 매일 자동 수집·활성화하는 예약 작업 | 미구현 | 미검증 | [worker.py](../backend/app/worker.py) | 없음 | 없음 |
| RAG-17 | 정형자료 향후 확장 | 별도 정책 결정 후 DB 정형 4종을 계산 엔진의 실서비스 입력으로 연결 | 미구현 | 미검증 | [data_ingest.py](../backend/app/data_ingest.py) · [calc/schedule.py](../backend/app/calc/schedule.py) | 없음 | 없음 |
| RAG-18 | 지식 CSV 변환 | `json_csv` 별도 도구로 상담 지식 JSON→공통 RAG 9열 CSV 변환 후 수동 적재 대상으로 준비 | 구현 | CI | [knowledge/json_csv.py](../backend/app/knowledge/json_csv.py) · [data/consult_knowledge_rag.csv](../data/consult/consult_knowledge_rag.csv) | [tests/test_knowledge_search.py](../backend/tests/test_knowledge_search.py) | [#133][i133] (담당 HyeongJjun) · [PR #135][p135] |

## 평가·시연

| ID | 기능 | 세부 동작 | 개발 | 검증 | 코드 근거 | 테스트 근거 | 이슈·PR 및 이슈 담당 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| EVAL-01 | 의도 평가 | 의도 분류 5라벨 평가·F1·혼동행렬·입력 검증·held-out 보호 | 구현 | 로컬 | [evaluation/run.py](../evaluation/run.py) · [evaluation/intent_metrics.py](../evaluation/intent_metrics.py) | [evaluation/tests/test_intent_metrics.py](../evaluation/tests/test_intent_metrics.py) (로컬 17개 통과, CI 미편입) | [#69][i69] (담당 HyeongJjun) · [PR #76][p76] · [#70][i70] (담당 HyeongJjun) · [PR #88][p88] |
| EVAL-02 | 의도 평가 | 학습 모델·Jev 비교 실험 자료와 스크립트 | 부분 | 코드 | [evaluation/run.py](../evaluation/run.py) · [agent/intent.py](../backend/app/agent/intent.py) | 없음 | [#70][i70] (담당 HyeongJjun) · [PR #88][p88] · [#80][i80] (담당 HyeongJjun) |
| EVAL-03 | RAG 평가 | 검색 지표·dev/held-out 말뭉치·공종별 검색 평가 | 구현 | 코드 | [evaluation/rag/metrics.py](../evaluation/rag/metrics.py) · [evaluation/rag/README.md](../evaluation/rag/README.md) | 없음 | [#134][i134] (담당 HyeongJjun) · [PR #136][p136] · [#131][i131] (담당 lsm15111) · [PR #130][p130] |
| EVAL-04 | 상담 답 평가 | 상담 답 품질 30문항 평가 실행 도구 | 구현 | 코드 | [evaluation/answer/run.py](../evaluation/answer/run.py) · [evaluation/answer/score.py](../evaluation/answer/score.py) | 없음 | [#131][i131] (담당 lsm15111) · [PR #130][p130] |
| EVAL-05 | 공종 평가 | 공종 판별·공종별 답변 평가 도구 | 구현 | 코드 | [evaluation/trade/route.py](../evaluation/trade/route.py) · [evaluation/trade/score.py](../evaluation/trade/score.py) | 없음 | [#131][i131] (담당 lsm15111) · [PR #130][p130] |
| EVAL-06 | 되묻기 평가 | 되물음 형식 평가 러너 | 구현 | 코드 | [evaluation/ask_back/run.py](../evaluation/ask_back/run.py) | 없음 | [#120][i120] (담당 HyeongJjun) · [PR #122][p122] |
| EVAL-07 | 입구 관문 평가 | Jev 켬·끔 낮은 신뢰도 검증 완료 | 진행 | 미검증 | [agent/gate.py](../backend/app/agent/gate.py) | 없음 | [#118][i118] (담당 HyeongJjun) |
| EVAL-08 | 실모델 QA | 유료 LLM·브라우저를 통한 실제 시연 전수 검증 | 진행 | 미검증 | [v2/router.py](../backend/app/v2/router.py) | 없음 | [#126][i126] (담당 HyeongJjun) |
| DEMO-01 | 시연 데이터 | 고객·업체·관리자 시연용 계정·샘플 생성 | 구현 | CI | [seed.py](../backend/app/seed.py) · [demo.py](../backend/app/demo.py) | [tests/test_demo.py](../backend/tests/test_demo.py) | [PR #39][p39] |
| DEMO-02 | 시연 화면 | 고객 프로젝트 시나리오 선택 페이지 | 구현 | 코드 | [page/demo/page.tsx](../frontend/app/demo/page.tsx) | 없음 | [PR #39][p39] |
| DEMO-03 | 시연 자동응답 | DEMO_AUTO 활성 시 업체 견적·작업 자동 회신 | 구현 | CI | [worker.py](../backend/app/worker.py) · [demo.py](../backend/app/demo.py) | [tests/test_demo.py](../backend/tests/test_demo.py) | [#50][i50] (담당 lsm15111) · [PR #49][p49] |
| DEMO-04 | 시연 자료 | 실측 견적서 예시 이미지 보유 | 구현 | 코드 | [demo.py](../backend/app/demo.py) | 없음 | [#50][i50] (담당 lsm15111) · [PR #49][p49] |
| DEMO-05 | 기존 상담창 | 공사 상담 버튼·예시 질문·정적 대답 | 부분 | 코드 | [lib/mock/ask.ts](../frontend/lib/mock/ask.ts) | 없음 | [#54][i54] (담당 lsm15111) · [PR #53][p53] |

## 기반·배포·미완성 작업

| ID | 기능 | 세부 동작 | 개발 | 검증 | 코드 근거 | 테스트 근거 | 이슈·PR 및 이슈 담당 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| OPS-01 | API 조립 | FastAPI 기본 등록·공통 오류 응답과 v2 업무 라우터 연결 | 구현 | CI | [main.py](../backend/app/main.py) · [shared/errors.py](../backend/app/shared/errors.py) | [tests/test_guards.py](../backend/tests/test_guards.py) | [PR #3][p3] (기본 앱·오류 형식) · [PR #39][p39] (v2 업무 라우터) |
| OPS-02 | API 보호 | Origin 검증·본문 크기·요청 속도 제한 | 구현 | CI | [main.py](../backend/app/main.py) · [shared/request_guards.py](../backend/app/shared/request_guards.py) | [tests/test_guards.py](../backend/tests/test_guards.py) | [PR #3][p3] (초기 보안 가드) |
| OPS-03 | 상태 확인 | live·ready로 API·DB·Redis 연결 검사 | 구현 | CI | [main.py](../backend/app/main.py) | [tests/test_health.py](../backend/tests/test_health.py) | [PR #3][p3] |
| OPS-04 | 스키마 | Alembic 초기 0001부터 0023까지 마이그레이션 확장 | 구현 | CI | [backend/migrations/versions/0001_init.py](../backend/migrations/versions/0001_init.py) · [backend/migrations/versions/0023_reference_simplify.py](../backend/migrations/versions/0023_reference_simplify.py) | [tests/test_reference_migration.py](../backend/tests/test_reference_migration.py) | [PR #3][p3] (0001 초기) · [PR #39][p39] (0002~0018) · [PR #64][p64] · [PR #100][p100] · [PR #106][p106] |
| OPS-05 | 프런트 API 호출 | Next.js 서버 읽기·브라우저 쓰기 API 호출 모듈 분리 | 구현 | 코드 | [lib/backend/server.ts](../frontend/lib/backend/server.ts) · [lib/backend/client.ts](../frontend/lib/backend/client.ts) | 없음 (브라우저 실제 통신 수용 시험 별도) | [PR #3][p3] (기본 통신 모듈) · [PR #39][p39] (v2 요청 처리 보강) |
| OPS-06 | 로컬 실행 | Docker Compose·Next.js·FastAPI·Postgres·Redis 구성 | 구현 | 코드 | [compose.yaml](../compose.yaml) | 없음 | [PR #3][p3] (로컬 기반) · [PR #25][p25] (AWS 연계 구성) · [PR #39][p39] (v2 업무 확장) |
| OPS-07 | AWS 인프라 | EC2·RDS·S3·ECR 스테이징 템플릿 | 구현 | 코드 | [infra/aws/staging.yaml](../infra/aws/staging.yaml) | 없음 | [PR #25][p25] |
| OPS-08 | AWS 배포 | main 성공 CI 뒤 ECR 이미지→SSM 배포·헬스체크 워크플로 | 구현 | 코드 | [.github/workflows/deploy-staging.yml](../.github/workflows/deploy-staging.yml) · [deploy/aws/deploy.sh](../deploy/aws/deploy.sh) | 없음 | [PR #25][p25] · [PR #45][p45] · [PR #48][p48] |
| OPS-09 | CI | 저장소·백엔드·프런트 타입·빌드 검증 | 구현 | CI | [.github/workflows/ci.yml](../.github/workflows/ci.yml) · [.github/scripts/check_repo.py](../.github/scripts/check_repo.py) | 없음 | [#6][i6] (담당 없음) · [PR #7][p7] · [PR #45][p45] |
| OPS-10 | Security | 보안 검사와 취약 라이브러리 검사 | 구현 | CI | [.github/workflows/security.yml](../.github/workflows/security.yml) | 없음 | [#11][i11] (담당 dfs32dfs) · [PR #20][p20] |
| OPS-11 | 운영 확인 | 이번 HEAD의 실제 AWS 배포 성공·브라우저 시연 확인 | 미확인 | 미검증 | [.github/workflows/deploy-staging.yml](../.github/workflows/deploy-staging.yml) | 없음 | 없음 |
| OPS-12 | 백그라운드 | Redis arq ping 연결 확인 작업 | 구현 | 코드 | [worker.py](../backend/app/worker.py) | 없음 | [PR #3][p3] (기본 ping 작업) |
| OPS-13 | 백그라운드 | 시연 외 실서비스용 작업 큐·jobs 영속화 | 미구현 | 미검증 | [worker.py](../backend/app/worker.py) | 없음 | 없음 |
| OPS-14 | 일정 MCP | 일정 MCP 서버 파일 구현·실제 클라이언트 연결 | 미구현 | 미검증 | [mcp_server.py](../backend/app/mcp_server.py) | 없음 | 없음 |
| OPS-15 | API 타입 생성·검사 | FastAPI OpenAPI 생성→`schema.d.ts` 재생성·Git 차이 검사, 프런트 타입·lint·build | 구현 | CI | [lib/backend/schema.d.ts](../frontend/lib/backend/schema.d.ts) · [.github/workflows/ci.yml](../.github/workflows/ci.yml) | [CI 검증 단계](../.github/workflows/ci.yml) (브라우저 통신 E2E 아님) | [PR #3][p3] (초기 API 타입) · [PR #7][p7] (필수 검사 강화) · [PR #39][p39] (v2 API 타입 갱신) |

## 경계와 후속 확인

- 초기 회원 인증·역할 가드·FastAPI·Compose·worker ping은 PR #3에서 들어왔고, PR #39가 휴대폰·심사 필드·v2 고객·업체 업무를 더했다. 해당 동작의 최초 도입과 후속 변경을 구분해 기록했다. 화면·API 코드가 있어도 실서버 배포, 외부 발송, 실모델 품질까지 자동으로 인정하지 않았다.
- `frontend/lib/api/admin.ts`의 회원 목록은 예시 데이터다. 업체 심사 목록은 별도 실제 API다. 카카오 로그인·비밀번호 재설정 메일·문자 인증은 안내 화면만 있다.
- v2 예시 평면도의 수량 계산은 서버의 **준비된 도면 데이터**를 이용한다. 고객이 업로드한 이미지의 도형 인식·OCR은 구현되지 않았다. 도배만 열어 둔 화면과 목공 계산 엔진을 구분했다.
- 실측 견적서는 업체가 수정본을 임시 저장하고 버전 2·3으로 다시 제출할 수 있다. 수정 없는 반복 전송·동시 중복·업체 확정 후 제출에만 409 제한이 있다. 공사 날짜를 수락한 후에도 `kind=change` 날짜 제안·고객 수락·확정 공정표 새 버전 생성이 가능하다. 다른 업체의 자동 재조정·전체 재확정은 별도 미구현 단계다.
- 현재 v2 대화 API는 일반 JSON 응답이다. `chat_v3`를 사용하고, 공종 하위 에이전트는 실패 반환 뼈대이며 일정 MCP 서버는 비어 있다. `jobs` 영속 작업과 시연 외 worker는 구현되지 않았다.
- 정형 기준 데이터 4종의 `status=False` 유지와 자료 행 보존은 PR #106으로 정한 **현행 정책**이다. 장래 DB 기반 계산 연결을 위해서는 새 정책·개발 결정이 필요하다. 수동 CSV 적재는 `app.data_ingest`, 상담 지식 JSON→CSV 생성은 별도 `app.knowledge.json_csv`가 맡는다. RAG 검색은 **DB에서 활성화한 지식 버전이 있을 때** 동작한다. 이번 점검에서 AWS 활성 데이터 자체는 읽지 않았다.
- 후속 이슈 [#123][i123]·[#124][i124]·[#127][i127]·[#139][i139]는 열려 있다. PR #140도 열려 있으며 기준 `dev`에 미반영이다. PR #141은 병합됐지만 관련 이슈 [#142][i142]는 조회 당시 열려 있었다.

### 참조 링크

[i6]: https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/issues/6
[i11]: https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/issues/11
[i50]: https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/issues/50
[i54]: https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/issues/54
[i61]: https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/issues/61
[i68]: https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/issues/68
[i69]: https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/issues/69
[i70]: https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/issues/70
[i71]: https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/issues/71
[i72]: https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/issues/72
[i75]: https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/issues/75
[i80]: https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/issues/80
[i85]: https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/issues/85
[i86]: https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/issues/86
[i95]: https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/issues/95
[i99]: https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/issues/99
[i102]: https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/issues/102
[i104]: https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/issues/104
[i111]: https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/issues/111
[i112]: https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/issues/112
[i118]: https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/issues/118
[i119]: https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/issues/119
[i120]: https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/issues/120
[i123]: https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/issues/123
[i124]: https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/issues/124
[i126]: https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/issues/126
[i127]: https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/issues/127
[i128]: https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/issues/128
[i131]: https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/issues/131
[i133]: https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/issues/133
[i134]: https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/issues/134
[i139]: https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/issues/139
[i142]: https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/issues/142
[p3]: https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/pull/3
[p7]: https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/pull/7
[p20]: https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/pull/20
[p25]: https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/pull/25
[p39]: https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/pull/39
[p45]: https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/pull/45
[p48]: https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/pull/48
[p49]: https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/pull/49
[p53]: https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/pull/53
[p55]: https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/pull/55
[p59]: https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/pull/59
[p64]: https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/pull/64
[p74]: https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/pull/74
[p76]: https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/pull/76
[p81]: https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/pull/81
[p87]: https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/pull/87
[p88]: https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/pull/88
[p96]: https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/pull/96
[p100]: https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/pull/100
[p105]: https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/pull/105
[p106]: https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/pull/106
[p113]: https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/pull/113
[p114]: https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/pull/114
[p121]: https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/pull/121
[p122]: https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/pull/122
[p129]: https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/pull/129
[p130]: https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/pull/130
[p135]: https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/pull/135
[p136]: https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/pull/136
[p138]: https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/pull/138
[p140]: https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/pull/140
[p141]: https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/pull/141
