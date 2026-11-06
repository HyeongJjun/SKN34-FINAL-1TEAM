# 팀 개발 가이드

## 브랜치와 Pull Request

- `dev`는 기능 통합·검증 브랜치, `main`은 검증한 배포 버전입니다. 기본 브랜치 목표는 `dev`입니다.
- 작업 이슈를 만들고 개인 fork의 최신 `dev`에서 작업 브랜치를 만듭니다. 이슈를 연결한 기능 PR은 팀 `dev`로 보내고 squash 병합합니다.
- 로컬에 `dev`가 없으면 `git fetch upstream` 뒤 `git switch --create dev --track upstream/dev`로 만듭니다. 이미 있으면 `git switch dev && git merge --ff-only upstream/dev`로 최신화합니다.
- 브랜치 이름: `작업유형-기능이름` (영어 소문자, 하이픈). 예: `feat-login`, `fix-api-error`, `docs-architecture`, `chore-initial-setup`.
- Pull Request에는 변경 목적, 주요 내용, 직접 확인한 테스트를 기록합니다.
- CI가 성공하고 팀원 한 명 이상이 승인한 뒤 병합합니다.
- 로컬·CI 통합 검증 후 공식 저장소의 `dev` → `main` PR을 만듭니다(base: `main`, compare: `dev`). 포함 작업 PR·검증·배포 영향을 적고 CI · 리뷰 통과 후 merge commit으로 병합해 공통 이력을 보존합니다.
- main 대상 PR은 공식 저장소 dev에서 온 승격만 허용합니다. 서버 수정도 dev 대상 작업 PR부터 진행합니다.
- 타인의 PR에 관리 계정으로 동기화 merge 커밋을 넣지 않습니다. 작성자 본인이 자기 작업 브랜치를 rebase하고, 병합 전 작성자·공동 작성자 표시를 확인합니다.
- 프로젝트별 실행 방법과 테스트 명령이 생기면 README와 CI를 함께 갱신합니다.

## 개발 서버 배포

- `main`과 `dev` 모두 CI와 보안 검사를 실행합니다. dev 병합은 배포하지 않으며, main Push CI의 필수 검사 성공 뒤 재사용 배포 workflow를 호출합니다.
- 해당 main 커밋을 기존 AWS 서버에 배포하고 웹·API 상태를 확인합니다. 배포 중인 main CI는 새 push로 취소하지 않으며, 배포 시작 전에 더 최신 main이 있으면 오래된 실행은 건너뜁니다.
- 기존 AWS 스테이징 서버와 DB를 개발 통합 환경으로 사용합니다. 별도 운영 환경(`prod`) 배포는 아직 없습니다.
- 기본 브랜치가 dev여도 배포는 main Push CI에서 호출되므로 AWS OIDC의 main 제한을 유지합니다. 설정 전환은 [전환 절차](docs/development-flow.md)를 따릅니다.
- Actions의 `Deploy staging` 수동 실행은 main을 선택합니다. 일반 재배포는 최신 main의 CI 성공을 확인합니다. 최초 배포가 실패해 CI 전체가 실패한 경우에는 그 CI의 실패한 작업을 재실행하거나, main에서 CI를 수동 실행해 성공한 뒤 재배포합니다. rollback은 CI 성공 여부와 무관하게 이전 이미지를 복원하며 DB migration은 되돌리지 않습니다.

## 설정 및 비밀정보

- 로컬 API 키, 비밀번호, 접속 정보는 Git에 커밋하지 않습니다.
- 환경변수 예시는 값이 비어 있거나 가짜 값인 `.env.example`에 작성합니다.
- 실제 배포용 값은 배포 환경 확정 후 GitHub Environments의 Secrets/Variables에 보관합니다.
- 대용량 모델 가중치와 데이터셋은 Git 저장소 대신 별도 스토리지 또는 적절한 아티팩트 저장소를 사용합니다.
