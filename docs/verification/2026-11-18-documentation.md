# 2026-11-18 저장소 기능 문서 근거 점검

[문서 목차](../README.md) · [기능 개발표](../feature-roadmap.md) · [검증 및 테스트](../testing.md) · [기여 가이드](../../CONTRIBUTING.md) · [참고 데이터](../reference-data.md)

> 이 기록은 문서화 작업자가 기능별 상태를 구분하기 위해 확인한 근거이다. 기준 시점 이후 코드·이슈·PR·배포 상태는 달라질 수 있다.

## 확인 기준과 범위

| 항목 | 확인값 |
| --- | --- |
| 확인일 | 2026-11-18 (한국시간) |
| 저장소 | `SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM` |
| 작업 브랜치 | `docs-reference-data-current` (문서 작성 중인 로컬 작업 브랜치) |
| 기능 검토 기준 | `dev`에 병합된 커밋 `1a3e65661924e93225914ebb4b440bbd8330cc2a` (PR #141 병합 뒤) |
| 실제 조회 | `git rev-parse HEAD`, `git log`, FastAPI router/service/models·프런트 페이지/API 호출·테스트·평가·워크플로 파일, GitHub PR·이슈 기록 |
| PR 기록 | `work/documentation-audit-20261118/pulls.json` 68건(상태·본문·head 포함) |
| 이슈 기록 | `work/documentation-audit-20261118/issues.json` API 항목 142건. 여기에는 PR 68건이 함께 들어 있어 순수 이슈는 74건 |
| 구조 참고 | [4팀 기능개발표](https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-4TEAM/blob/develop/docs/feature-roadmap.md)는 표 구성만 참고. 업무 항목·상태·이슈는 이 저장소 코드를 기준으로 별도 판단 |

검토 범위에는 `backend/app/main.py`에 실제 등록된 10개 업무 라우터, 각 서비스·모델, `backend/tests`, `frontend/app` 및 `frontend/components/v2`, `evaluation`, `data/processed`, `data/consult`, `backend/app/data_ingest.py`, `.github/workflows`와 배포 구성이 들어간다. 원본 PDF·개인 공유 금지 데이터·실서버 자격정보는 열지 않았다.

## 성공한 CI와 의미

| 근거 | 결과 | 포함된 검증 | 한계 |
| --- | --- | --- | --- |
| [dev CI #44270185547](https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/actions/runs/44270185547) | `success`, 이벤트 `push`, `dev`, SHA `1a3e65661924e93225914ebb4b440bbd8330cc2a` | 저장소 검사, backend `ruff`·`alembic heads/check`·`pytest -q`(CI용 PostgreSQL/Redis), 프런트 OpenAPI 타입·typecheck·lint·build, Compose·이미지 빌드·웹 HTTP | **이 기준 코드의 CI만 통과**했다. 현재 작성 중인 문서 변경에는 별도 CI가 없다 |
| [dev Security #44270185469](https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/actions/runs/44270185469) | `success`, 이벤트 `push`, `dev`, 동일 SHA | Python·JavaScript/TypeScript CodeQL | 운영 보안·실제 사용자 시나리오 검증과 동일하지 않다 |

CI 내용은 [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) 및 [`.github/workflows/security.yml`](../../.github/workflows/security.yml)로 재확인했다. CI는 `LLM_LIVE=false`로 유료 모델 호출을 하지 않는다. `main` 커밋 배포 여부는 dev CI 결과로 추론하지 않는다.

## 로컬 검증 기록 (기준 HEAD `1a3e656`)

| 검사 | 실행 환경·근거 | 결과 | 해석 |
| --- | --- | --- | --- |
| `pytest -q --tb=short` (backend 전체) | PostgreSQL `mitjip_test`(`127.0.0.1:55474`), Redis DB 15(`127.0.0.1:56374`), `LLM_LIVE=false`. 로컬 실행 로그 `work/documentation-audit-20261118/backend-tests.log` 마지막 줄 확인 | **653 passed in 772.94s (12:52)** | 실제 테스트 DB 기반 백엔드 자동 테스트. 유료 LLM API 호출 0회. AWS 배포·실모델·전체 화면 수용 검증과는 별개 |
| `python -m unittest discover -s evaluation/tests -v` | [`evaluation/tests/test_intent_metrics.py`](../../evaluation/tests/test_intent_metrics.py) 직접 로컬 실행 | **17 tests, OK** (`0.060s`) | 평가 입력 읽기·지표 계산·held-out 보호 등 **평가 코드 동작 검사**. [현재 CI 워크플로](../../.github/workflows/ci.yml)에는 이 테스트 모음 실행이 없으며 의도 분류 모델의 품질 검증이 아님 |

두 실행은 이번 로컬 작업에서 확보한 기준 코드 검증으로 기록한다. 현재 문서 변경분을 별도 GitHub CI에 올려 확인한 결과로 해석하지 않는다.

## 기능 개발표의 판정 방법

- [기능 개발표](../feature-roadmap.md)의 **187개 세부 동작을 한 행씩** 작성하고, 11개 업무 영역으로 나눴다. 코드·테스트·이슈·PR을 각 행에서 따라갈 수 있도록 분리했다.
- 개발 상태는 `구현`(현재 코드 경로 있음), `부분`(일부 계층이나 데모 경로만 연결), `진행`(기준 dev에 아직 미병합), `미구현`(처리 코드 없음), `미확인`(운영 환경 확인 불가)로 구분했다.
- 검증 상태는 `CI`(관련 자동 테스트 또는 CI 검사가 기준 `dev`에서 성공), `로컬`(해당 검사를 로컬에서 실행해 통과했으나 CI 미편입), `코드`(코드 경로만 확인), `미검증`으로 구분했다. 테스트 파일 이름만 존재하는 행을 자동으로 QA 완료라고 표시하지 않았다.
- `CI` 표시는 운영 AWS의 성공, 유료 LLM 답변 품질, 모든 화면 브라우저 수용 테스트의 완료를 뜻하지 않는다.
- 이슈 담당은 조회한 GitHub 이슈의 `assignees`에 근거한다. 할당이 없으면 `없음`; 근거 PR·이슈가 없으면 `없음`으로 둔다. 이슈 종료만으로 해당 기능의 개발 완료를 판단하지 않았다.
- 회원·기반 인프라의 최초 도입은 [PR #3](https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/pull/3)의 `9b49ecb` 커밋, v2 휴대폰·기능 확장은 [PR #39](https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/pull/39)의 `e7c1a07` 커밋 및 파일별 차이를 대조했다. 예전 삭제·정리된 이슈를 새 번호로 꾸며 연결하지 않았다.

## 기능별 재검수 근거

| 기능표 범위 | 확인한 코드·테스트 | 판정 |
| --- | --- | --- |
| `SCH-17~21` 수락 후 날짜 변경 | [`schedule/service.py`](../../backend/app/schedule/service.py) `propose_dates`·`accept_dates`, [`test_final_plan.py`](../../backend/tests/test_final_plan.py)의 `test_change_request_new_dates_then_accept` 및 `test_vendor_change_needs_reason_and_overlap_blocks_accept` | 고객 요청→업체 `kind=change` 제안→고객 수락·새 공정표 버전은 구현. 이유 누락 422·겹침 수락 409. 다른 업체의 자동 재확정 단계는 미구현 |
| `VIS-13/15/16` 견적서 재제출 | [`visit/service.py`](../../backend/app/visit/service.py) `send_quote`, [`test_quote_compare.py`](../../backend/tests/test_quote_compare.py)의 `test_resend_and_compare`·`test_two_resends_at_once_and_chosen` | 임시 저장 후 버전 2 재제출·이전 버전 보존은 구현. 변경 없는 전송 409·동시 재제출 하나 409·업체 확정 후 수정/전송 409를 별도 제약으로 기록 |
| `AUT-01~08`, `OPS-01~06/12` 초기 기능 출처 | `git log -- backend/app/auth/router.py`는 `9b49ecb` 최초 도입, `auth/service.py`·`test_auth.py`는 `e7c1a07`에서 전화번호·심사 필드 확장. `main.py`, `worker.py`, `compose.yaml`, `frontend/lib/backend/*` 초기 파일도 `9b49ecb`에서 확인 | 초기 회원·API·Compose·worker ping은 PR #3. PR #39는 해당 동작의 v2 확장 범위로만 표시 |
| `OPS-05/15` 프런트 연결·API 타입 | [`server.ts`](../../frontend/lib/backend/server.ts)·[`client.ts`](../../frontend/lib/backend/client.ts), [`schema.d.ts`](../../frontend/lib/backend/schema.d.ts), [CI](../../.github/workflows/ci.yml)의 `openapi-typescript`→`git diff --exit-code`·typecheck·lint·build | API 타입 재생성·정합 검사는 CI 성공. 프런트 브라우저↔API 실제 업무 통신은 별도 수용 시험 근거가 없어 `코드` |
| `EVAL-01` 의도 평가 | [`evaluation/tests/test_intent_metrics.py`](../../evaluation/tests/test_intent_metrics.py) 17개 unittest 통과 | 로컬 평가 코드 검사 통과. CI 편입·모델 분류 품질 검증과 구분 |
| `RAG-03/18` 입력 변환과 적재 | [`app/data_ingest.py`](../../backend/app/data_ingest.py) 명령 `plan/load/embed/verify`, [`knowledge/json_csv.py`](../../backend/app/knowledge/json_csv.py)의 별도 JSON→CSV 변환. [`test_knowledge_search.py`](../../backend/tests/test_knowledge_search.py) 변환 검사 | CSV 적재 CLI에 JSON→CSV 변환 명령은 없다. 생성한 CSV를 별도 `load` 대상으로 적재 |
| `RAG-07/17` 정형자료 정책 | [`app/data_ingest.py`](../../backend/app/data_ingest.py)의 `INACTIVE_DATASETS`·`activate_versions`, [`test_data_ingest.py`](../../backend/tests/test_data_ingest.py)의 `test_unused_structured_datasets_stay_inactive`, [PR #106](https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/pull/106) | 정형 4종 비활성 유지·행 보존은 테스트된 현재 정책. DB 정형값을 실제 계산에 쓰는 기능은 향후 정책·개발 결정 대상 |

## 핵심 PR과 현재 코드 대조

| 업무·근거 | PR 상태와 현재 확인한 코드 | 판단 |
| --- | --- | --- |
| 기존 고객·업체·프로젝트·실측·견적·공정표·관리자 [PR #39](https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/pull/39) | `MERGED` (기준 `main`에 병합, 이후 개발 브랜치에 통합). `auth`, `project`, `vendor`, `visit`, `quote`, `schedule`, `files`, `notify` router와 프런트 실제 호출 확인 | 실제 API 동작 범위 구현. 실서버 배포 완료 판정과 분리 |
| 시연 업체 자동응답 [PR #49](https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/pull/49) | `MERGED`. `backend/app/demo.py` 및 `worker.py`는 `DEMO_AUTO`에서만 자동 답변 | 시연 범위의 구현. 일반 운영 작업 자동화 아님 |
| v2 계산·화면 [PR #100](https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/pull/100) | `MERGED`. `backend/app/v2/router.py`·`calc/v2_*`·`precise_*`·`plan_qty.py`, `frontend/components/v2/*` 확인 | 예시 도면 기반 수량·견적·공정표·비교·셀프 계산 API 존재. 이미지 OCR은 없음 |
| 상담·빠른 예산·검색 개편 [PR #130](https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/pull/130) | `MERGED`. `ask.py` `chat_v3`, 공종별 지시문, `knowledge`의 BM25+pgvector, 빠른 예산 API와 화면 확인 | 구현 코드 존재. 실모델 시연 결과는 별도 검증 |
| AI 관문·의도 분류 [PR #81](https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/pull/81), [#87](https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/pull/87) | 모두 `MERGED`. `agent/intent.py` 분류 모델·`agent/gate.py` Jev 경로 확인 | 분류와 상담 라우팅은 있으나 독립 공종 에이전트는 실패 반환 뼈대 |
| 대화 저장과 동시성 [PR #105](https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/pull/105), [#114](https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/pull/114), [#121](https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/pull/121), [#122](https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/pull/122), [#129](https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/pull/129) | 모두 `MERGED`. `v2/ask_chat.py`·`chat/service.py`·`v2/ask.py`에서 rev·waiting·중복 resume·범위 밖 미저장 확인 | 서버의 턴 기록은 존재. 새로고침 복원 화면은 열린 이슈 #127에 남음 |
| 자료 스키마·적재 [PR #64](https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/pull/64), [#74](https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/pull/74), [#106](https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/pull/106) | 모두 `MERGED`. `refprice/models.py`, `knowledge/models.py`, `data_ingest.py`, 활성 지식만 검색하는 repository 확인 | 정형 4종은 의도적으로 비활성. RAG는 활성화된 지식 버전이 필요 |
| 검색 지식·시공일지 평가 [PR #135](https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/pull/135), [#136](https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/pull/136), [#138](https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/pull/138) | 모두 `MERGED`. 9열 지식 CSV 변환, 평가 질문·지표, 시공일지 전처리 도구·규칙 확인 | 도구 및 평가 자료 존재. 로컬 전용 시공일지 본문은 Git 공유 대상에서 제외 |
| 가이드북 [PR #141](https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/pull/141) | `MERGED` (2026-11-18). `data/processed/13_interior_guide_book_rag.csv` 59행과 `backend/tests/test_data_ingest.py` 변경. 관련 [이슈 #142](https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/issues/142)는 조회 당시 `OPEN` | CSV 수정이 코드에 반영된 상태와 이슈 상태를 구분 |
| v2 후속 수정 [PR #140](https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/pull/140) | GitHub 직접 조회 시 `OPEN`, 현재 head `f9f6e53b80875832846f60e8ec20e3a5b9cae614`, 변경 파일에 `chat_v4.md` 존재. 기준 dev의 `ask.py`는 `chat_v3` 사용 | PR 제안 내용을 현재 배포·현재 dev 구현으로 표시하지 않음 |
| AWS 및 개발 흐름 [PR #25](https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/pull/25), [#45](https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/pull/45), [#48](https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/pull/48) | 모두 `MERGED`. 스테이징 CloudFormation·배포 스크립트와 main 성공 CI 후 배포 조건 확인 | 배포 절차 구현. 이번 HEAD의 실제 AWS 운영 동작 검증 아님 |

상기 핵심 PR #39, #100, #130, #140, #141에 대해서는 2026-11-18 GitHub에서 **상태·병합일·최신 head·변경 파일 목록**을 별도로 조회했다. PR #140의 head는 과거 자료에 기록된 `333fb37`보다 갱신된 값이다. 과거 head에 대한 QA·재현 결과를 현재 `f9f6e53` head의 검증 결과로 옮기지 않았다. 최신 head는 기준 dev에 미병합이므로 기능표는 `진행 / 미검증`으로 유지한다.

## 코드에서 분리 판정한 제한 사항

| 항목 | 코드에서 확인한 사실 | 문서 판정 |
| --- | --- | --- |
| 인증 미완 | `frontend/app/login/page.tsx`의 카카오 로그인, `reset-password/page.tsx`의 메일·토큰, `signup/phone/page.tsx`의 가입 미완 시나리오는 준비 중 안내 | 실제 소셜 인증·메일 재설정·문자 인증은 미구현 |
| 관리자 회원 | `frontend/lib/api/admin.ts`의 `listMembers()`가 `lib/mock/data`의 고정 `MEMBERS`를 반환. 업체 심사는 별도 실제 API | 회원 목록 DB 연동은 부분, 업체 심사 API는 구현 |
| 대화 실시간 응답 | `backend/app/chat/router.py` 0바이트이고 `main.py`에서 미등록, `/v2/ask`는 JSON 응답 | SSE 채팅 스트리밍 미구현 |
| 공종 하위 에이전트 | `backend/app/agent/trade_agent.py`가 `AgentAnswer(failed=True)` 반환 | 독립 하위 공종 응답 생성 미구현 |
| 일정 MCP | `backend/app/mcp_server.py` 0바이트 | MCP 연결 미구현 |
| 백그라운드 작업 | `backend/app/worker.py` 함수는 `ping`과 시연용 `DEMO_AUTO`뿐, 일반 실서비스 jobs 없음 | 일반 운영 작업 자동화 미구현 |
| 도면 | 서버의 예시 평면도 수량 계산은 존재. 실제 업로드 이미지의 OCR·도형 인식 경로 없음 | 도면 선택·수량과 도면 AI 판독 구분 |
| 자료 활성화 | 정형 4종은 `data_ingest.py`에서 비활성 유지. RAG 활성 버전 조회 경로 존재 | DB에 실제 어떤 버전이 활성인지 AWS 미조회 |
| AI 후속 | [#123](https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/issues/123), [#124](https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/issues/124), [#126](https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/issues/126), [#127](https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/issues/127), [#139](https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/issues/139)가 조회 당시 열림 | 열린 이슈는 검토·후속 과제로 기록. 완료로 간주하지 않음 |

## 이번 문서 작업에서 직접 한 확인

- `git rev-parse HEAD`, `git log --oneline`, 실제 파일 열람, `rg` 파일·라우터 검색, 공개 GitHub의 CI·Security 조회를 실행했다.
- PR/이슈 로컬 덤프의 항목 수와 상태를 읽고 표의 **이슈 링크 33개, PR 링크 32개**가 실제 항목을 가리키는지 검사했다.
- 기능표 **187개 ID**의 중복 없음, 표 열 수 일치, 코드·테스트 링크 **446개(고유 파일 경로 192개) 존재**를 코드로 검사했다. 내용 확인 없이 파일명만으로 단정하지 않도록 핵심 경로를 직접 열었다.
- 원격 PR #39·#100·#130·#140·#141의 병합 상태와 변경 파일 목록을 별도 조회했다. 미병합 PR #140은 기능 완료로 합산하지 않았다.
- 새 데이터 전처리·적재 명령은 실행하지 않았다. 유료 AI API 호출, 새로운 PostgreSQL·Redis 실행, 현재 AWS 접속, 브라우저 시연, 메일·SMS 발송은 하지 않았다.
- 기준 HEAD의 백엔드 로컬 전체 자동 테스트 **653개 통과**와 평가 코드 unittest **17개 통과**를 위 실행 환경·근거와 함께 기록했다. 평가 코드 테스트 결과를 실제 의도 분류 품질·유료 모델 상담 QA로 확대하지 않았다.
- 당시 `main.ROUTERS`·`app.openapi()`와 라우터 의존성 목록을 대조하여 **86개 경로·97개 HTTP operation**의 메서드·경로·함수·권한 대응을 확인했다. FastAPI `TestClient`의 합성 계약 검사 **16건**(공개·익명 11건, 가짜 신원·역할 5건)은 예상 결과와 일치했다. 이는 실제 로그인·DB 쓰기·브라우저 종합 QA가 아니다.
- 문서 작업 중 저장소 검사용 unittest **13개**와 `check_repo.py` 검사 통과를 확인했다. 상대 링크 검사는 당시 문서 구성에서 실행했으며 문서 통합·삭제 뒤 새로 검사해야 한다.

## 남은 확인 항목

문서 수정 완료 뒤에는 실제 수정 파일·상대 링크·Markdown 참조·줄 끝 공백을 다시 확인한다. **이번 문서 변경 자체에 대한 GitHub CI는 아직 없다.** AWS 실제 배포·실모델 응답·브라우저 업무 흐름 QA는 별도 근거가 생겼을 때만 이 기록과 기능표의 상태를 갱신한다. 이번 결과는 지정된 로컬 문서 파일에만 반영됐다.
