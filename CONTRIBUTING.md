# 팀 개발 가이드

## 브랜치와 Pull Request

- `main`은 CI · 리뷰를 거친 기능을 통합하는 기준 브랜치이고, `dev`는 AWS 개발 서버에 배포할 버전을 관리하는 브랜치입니다.
- 개인 fork의 최신 `main`에서 기능 브랜치를 만들고 팀 `main`으로 PR을 올립니다. 기능 PR은 squash 병합합니다.
- 로컬에 `main`이 없으면 `git fetch upstream` 뒤 `git switch --create main --track upstream/main`으로 만듭니다. 이미 있으면 `git switch main && git merge --ff-only upstream/main`으로 최신화합니다. GitHub 기능 PR의 대상 브랜치는 `main`으로 선택합니다.
- 브랜치 이름: `작업유형-기능이름` (영어 소문자, 하이픈). 예: `feat-login`, `fix-api-error`, `docs-architecture`, `chore-initial-setup`.
- Pull Request에는 변경 목적, 주요 내용, 직접 확인한 테스트를 기록합니다.
- CI가 성공하고 팀원 한 명 이상이 승인한 뒤 병합합니다.
- 배포할 때 `main`의 CI 성공을 확인하고 팀 저장소 안에서 `main` → `dev` PR을 만듭니다. GitHub에서 base는 `dev`, compare는 `main`으로 선택하고, CI · 리뷰 통과 후 merge commit으로 병합합니다. 장기 브랜치의 공통 이력을 보존하려고 이 PR은 squash하지 않습니다.
- `dev`에서는 기능 개발이나 직접 수정을 하지 않습니다. 개발 서버에서 발견한 문제와 긴급 수정도 `main` 대상 PR로 처리한 뒤 `main` → `dev`로 반영합니다. `dev` → `main` 승격 단계는 없습니다.
- 프로젝트별 실행 방법과 테스트 명령이 생기면 README와 CI를 함께 갱신합니다.

## 개발 서버 배포

- `main`과 `dev` 모두 CI와 보안 검사를 실행합니다. `main` 병합만으로 `dev`가 자동 동기화되거나 AWS에 배포되지는 않습니다. 배포 시점은 `main` → `dev` PR 병합으로 정합니다.
- 공식 `dev`의 Push CI가 성공하면 기존 AWS 개발 서버(스테이징)에 자동배포됩니다. 배포 후 서버에서 통합 테스트하고, 문제가 있으면 `main`에서 수정해 다시 배포합니다.
- 기존 AWS 스테이징 서버와 DB를 개발 통합 환경으로 사용합니다. 별도 운영 환경(`prod`) 배포는 아직 없습니다.
- 배포 워크플로는 기본 브랜치 `main`에 둡니다. `workflow_run`의 실행 브랜치는 `main`이고, 배포 소스는 CI가 검사한 `dev` 커밋입니다. AWS OIDC의 `main` 신뢰 조건은 유지합니다.
- Actions의 `Deploy staging`을 수동 실행할 때는 브랜치를 `main`으로 선택합니다. 일반 재배포는 최신 `dev`의 CI 성공을 확인하고, rollback을 선택하면 이전 이미지로 복구합니다. DB 마이그레이션은 되돌리지 않습니다.

## 설정 및 비밀정보

- 로컬 API 키, 비밀번호, 접속 정보는 Git에 커밋하지 않습니다.
- 환경변수 예시는 값이 비어 있거나 가짜 값인 `.env.example`에 작성합니다.
- 실제 배포용 값은 배포 환경 확정 후 GitHub Environments의 Secrets/Variables에 보관합니다.
- 대용량 모델 가중치와 데이터셋은 Git 저장소 대신 별도 스토리지 또는 적절한 아티팩트 저장소를 사용합니다.
