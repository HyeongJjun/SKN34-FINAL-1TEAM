# 보안 검증 기록

실제로 돌린 것만 적어요. 코드는 고치지 않았어요(조사 · 설계 단계). 원본 출력은 세션 임시 폴더에만 있어요.

- 날짜: 2026-11-18 · 쓴 역할: 보안 담당
- 대상: `C:\Workspace\SKN34\wt-v3` (브랜치 `feat-v3`, 팀 dev `1a3e656`, 고친 코드 없음)
- 프로젝트 가상환경(`backend/.venv`)은 건드리지 않으려고 `uvx`(따로 떨어진 도구 환경)로 돌렸어요. `uv run --with`와 같은 도구예요.

## 점검 도구

| 날짜 | 무엇 | 명령 · 방법 | 결과 | 남은 일 |
| --- | --- | --- | --- | --- |
| 2026-11-18 | 백엔드 정적 점검 (bandit 1.9.4) | `backend`에서 `uvx bandit -r app -f txt` | 코드 20,304줄 · High 0 · Medium 0 · **Low 3** (모두 B101 `assert` 사용: `auth/service.py:131`, `schedule/service.py:226 · 307`). 종료 코드 1(찾은 것이 있으면 1) | 3건 모두 앞에서 값이 정해진 뒤의 확인이라 실제 위험은 낮아요. `python -O`로 돌리지 않는 한 그대로 둬도 돼요. 고칠 때는 `if ... raise`로 바꿔요 |
| 2026-11-18 | 백엔드 의존성 취약점 (pip-audit 2.10.1, PyPI 자료) | `uv export --frozen --no-dev --format requirements-txt` → `uvx pip-audit --disable-pip -r req-prod.txt` | 운영 의존성 92개(해시 고정) · **알려진 취약점 0** | CI에 넣어요(아래 '제작 단계') |
| 2026-11-18 | 같은 것, OSV 자료로 한 번 더 | `uvx pip-audit --disable-pip -r req-prod.txt -s osv` | **알려진 취약점 0** | |
| 2026-11-18 | 프런트 의존성 취약점 (pnpm 11.22.0) | `frontend`에서 `pnpm audit --prod` · `pnpm audit` · `pnpm audit --prod --json` | 운영 의존성 62개(일반 19 · 선택 설치 43, pnpm 집계) · info/low/moderate/high/critical **모두 0**. 개발 의존성까지 넣어도 0 | |
| 2026-11-18 | 백엔드 규칙 점검 (semgrep 1.186.0) | `uvx semgrep scan --metrics=off --config p/python --config p/security-audit --config p/secrets --config p/owasp-top-ten --exclude tests backend/app` | git이 추적하는 147파일 · 규칙 243개 실행 · **찾은 것 0** | |
| 2026-11-18 | 프런트 규칙 점검 (semgrep 1.186.0) | `uvx semgrep scan --metrics=off --config p/typescript --config p/react --config p/nextjs --config p/security-audit --config p/secrets frontend/app frontend/components frontend/lib` | 292파일 · 규칙 125개 실행 · **찾은 것 0** | |
| 2026-11-18 | 눈으로 본 위험 API | `dangerouslySetInnerHTML` · `localStorage` · `eval` · SQL 글 이어 붙이기를 grep | `dangerouslySetInnerHTML` 2곳(`components/v2/Board.tsx`, `intake/PlanStep.tsx`)은 코드에 박힌 평면도 SVG라 사용자 글이 아니에요. `localStorage`는 작성 중 폼(지역 · 평수 · 공종)만 둬요. SQL을 글로 잇는 곳은 없어요 | v3에서 AI 답 · 채팅 글에는 `dangerouslySetInnerHTML`을 쓰지 않아요(LM-07) |
| 2026-11-18 | 잠금 파일 버전 확인 | `req-prod.txt` · `package.json` · `pnpm-lock.yaml` | starlette 1.10.0(CVE-2025-62727 고친 0.49.1보다 새것), next 16.4.5 · react 19.3.1(CVE-2025-55182 고친 16.0.7 · 19.2.1보다 새것) | |

## 못 한 것

