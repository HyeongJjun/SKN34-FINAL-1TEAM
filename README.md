# SKN34-FINAL-1TEAM

SK Networks Family AICAMP 34기 1팀 최종 프로젝트 **믿집**: 반셀프 인테리어 표준견적과 업체 가견적을 비교하는 서비스입니다.

- 웹 `frontend/`: Next.js · TypeScript
- API `backend/`: FastAPI · PostgreSQL · Redis · arq worker

## 실행

```bash
cp .env.example .env   # SEED_PASSWORD에 시험 계정 비밀번호(8자 이상)를 넣는다
docker compose up -d --build
```

- 웹 http://localhost:3000 · API 문서 http://localhost:8000/docs
- `port is already allocated` 오류가 나면 그 포트를 이미 다른 프로그램이 쓰는 거예요. `.env`의 `*_HOST_PORT`를 바꾸고 다시 실행합니다.
- 시험 계정(로컬 전용, 자동 생성): `admin@` · `customer@` · `vendor@` · `vendor-pending@mitjip.local`, 비밀번호는 `.env`의 `SEED_PASSWORD`. 다시 만들 때 `docker compose exec api python -m app.seed`
- 실제 관리자 계정: `docker compose exec api python -m app.auth.cli create-admin --email <메일> --name 관리자`

## 개발

1. 작업 이슈를 만들고, 개인 fork의 최신 `dev`에서 작업 브랜치를 만듭니다.
2. 이슈를 연결한 PR을 팀 `dev`로 올리고 CI와 리뷰를 통과하면 squash 병합합니다.
3. 로컬·CI에서 통합 검증 후 공식 저장소 `dev` → `main` PR을 만들고 merge commit으로 병합합니다.
4. `main`의 Push CI가 성공하면 해당 main 커밋을 AWS에 자동배포하고 서버 상태를 확인합니다.

`dev` 병합만으로 AWS에 배포되지는 않습니다. 기본 브랜치 목표는 `dev`이며, 실제 설정과 기존 CD를 바꾸는 순서는 [개발 흐름 전환 절차](docs/development-flow.md)에 있습니다. 별도 운영 환경(`prod`)은 아직 없습니다.

작업 규칙은 [AGENTS.md](AGENTS.md), 팀 작업 방법은 [CONTRIBUTING.md](CONTRIBUTING.md)에 있습니다.
