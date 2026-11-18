# 믿집 문서 안내

[프로젝트 소개](../README.md) · [기능 개발표](feature-roadmap.md)

새로 작업할 때는 기능 개발표에서 구현 범위와 관련 이슈를 찾고, 해당 기능의 기준 문서를 읽는다. 담당자와 진행 상황은 GitHub 이슈에서 관리한다.

## 현재 기준 문서

| 문서 | 확인할 내용 |
| --- | --- |
| [기능 개발표](feature-roadmap.md) | 세부 기능별 코드, 개발 상태, 검증 범위, 이슈·PR |
| [작업 지침](../AGENTS.md) | 제품 용어, 코드의 호출 방향, 변경·검증 규칙 |
| [프로젝트 구조](v2/structure.md) | 현재 화면·API·계산·상담·저장소의 연결 |
| [API 사용 안내](api/README.md) | 로컬 Swagger·OpenAPI 접근, 현재 등록 API 97개, 실제 권한·오류·호출 순서 |
| [ERD](v2/erd.md) | 고객·업체 업무 테이블, 상담·데이터 테이블, 상태 전이 |
| [AI 상담 협약](agent-contract.md) | 상담 한 턴, 화면 도구, 대화 저장, 구현된 부분과 후속 설계 |
| [기준 데이터 안내](reference-data.md) | CSV 보관, DB 적재·활성화, 검색에서 사용하는 경로 |
| [개발 환경](development.md) | Compose·PC 실행, 포트, 환경변수, 로컬 계정 |
| [개발·배포 흐름](development-flow.md) | fork·작업 브랜치·이슈·dev PR·main 승격·AWS 배포 |
| [테스트와 QA](testing.md) | 자동 테스트, 화면 조작, 실제 모델 평가의 구분과 실행 방법 |
| [작업별 문서 안내](tasks/README.md) | 별도 문서가 필요한 작업과 이슈·PR 연결 방법 |

## 데이터 처리와 평가

| 문서 | 용도 |
| --- | --- |
| [시공일지 전처리 규칙](../data/sigong_ilji/SPEC.md) · [읽기 지시](../data/sigong_ilji/READER.md) | 공유 금지 원본의 로컬 처리 규칙. 본문 파일은 저장소에 넣지 않는다 |
| [검색 평가](../evaluation/rag/README.md) | 자료 구성과 검색 지표, 저장된 평가 결과 |
| [답변 평가](../evaluation/answer/README.md) | 실제 모델 응답 평가, 비용과 판정 한계 |
| [공정 분류·답변 평가](../evaluation/trade/README.md) | 도배·목공 구분과 공정별 질문 검사 |

의도 분류 실행 방법과 별도 테스트는 [테스트와 QA](testing.md)에 모았다. 평가 문서의 과거 수치는 그때의 자료·모델·커밋 결과이며 최신 서비스 품질을 대신하지 않는다.

## 작업과 검증 기록

| 문서 | 성격 |
| --- | --- |
| [문서 정리 작업](tasks/project-documentation.md) | 이번 문서 작업의 범위·근거·남은 확인 |
| [2026-11-18 코드·이슈·PR 대조](verification/2026-11-18-documentation.md) | 기능표 작성 기준 커밋과 실제 검증 결과 |
| [작업 문서 양식](templates/task.md) | 새 작업의 범위·설계·검증 기록 양식 |

## 과거 기록

| 문서 | 보존 이유 |
| --- | --- |
| [초기 v2 구현 계획](v2/features.md) | 당시 시안과 기능별 구현 순서. 현재 완료표는 기능 개발표를 사용한다 |
| [dev·main 전환 당시 절차](archive/2026-11-dev-main-transition.md) | 이전 배포 흐름을 바꾸던 절차. 일상 개발에 다시 실행하지 않는다 |

## 문서 갱신 규칙