| 무엇 | 이유 | 다음 |
| --- | --- | --- |
| 기존 보안 테스트(`tests/test_files.py` · `test_guards.py` · `test_auth.py` · `test_account.py`) 돌리기 | `wt-v3`에 `.env`가 없어 테스트 DB 접속 정보가 없어요. 규칙상 다른 체크아웃의 `.env`를 읽지 않아요 | 리드가 `TEST_DB_NAME=mitjip_test_security` · `TEST_REDIS_URL=redis://127.0.0.1:6379/12` · `LLM_LIVE=false`로 환경을 주면 돌려요 |
| 실제 서버(스테이징) 헤더 · TLS 점검 | 이번 단계는 코드 · 설정 읽기만 했어요. 밖으로 요청을 보내지 않았어요 | 제작 단계에서 `curl -I`로 응답 헤더를 봐요(T18) |
| AWS 계정 쪽 설정(CloudTrail · GuardDuty 등) | 계정에 접속하지 않았어요. `infra/aws/staging.yaml`만 읽었어요 | 팀이 계정 설정을 확인해요 |

## 설정 · 코드에서 찾은 것 (자세히는 `../security.md` 4장)

| 번호 | 무엇 | 근거(파일) | 정도 |
| --- | --- | --- | --- |
| F1 | S3 버전 관리가 켜져 있고 이전 버전을 지우는 규칙이 없어요. 앱은 버전 번호 없이 지워서 탈퇴 · 파일 빼기 뒤에도 이전 버전이 남아요 | `infra/aws/staging.yaml` FileBucket(VersioningConfiguration Enabled, 수명 주기 규칙 없음) · `files/storage.py` `remove()` | 높음(개인정보 보호법 제21조②) |
| F2 | 웹 화면에 CSP · HSTS · frame-ancestors가 없어요 | `deploy/aws/Caddyfile`(nosniff · Referrer-Policy만) · `frontend/next.config.ts`(headers 없음) | 중간 |
| F3 | Origin이 없는 요청은 검사 없이 지나가고, Sec-Fetch-Site를 보지 않아요. GET인 WebSocket 연결은 검사 대상이 아니에요 | `main.py` `check_origin` | 중간(v3 실시간에서 높아짐) |
| F4 | 비활동 만료 · 비밀번호 바꾸기 · 다른 세션 끊기가 없어요. 휴대폰 번호를 비밀번호 확인 없이 바꿔요 | `auth/service.py` · `auth/router.py` `PATCH /me` | 중간 |
| F5 | 관리자 2단계 인증이 없고, 관리자가 사업자등록증을 본 기록이 남지 않아요 | `auth/cli.py` · `files/service.py` `readable()` | 중간 |
| F6 | 업체 PDF · 엑셀을 고객이 열지만 PDF는 다시 쓰지 않고 악성코드 검사도 없어요(엑셀 매크로는 막아요) | `files/service.py` | 중간 |
| F7 | 요청 제한이 Redis 장애 때 통과해요(로그인 포함). Cloudflare를 앞에 두면 IP가 Cloudflare 주소로 묶여요 | `shared/ratelimit.py` · Caddyfile(trusted_proxies 없음) | 중간 |
| F8 | AI 사진(base64)은 서버가 EXIF를 지우지 않아요(화면 canvas가 지움). 하루 토큰 상한이 없어요 | `v2/ask.py` · `v2/schemas.py` · `components/v2/ai/llm.ts` | 중간(LLM 모드에서만) |
| F9 | 전화번호 가림 규칙이 두 곳에서 달라요. 계좌 · 이메일은 가리지 않아요 | `agent/intent.py` `PHONE` · `v2/guard.py` `PHONE` | 낮음 |
| F10 | 스테이징에서 `/api/docs` · `/api/openapi.json`이 열려 있어요 | `main.py` `_public_docs` | 낮음 |
| F11 | 흔한 비밀번호 검사가 없어요(8자 이상만) | `auth/schemas.py` | 중간(ASVS L1) |
| F12 | 거절된 업체의 사업자등록증에 보관 기한이 없어요 | `vendor/service.py` | 낮음 |
