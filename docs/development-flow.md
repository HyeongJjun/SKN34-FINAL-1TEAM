# 개발·통합·배포 흐름

[문서 목록](README.md) · [개발 환경](development.md) · [테스트와 QA](testing.md) · [과거 dev·main 전환 절차](archive/2026-11-dev-main-transition.md)

현재 GitHub 기본 브랜치는 `dev`다(2026-11-18 확인). 팀 저장소는 `SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM`이고, 개인 fork를 `origin`, 팀 저장소를 `upstream`으로 사용한다. `dev`는 기능 통합·검증, `main`은 검증한 배포 버전이다. 실제 보호 규칙과 승인 요건은 GitHub 설정에서 별도로 확인한다.

## 일상 개발 순서

1. **작업 이슈**: 목적·범위·완료 조건·검증 방법을 적고 관련 [기능 ID](feature-roadmap.md)와 문서를 연결한다. 담당자 지정·진행 상태 변경은 GitHub 이슈에서 한다([이슈 양식](../.github/ISSUE_TEMPLATE/task.md)).
2. **개인 fork**: `upstream/dev`를 가져와 개인 `dev`를 최신화하고 `type-기능이름` 형식의 작업 브랜치를 만든다.
3. **구현·검증**: 바뀐 범위의 테스트를 실행하고 실제 결과를 이슈에 남긴다. 화면·API·DB 계약을 바꾸면 해당 기준 문서와 기능 개발표도 갱신한다.
4. **기능 PR**: 작업 브랜치 → 팀 `dev`로 PR을 연다. 관련 이슈를 연결하고 변경 파일·문서를 적는다. 작성자가 최신 `dev`로 rebase하고 CI 통과·팀원 리뷰 후 **squash 병합**한다.
5. **통합 검증**: 공식 `dev`에 병합된 코드로 다시 확인한다. 이슈 종료·PR 병합은 AWS 배포나 실제 화면 QA의 증거가 아니다.
6. **승격 PR**: 공식 저장소 `dev` → `main`으로 PR을 올린다. 포함 작업 PR·CI·배포 영향과 남은 확인을 적고 리뷰 후 **merge commit**으로 병합한다.
7. **main 검증과 배포**: 공식 `main` push에 대한 CI의 필수 작업이 모두 성공해야 [Deploy staging](../.github/workflows/deploy-staging.yml)을 호출한다. 배포한 커밋 SHA와 서버 상태를 확인한 뒤에만 배포 성공으로 기록한다.

아래는 저장소 루트에서 실행하는 **기존 `dev` 브랜치 최신화 예시**다. 로컬 수정이 있을 때는 먼저 충돌 가능성을 확인한다.

```bash
git fetch upstream
git switch dev
git merge --ff-only upstream/dev
git push origin dev
git switch <작업브랜치>
git rebase dev
git push --force-with-lease origin <작업브랜치>
```

개인 fork에 `dev` 브랜치가 없다면 `git switch --create dev --track upstream/dev`로 만든다. 협업 중인 다른 사람의 PR에는 동기화 merge 커밋을 임의로 넣지 않는다.

## CI와 배포 경계

| 이벤트 | 검사·처리 | 배포 여부 |
| --- | --- | --- |
| 기능 PR → `dev` | 저장소 검사·backend·frontend·컨테이너 검증, Security 별도 실행 | 배포하지 않음 |
| `dev` push | 동일한 CI와 보안 검사 | 배포하지 않음 |
| 공식 `dev` → `main` 승격 PR | main 대상은 공식 저장소 `dev`에서 온 PR만 허용(`development_flow.py`) | PR만으로 배포하지 않음 |
| 공식 `main` push | 필수 CI 성공 후 배포 workflow 호출, 배포 SHA 검사 | 성공한 main 커밋만 스테이징 배포 시도 |
| `Deploy staging` 수동 실행 | `main` 선택, 최신 main의 성공한 CI 기록 확인(일반 재배포) | 승인된 SHA 재배포 또는 이전 이미지 복구 |

이 표는 [CI](../.github/workflows/ci.yml), [경로·SHA 검사](../.github/scripts/development_flow.py), [배포 workflow](../.github/workflows/deploy-staging.yml)에 구현된 조건을 요약한다. 실제 GitHub 브랜치 보호 설정이나 AWS 실행 결과를 대신하지 않는다. AWS OIDC는 `main` 제한을 유지하고, 별도 `prod` 환경은 아직 없다.

CI·보호 정책에 대한 로컬 코드 검사는 `python -m unittest discover -s .github/scripts/tests -v`다. 이 검사가 실제 GitHub 설정·배포 서버를 검증하지는 않는다. 배포 문제는 새 작업 이슈와 `dev` 대상 수정 PR로 처리한다. 초기 브랜치 전환 때의 일회성 조치는 [과거 기록](archive/2026-11-dev-main-transition.md)에 보존했다.
