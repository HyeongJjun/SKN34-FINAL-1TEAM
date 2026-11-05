# 팀 개발 가이드

## 브랜치와 Pull Request

- `dev`는 팀 개발 통합 브랜치이고, `main`은 통합 테스트를 마친 안정 버전입니다.
- 개인 fork의 `dev`에서 기능 브랜치를 만들고 팀 `dev`로 PR을 올립니다. 기능 PR은 squash 병합합니다.
- 처음에는 `git fetch upstream` 뒤 `git switch --create dev --track upstream/dev`로 로컬 `dev`를 만듭니다. GitHub PR 화면에서도 대상 브랜치를 `dev`로 선택합니다.
- 브랜치 이름: `작업유형-기능이름` (영어 소문자, 하이픈). 예: `feat-login`, `fix-api-error`, `docs-architecture`, `chore-initial-setup`.
- Pull Request에는 변경 목적, 주요 내용, 직접 확인한 테스트를 기록합니다.
- CI가 성공하고 팀원 한 명 이상이 승인한 뒤 병합합니다.
- 검증된 `dev`를 `main`으로 올리는 PR은 merge commit으로 병합합니다. 장기 브랜치의 공통 이력을 보존하려고 squash하지 않습니다.
- `main`에 긴급 수정이 들어오면 `main`을 `dev`로 다시 병합한 뒤 기능 개발을 이어갑니다.
- 프로젝트별 실행 방법과 테스트 명령이 생기면 README와 CI를 함께 갱신합니다.

## 개발 서버 배포

- `main`과 `dev` 모두 CI와 보안 검사를 실행합니다. 스테이징은 공식 `dev`의 Push CI가 성공했을 때만 자동배포합니다.
- 기존 AWS 스테이징 서버와 DB를 개발 통합 환경으로 사용합니다. `main`을 위한 별도 운영 배포는 아직 없습니다.
- 배포 워크플로는 기본 브랜치 `main`에 둡니다. `workflow_run`의 실행 브랜치는 `main`이고, 배포 소스는 CI가 검사한 `dev` 커밋입니다. AWS OIDC의 `main` 신뢰 조건은 유지합니다.
- Actions의 `Deploy staging`을 수동 실행할 때는 브랜치를 `main`으로 선택합니다. 일반 재배포는 최신 `dev`의 CI 성공을 확인하고, rollback을 선택하면 이전 이미지로 복구합니다. DB 마이그레이션은 되돌리지 않습니다.

## 설정 및 비밀정보

- 로컬 API 키, 비밀번호, 접속 정보는 Git에 커밋하지 않습니다.
- 환경변수 예시는 값이 비어 있거나 가짜 값인 `.env.example`에 작성합니다.
- 실제 배포용 값은 배포 환경 확정 후 GitHub Environments의 Secrets/Variables에 보관합니다.
- 대용량 모델 가중치와 데이터셋은 Git 저장소 대신 별도 스토리지 또는 적절한 아티팩트 저장소를 사용합니다.
