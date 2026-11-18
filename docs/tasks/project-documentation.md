# docs: 프로젝트 문서와 기능 개발표 정리

관련 이슈: [#143](https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/issues/143) (기존 이슈, 변경하지 않음)\
관련 PR: 없음 (이 문서 작업에서 생성·수정하지 않음)\
기준 코드: `dev` 커밋 `1a3e65661924e93225914ebb4b440bbd8330cc2a` (2026-11-18)\
작업 브랜치: 로컬 `docs-reference-data-current` (개인 fork `dfs32dfs/SKN34-FINAL-1TEAM`)

## 목적과 범위

초기 설계와 실제 코드가 섞인 문서를 정리해 팀원이 현재 구현, 계획, 평가 근거를 같은 기준으로 확인할 수 있게 한다. [문서 목차](../README.md)를 입구로 두고 [기능 개발표](../feature-roadmap.md)에서 개별 기능의 코드·테스트·이슈·PR을 찾도록 연결한다.

이번 문서 정리의 허용 범위는 **지정 로컬 브랜치에서 문서를 읽고 편집하고 로컬 검증하는 것**뿐이다. GitHub는 읽기 전용이다. 기존 이슈 #143과 모든 원격 이슈·PR·담당자·라벨·설정은 변경하지 않는다. 이슈 생성·수정·종료, PR 생성·수정·리뷰·댓글·병합, 커밋·푸시·원격 브랜치 생성·삭제는 허용되지 않는다. 저장소 일반 개발 절차를 적은 [개발 흐름](../development-flow.md)은 이번 작업에 원격 쓰기 권한을 부여하지 않는다.

제품 API·화면·CSS·DB migration·데이터 CSV·GitHub Actions workflow는 이 문서 작업의 변경 범위에 포함하지 않는다. 공유 금지 원본이나 실제 `.env` 내용은 사용하지 않는다.

## 이번 문서 구조와 기준

| 문서 | 맡는 내용 |
| --- | --- |
| [프로젝트 README](../../README.md) | 서비스 개요·현행 지원 범위·빠른 실행·문서 입구. 팀 소개·시장 조사 출처·사업화 시안은 유지하고 현재 동작과 구분 |
| [문서 목차](../README.md) | 현행 정본·평가·작업 기록·과거 설계의 링크 |
| [기능 개발표](../feature-roadmap.md) | 187개 세부 기능별 개발·검증 판정, 실제 코드·이슈·PR 연결. 별도 작성 담당 문서 |
| [검증 근거](../verification/2026-11-18-documentation.md) | 기준 커밋·CI·코드와 주요 PR 대조, 검증하지 않은 항목. 별도 작성 담당 문서 |
| [개발 규칙](../../AGENTS.md) · [팀 개발 안내](../../CONTRIBUTING.md) | 팀의 목표 규칙과 현재 구현 차이, fork·dev·main 역할 |
| [개발 환경](../development.md) · [테스트 안내](../testing.md) | Compose·PC 실행, 테스트 DB 안전 범위, 자동 검사와 실제 모델/브라우저/AWS QA 구분 |
| [API 문서 입구](../api/README.md) · [공통 계약](../api/common.md) · [97개 경로 표](../api/endpoints.md) · [업무 호출 흐름](../api/workflows.md) | 등록 FastAPI 사용 방법, 쿠키 인증, 실제 오류·권한, 호출 순서. 입력·응답 세부 필드는 생성 OpenAPI를 정본으로 사용 |
| [개발·통합·배포 흐름](../development-flow.md) | 일반 이슈·브랜치·PR·CI·dev 통합·main 승격·배포 절차 |
| [v2 구조](../v2/structure.md) · [ERD](../v2/erd.md) | 현재 패키지·라우트·v2 상담·기준 자료 테이블·상태 전이 |
| [AI 상담 협약](../agent-contract.md) | 현재 `chat_v3` 상담·출력 검사·rev·대화 저장과 이후 단일 공종 에이전트 설계 |
| [기준 데이터 안내](../reference-data.md) | 공유 13 CSV·로컬 전용 시공일지, 여섯 DB 표·수동 적재·검증·활성화 |
| [작업 문서 안내](README.md) · [작업 양식](../templates/task.md) · [이슈 템플릿](../../.github/ISSUE_TEMPLATE/task.md) · [PR 템플릿](../../.github/pull_request_template.md) | 작업의 목적·범위·호출 흐름·완료 조건·실행 검증·관련 문서 작성 |
| [초기 v2 기능 계획](../v2/features.md) · [dev/main 전환 당시 문서](../archive/2026-11-dev-main-transition.md) | 원문을 보존하면서 과거 계획·일회성 전환 절차라고 표시 |

## 코드와 문서를 대조한 결정

- 기존 회원·업체·실측·견적·공정표 API/화면은 실제 코드 경로가 있다. `/v2` 화면은 `SHOWN_CATS = ["wallpaper"]`로 도배만 노출한다. 목공 계산 코드가 있다는 이유로 v2 화면 전체가 목공까지 열린 것으로 쓰지 않는다.
- `/v2/ask`는 JSON 한 턴 요청, `/v2/ask/{turn}`은 화면 도구 결과 재개다. `v2/ask_chat.py`와 `chat/`은 성공한 일반 상담의 `rev` 기반 저장을 처리한다. 범위 밖 안내는 #128·PR #129 이후 저장하지 않는다. `chat/router.py`는 빈 파일이며 SSE는 없다.
- 공정별 힌트와 설정은 있지만 `trade_agent.py`의 독립 하위 호출은 미구현이다. 팀이 정한 목표는 **공종 에이전트 하나가 도배·목공 설정을 고르는 방식**이다. `mcp_server.py`는 빈 파일, worker는 `ping`과 `DEMO_AUTO` 시연 답변만 수행한다. 일반 자동 단가 수집·LLM 설명·알림 발송과 일정 MCP는 후속이다.
- `0019`~`0023` migration은 기준 자료 6개 표, `v2_cases`, `chats`, `chat_messages`를 포함한다. `0023` 이후 기준 자료 `status`는 BOOLEAN이며 `ref_dataset_events`는 삭제됐다. `v2_cases`와 `chats` 사이에는 FK가 없다.
- `data/processed/` 공유 자료 13 CSV(55,652행)는 RAG 9개·716행, 정형 4개·54,936행이다. 원본 PDF·엑셀과 시공일지 본문 CSV·이미지·JSON은 공개 저장소에 포함하지 않는다. 정형 4종은 현재 비활성 유지 규칙을 따른다.
- 이슈 종료는 기능 완성, PR 병합은 AWS 배포를 의미하지 않는다. 기준 dev CI 성공은 실제 모델·브라우저·AWS까지 검증했다는 뜻이 아니다.
- API 문서는 `main.ROUTERS`와 `app.openapi()`에서 확인한 **86개 경로·97개 HTTP operation**만 대상으로 작성했다. 쿠키 기반 세션·서비스 내부 역할·요청 제한·실측 견적 버전·날짜 버전 및 v2 Redis 재개를 실제 코드로 확인했다. Swagger 기본 422 응답 스키마와 런타임의 `error` 응답 형식이 다른 점, Origin 헤더를 가진 쓰기 요청의 403과 CORS 사전 요청 제한도 별도 기록했다. 미등록 chat/SSE·MCP API는 추가하지 않았다.

코드와 근거의 상세 위치는 [2026-11-18 검증 기록](../verification/2026-11-18-documentation.md)과 [기능 개발표](../feature-roadmap.md)에 정리한다. 이 작업 기록에 같은 근거 표를 다시 복제하지 않는다.

## 검증 결과

| 범위·환경 | 확인 또는 실행 | 결과와 범위 |
| --- | --- | --- |
| 기준 `dev`, SHA `1a3e656` | [CI run #44270185547](https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/actions/runs/44270185547), [Security #44270185469](https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM/actions/runs/44270185469) | 두 workflow 모두 success (기존 기준 코드). 이번 문서 수정의 CI 결과는 아님 |
| 로컬, 문서 작업 브랜치 | `python .github/scripts/check_repo.py` | 저장소 검사 통과 |
| 로컬, 문서 작업 브랜치 | `python -m unittest discover -s .github/scripts/tests -v` | 개발 흐름·비공개 CSV 경계 테스트 13개 통과 |
| 로컬, 문서 작업 브랜치 | `git -c core.whitespace=cr-at-eol diff --check` | 공백·충돌 표시 검사 통과. CRLF 원문 보존 목적 |
| 로컬 평가 코드 단위 검사 | `python -m unittest discover -s evaluation/tests -v` | 17개 통과. 실제 모델 평가 통과를 뜻하지 않음 |
| 로컬 backend 전체 pytest | 동일 기준 코드의 `uv run pytest -q` 실행 로그 확인 | **653개 통과, 772.94초**. 문서 변경만으로 시험 DB를 다시 만들지 않음 |
| 등록 API 목록 대조 | OpenAPI·라우터 의존성 목록과 [API 엔드포인트 표](../api/endpoints.md)의 메서드·경로·함수·권한 비교 | **86개 경로·97개 operation**, 목록 97행, 누락·추가·중복 없음 |
| 공통 API 계약 확인 | FastAPI `TestClient` 합성 요청·역할 검사 결과 기록 | **16개 예상 결과 일치**(익명·공개 요청 11개, 합성 사용자 역할 5개). 실제 로그인·DB 쓰기·브라우저·실모델 QA는 아님 |
| 로컬 Markdown 링크 | README·AGENTS·CONTRIBUTING·docs·템플릿 상대 링크 경로 검사 | 상대 링크 **722개**, 경로 누락 **0개** |

자동화된 검사와 사람이 화면을 조작한 QA는 별개다. 이 문서 자체에는 변경된 문서 브랜치의 새로운 CI가 아직 없다. 실제 AWS 실행 SHA, 운영 기준 자료 활성화, 유료 모델 응답, 브라우저 전체 업무 흐름 QA는 이번 작업에서 확인하지 않았다.

## 남은 확인

API 문서 포함 전체 상대 링크, 등록 메서드·경로 97개 대조, 내용 간 모순, 저장소 검사, Git diff를 확인한다. 후속 구현 변경이 생기면 생성 OpenAPI와 API 안내·기능 개발표를 함께 검토한다. 실제 이슈·PR·배포 상태 변경은 이 작업의 허용 범위에 포함되지 않는다.
