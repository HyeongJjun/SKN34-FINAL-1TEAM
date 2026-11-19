# 믿집 v3 작업 문서

- 기준 지시문: [00-prompt.md](00-prompt.md) — 모든 역할이 먼저 읽어요.
- 작업 폴더: `C:\Workspace\SKN34\wt-v3`, 브랜치 `feat-v3`(팀 dev `1a3e656`에서 시작). 커밋 · 푸시는 사용자가 말할 때만 해요.

## 자료 위치

| 무엇 | 위치 |
| --- | --- |
| 9판 화면 109개 · 글 · 설명 | `design/screens.md`, `design/screens.json`, 화면 조각 `design/screens/*.html` (+ `design/screens.css`) |
| 흐름 묶음 · 이야기 24개 · 팀 확인 21개 · 9판 결정 43개 · 기한 규칙 | `design/flow.json` |
| 판 원본(브라우저로 열어 봐요) | `C:/Workspace/SKN34/d10-/reports/유스케이스/v3 (2026-11-17)/흐름 시안 B.html` · `프로토타입.html` |
| 유스케이스 명세서 v3 | 같은 폴더 `믿집 유스케이스 명세서 v3 (간략 · 시안 기준).xlsx` |
| 예전 조사 · 설계 보고서 | `C:/Workspace/SKN34/d10-/reports/`(에이전트 · RAG · 견적서 · 화면 설계 등), 조사 메모 `C:/Workspace/SKN34/d10-/research_notes/` |
| 저장소 밖 자료 | `C:/Workspace/SKN34/d10-/data/`(업체 · 지식 · 평가 등) |

## 문서 차례 (만들어지는 대로 채워요)

| 문서 | 역할 |
| --- | --- |
| `final-report.md` | 최종 보고 · 검증 요약 · 사용자 확인 목록(리드) |
| `decisions-lead.md` · `lead-notes.md` | 잠정 결정 L01~L26 · 진행 기록(리드) |
| `research/00-codebase.md` | 지금 코드 조사(리드) |
| `research/customer.md` · `personas.md` · `scenarios/customer.md` | 고객 대변인 |
| `research/vendor.md` · `scenarios/vendor.md` | 업체 대변인 |
| `architecture.md` · `data-model.md` · `api.md` · `routes.md` | 개발자 |
| `design-system.md` | 디자이너 |
| `security.md` | 보안 담당 |
| `copy-guide.md` · `copy-fixes.md` | UI/UX · 글 점검 |
| `data-sources.md` (+ 저장소 `data/v3/`) | 데이터 수집 |
| `agents.md` (+ `evaluation/v3/`) | 에이전트 설계 |
| `adr/` | 모든 결정 기록 (`adr/_template.md`) |
| `verification/` | 실제로 돌린 검증 기록 (`verification/_template.md`) |
