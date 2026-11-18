# 믿집 문서

[프로젝트 소개](../README.md) · [기능 개발표](feature-roadmap.md) · [팀 기여 가이드](../CONTRIBUTING.md)

실제 구현 범위는 기능 개발표에서 확인합니다. 기능 담당자·진행 상태의 정본은 GitHub 이슈이며, 문서에서는 중복 관리하지 않습니다.

## 핵심 문서

| 문서 | 내용 |
| --- | --- |
| [기능 개발표](feature-roadmap.md) | 187개 기능의 개발·검증 상태와 코드·이슈·PR 근거 |
| [API 안내](api/README.md) | Swagger·인증·오류·97개 엔드포인트·업무 호출 순서 |
| [개발 환경](development.md) | Docker Compose, PC 직접 실행, 로컬 설정 |
| [테스트와 QA](testing.md) | 자동 테스트·화면 검증·실제 모델 평가 구분 |
| [기여 가이드](../CONTRIBUTING.md) | fork·이슈·PR·dev/main 통합·배포 |
| [작업 규칙](../AGENTS.md) | 코드 계층, 구현·검증·에이전트 규칙 |
| [프로젝트 구조](v2/structure.md) · [ERD](v2/erd.md) | 패키지·화면/API 연결과 DB 관계 |
| [AI 상담 협약](agent-contract.md) | 현재 대화 흐름과 공종 설정·후속 설계 |
| [기준 데이터](reference-data.md) | 공유 CSV 현황, 적재·활성화·원본 관리 |

## 평가·검증·과거 기록

| 문서 | 내용 |
| --- | --- |
| [코드·PR·CI 근거](verification/2026-11-18-documentation.md) | 당시 코드 기준 검증 기록 |
| [RAG 평가](../evaluation/rag/README.md) · [답변 평가](../evaluation/answer/README.md) · [공정 평가](../evaluation/trade/README.md) | 질문 세트, 방법과 당시 측정 |
| [시공일지 처리 규칙](../data/sigong_ilji/SPEC.md) · [읽기 안내](../data/sigong_ilji/READER.md) | 로컬 전용 자료의 처리·공유 경계 |
| [초기 v2 구현 계획](v2/features.md) · [과거 dev/main 전환](archive/2026-11-dev-main-transition.md) | 과거 계획·일회성 절차(현행 절차 아님) |

과거 평가값과 당시 스키마 설명을 새로운 코드의 완료·품질 근거로 옮기지 않습니다.

## 문서 갱신 규칙

- README는 짧은 소개·실행 입구, 기능표는 상태·근거, API는 호출 계약, 설계 문서는 구조·상태 전이를 맡습니다.
- 구현은 코드와 테스트로, 통합은 CI로, 배포는 서버 상태로 각각 확인합니다. 문서·계획만으로 완료 처리하지 않습니다.
- 이슈에 목적·호출 흐름·검증 결과를 적고 PR에서 영향을 받은 문서를 연결합니다. 빈 문서를 작업마다 만들 필요는 없습니다.

| 변경 대상 | 함께 확인할 정본 |
| --- | --- |
| API·권한·오류 | [API 안내](api/README.md), 자동 OpenAPI, `frontend/`의 `pnpm gen:api` 생성물 `schema.d.ts` |
| DB·마이그레이션 | [ERD](v2/erd.md), [기준 데이터](reference-data.md) |
| 프롬프트·모델 | [AI 협약](agent-contract.md), [테스트·평가](testing.md) |
| CSV·검색 자료 | [기준 데이터](reference-data.md), [RAG 평가](../evaluation/rag/README.md) |
| 기능 상태·검증 | [기능 개발표](feature-roadmap.md), 관련 GitHub 이슈·PR 및 설계 문서 |
| 개발 환경·CI/CD | [개발 환경](development.md), [기여 가이드](../CONTRIBUTING.md), [테스트](testing.md) |