- README는 소개와 실행 입구, 기능 개발표는 개발 상태, 상세 문서는 해당 기능의 동작·설계를 맡는다. 같은 설명을 여러 파일에 복사하지 않는다.
- API의 필드·enum·필수 여부는 FastAPI가 생성한 OpenAPI를 정본으로 한다. [API 안내](api/README.md)는 실제 권한·오류·상태·업무 호출을 연결하며, 런타임 오류 형식은 자동 OpenAPI의 기본 오류 모양과 다를 수 있다.
- 팀이 정한 규칙과 구현이 다르면 차이를 기록한다. 버그에 맞춰 규칙을 바꾸거나 문서 작업 중 코드를 임의로 고치지 않는다.
- 현재 동작은 코드·연결된 화면·테스트로 확인하고, 개발 반영은 병합된 PR로 확인한다. 계획·열린 PR·빈 파일을 구현 완료로 표시하지 않는다.
- 기능 변경 PR은 관련 문서와 기능표를 함께 갱신한다. 문서 영향이 없으면 PR에 그 이유를 짧게 적는다.
- 구조·API·상태 전이의 결정은 상세 문서 한 곳에 남기고 이슈와 PR에서 링크한다. 담당자·진행 상태의 원본은 이슈다.
- 과거 검증 기록은 당시 기준을 유지한다. 현재 기준 문서로 연결하고 최신 결과로 덮어쓰지 않는다.

### 무엇을 바꾸면 어디를 함께 확인하나요?

| 변경 대상 | 함께 확인·갱신할 현재 문서·생성물 | 지킬 점 |
| --- | --- | --- |
| API 경로·입출력·권한·오류 | [API 안내](api/README.md) · [엔드포인트 목록](api/endpoints.md) · [공통 계약](api/common.md) · [호출 흐름](api/workflows.md) · [테스트](testing.md) | 필드 정본은 FastAPI 자동 `/openapi.json`. `frontend/lib/backend/schema.d.ts`는 생성물이므로 손으로 고치지 않고 API 코드 변경 시 `frontend/`에서 `pnpm gen:api`로 갱신한다 |
| DB 테이블·마이그레이션·데이터 저장 관계 | [ERD](v2/erd.md) · [v2 구조](v2/structure.md) · [기준 데이터 안내](reference-data.md) | 스키마는 코드·migration과 대조하고 실제 적용 여부는 환경별로 확인한다 |
| 프롬프트·모델·에이전트 역할 | [에이전트 협약](agent-contract.md) · [평가 안내](testing.md) · [답변 평가](../evaluation/answer/README.md) | 현재 버전과 후속 설계를 구분하며 모델·자료·기준이 다른 과거 평가값을 최신 결과처럼 바꾸지 않는다 |
| 공유 CSV·검색 자료 구성·집계 | [기준 데이터 안내](reference-data.md) · [프로젝트 소개·집계](../README.md) · [RAG 평가 입력](../evaluation/rag/README.md) | 공개 가능 여부와 실제 행 수·활성화 여부를 검증한 뒤 갱신한다. 로컬 전용 시공일지 본문은 공개 문서·저장소에 넣지 않는다 |
| 기능 구현·검증 상태 | [기능 개발표](feature-roadmap.md) · 관련 [설계 문서](v2/structure.md) · [검증 안내](testing.md) · [검증 근거](verification/2026-11-18-documentation.md) | 기능별 상태·근거와 **관련 GitHub 이슈·PR 링크**는 기능표 한 곳에서 관리하고, 담당자·진행 상황의 원본은 **GitHub 이슈**로 둔다. 다른 문서에 담당자·상태표를 복제하지 않는다 |
| 개발 환경·CI/CD·배포 흐름 | [개발 환경](development.md) · [개발·배포 흐름](development-flow.md) · [검증 안내](testing.md) · [기여 안내](../CONTRIBUTING.md) | 로컬 실행·CI 통과·AWS 배포 확인은 각각 별개다 |
