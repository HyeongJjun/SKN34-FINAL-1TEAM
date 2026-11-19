# E3-D 실제판: Claude로 LLM 모드 시험 (유료)

- 사용자가 2026-11-19에 '내 Anthropic API 키로 조금 시험'을 허락했어요.
- 시험 묶음은 E3-D(`../llm_sim`)와 같아요: 질문 18개, 몫 18개.
  - 제품 LLM 모드(`llm_mode.rewrite`)가 보낼 system · user 원문 그대로 Claude에 보내요.
  - 받은 답은 제품과 같은 검사(`check_outputs.check_task`)로 걸러요.
  - 그래서 흉내(하위 에이전트) · 무료 모드와 그대로 견줄 수 있어요.
- 제품 코드(`app/agent/llm.py`, OpenAI 공급자)는 바꾸지 않았어요. 이 폴더는 평가용이에요.

## 설정

| 항목 | 값 |
| --- | --- |
| 모델 | `claude-opus-5-5` (Claude Opus 5.5) |
| 생각 | 항상 켜짐(adaptive), `effort: medium` |
| 출력 | 구조화 출력(`output_config.format`, 제품 `LlmSection` 모양) |
| 거절 대비 | 서버 fallback(`server-side-fallback-2026-07-01`, `fallbacks: "default"`) |
| 가격 | 입력 100만 토큰당 4달러 · 출력 100만 토큰당 20달러(생각 토큰은 출력으로 매김) |
| 비용 상한 | `--budget` 기본 1달러. 응답 usage로 더하다가 넘기 전에 멈춰요 |
| 키 | 메인 체크아웃 `.env`의 `ANTHROPIC_API_KEY`를 이 프로세스에만 넣어요. 값은 찍지 않아요 |

## 돌리기

```bash
cd backend
uv run --no-sync --with anthropic python ../evaluation/v3/llm_live/run_claude.py --limit 1
uv run --no-sync --with anthropic python ../evaluation/v3/llm_live/run_claude.py
```

- 결과 파일
  - `claude_outputs.jsonl`: 받은 답
  - `claude_usage.jsonl`: 모델 · 토큰 · 비용 · 요청 id
  - `claude_checked.jsonl`: 검사 뒤 답 · 무료 답 · 흉내 답
  - `../results/claude_live.json`: 요약
- 이미 받은 몫은 건너뛰어요.

## 기록

| 날짜 | 무엇 | 결과 |
| --- | --- | --- |
| 2026-11-19 | `--limit 1` 첫 호출 | **401** `authentication_error` · `invalid x-api-key`. 토큰 0 · 비용 0, 결과 파일 없음 |
| 2026-11-19 | 키만 따로 확인(무료 `GET /v1/models`) | `x-api-key` · `Authorization: Bearer` · Bearer + `oauth-2025-04-20` 세 방식 모두 401 `invalid x-api-key` |

- 키 모양(값은 보지 않음): 106자, `sk-ant-usr…`로 시작해요. 보통 Console API 키는 `sk-ant-api03-…`로 시작해요.
- 원인은 확인하지 못했어요. 지워졌거나 만료된 키, 일부만 옮긴 키, API에 쓰지 않는 다른 종류의 키일 수 있어요.
- 사용자가 '있는 키 아무거나 써'라고 해서 `mitjip-mvp\.env`의 키를 썼어요(무료 `GET /v1/models` 통과, 세 모델 모두 쓸 수 있음).

| 날짜 | 무엇 | 명령 | 결과 |
| --- | --- | --- | --- |
| 2026-11-19 | 모델마다 1번 | `run_claude.py --env-file …\mitjip-mvp\.env --limit 1` | 3번 모두 `end_turn` · 검사 통과, 0.028달러 |
| 2026-11-19 | 남은 17번 × 3모델 | `run_claude.py --env-file …\mitjip-mvp\.env` | 모두 `end_turn`, fallback 0, 아래 표 |

| 모델 | 부른 수 | 입력 토큰 | 출력 토큰(생각 포함) | 비용 | 1번 평균 | 평균 시간 | 제품 검사 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Opus 5.5 | 18 | 31,204 | 9,337 | 0.3116달러 | 0.0173달러 | 5.95초 | 그대로 14 · 문장 일부 버림 4 |
| Sonnet 5.5 | 18 | 31,204 | 6,006 | 0.1225달러 | 0.0068달러 | 3.77초 | 그대로 16 · 일부 버림 2 |
| Haiku 5.5 | 18 | 31,204 | 8,731 | 0.0075달러 | 0.0004달러 | 3.13초 | 그대로 17 · 일부 버림 1 |
| 합계 | 54 | | | **0.4416달러** | | | 무료 답으로 돌아간 몫 0 |

- 버린 문장 7개는 모두 기간 숫자(`2일` · `3일` · `2주` · `1일`)가 든 문장이에요.
  - 그 숫자는 근거 글에 있었어요. 다만 제품 규칙상 기간(일 · 주 · 개월)은 계산 엔진 결과에 있는 숫자만 허용해요(`app/agent/v3/check.py`).
  - 이 30문항은 프로젝트 없는 일반 질문이라 계산 결과가 비어 있어서 모두 떨어졌어요.
  - 일반 지식 답에서 근거에 있는 기간(예: '완전히 굳기 약 2주')을 허용할지는 정할 일이에요.
- 문장 수 평균: Opus 3.83 · Sonnet 4.0 · Haiku 3.28. 4문장을 넘긴 답은 없어요.
- 질문별 답 전체(무료 모드 · 흉내 · 세 모델): `report.md`
- 판정자 채점은 아직 하지 않았어요. 위 품질 느낌은 리드가 몇 문항을 읽어 본 것이에요.
