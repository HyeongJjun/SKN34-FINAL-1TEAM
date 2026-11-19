# agent-04 평가 방법: 코드 채점 먼저 + Claude Code 하위 에이전트 판정(이진 루브릭 · 블라인드 · 순서 바꾸기) + 사람 표본

- 상태: 고름
- 날짜: 2026-11-18 · 쓴 역할: 에이전트 설계
- 관련 코드: `evaluation/run.py` · `intent_metrics.py` · `evaluation/rag/metrics.py` · `evaluation/answer/judge.md`, 계획 [evaluation/v3/PLAN.md](../../../evaluation/v3/PLAN.md)

## 배경

여러 방식을 실험으로 견줘야 하는데(지시문 1장), 유료 API는 0회예요(3.4절). 지금 답 품질 평가(`evaluation/answer`)는 답 쓰기에 유료 LLM을 썼고 판정만 Claude 하위 에이전트가 했어요. v3는 답 쓰기 흉내 · 채점 · 고객 흉내까지 무료로, 믿을 만하게 해야 해요.

## 대안

| 안 | 내용 | 좋은 점 | 걸리는 점 |
| --- | --- | --- | --- |
| A 유료 LLM 판정(API) | OpenAI 등으로 채점 | 자동, 빠름 | 비용 · 규칙 위반(유료 0회) |
| B 사람만 | 리드 · 사용자가 모두 채점 | 가장 믿을 만함 | 느리고 문항 수가 작아져요 |
| C 코드 채점 먼저 + 하위 에이전트 판정 + 사람 표본 | 숫자 · 인용 · 라벨 · 검색은 코드, 뜻 판단만 하위 에이전트가 이진 루브릭으로, 블라인드 · 순서 바꾸기 · 형식 지움 · 두 판정자, 사람 표본으로 판정자 맞음률 확인 | 0원, 반복 가능, 판정 편향을 줄임 | 하위 에이전트도 LLM이라 편향이 남아요. 사람 표본이 꼭 필요 |
| D 작은 판별 모델(HHEM 등) | 근거성 판별 모델을 로컬에서 | 결정적 | 내려받기 · 한국어 성능 미확인, 감지 정확도가 낮다는 보고 [6] |

## 고른 것과 이유

- 고른 안: **C**
- 이유
  1. 작은 세트(약 20문항)로 시작하고, 루브릭 하나로 0~1 점수 + 통과/실패를 매기는 LLM 판정이 사람과 가장 맞았고, 사람 점검이 자동이 놓친 것을 잡았다는 실무 보고 [1].
  2. LLM 판정에는 위치 · 장황함 · 자기 우대 편향이 있고 [2], 형식(마크다운) 편향이 가장 커요 [3] → 순서 바꿔 두 번, 형식을 지운 평문, 이진 판정.
  3. 다국어 판정은 언어 사이 일치가 낮아요(평균 κ 약 0.3) [4] → 한국어 루브릭 · 두 판정자 일치율 · 사람 표본 TPR/TNR을 꼭 적어요.
  4. 근거성은 주장 단위로 나눠 근거가 받치는지 보는 정의를 써요 [5].
  5. 고객 흉내는 끝 상태 비교 · pass^k [7], 흉내 고객이 목표를 놓치는 문제 [8] → 매 턴 남은 목표를 적게 해요.
  6. Claude Code 하위 에이전트는 따로 문맥 · 도구 허용 목록을 가져서(결과만 돌려줌) 블라인드 판정 · 역할 나누기가 쉬워요 [9]. API 요금이 없어요(구독 사용량에 들어가요).
  7. 이미 코드로 잰 기준선(E1 · E2)은 판정자 없이 0원으로 다시 잴 수 있어요.

## 근거 (직접 열어 확인한 것)

1. Anthropic, How we built our multi-agent research system — https://www.anthropic.com/engineering/multi-agent-research-system (확인 2026-11-18) — 20문항 시작, 루브릭 LLM 판정, 사람 점검
2. Judging LLM-as-a-Judge with MT-Bench (arXiv 2306.05685) — https://arxiv.org/abs/2306.05685 (확인 2026-11-18) — 위치 · 장황함 · 자기 우대 편향
3. Judging the Judges (arXiv 2604.23178) — https://arxiv.org/abs/2604.23178 (확인 2026-11-18) — 형식 편향이 가장 크고 위치 편향은 작음, 완화로 일치 상승
4. How Reliable is Multilingual LLM-as-a-Judge? — https://aclanthology.org/2025.findings-emnlp.587/ (확인 2026-11-18) — 25언어 평균 κ 약 0.3
5. Ragas, Faithfulness — https://docs.ragas.io/en/stable/concepts/metrics/available_metrics/faithfulness/ (확인 2026-11-18) — 주장 단위 근거성
6. Benchmarking LLM Faithfulness in RAG (arXiv 2505.04847) — https://arxiv.org/abs/2505.04847 (확인 2026-11-18) — 근거 없는 내용 감지가 아직 어려움
7. τ-bench (arXiv 2406.12045) — https://arxiv.org/abs/2406.12045 (확인 2026-11-18) — 흉내 사용자 · 끝 상태 비교 · pass^k
8. Goal Alignment in LLM-Based User Simulators (arXiv 2507.20152) — https://arxiv.org/abs/2507.20152 (확인 2026-11-18) — 흉내 사용자가 목표를 놓침
9. Claude Code, Subagents — https://code.claude.com/docs/en/sub-agents (확인 2026-11-18) — 따로 문맥 · 도구 허용 목록 · 결과만 돌려줌

## 검증

- 방법: 판정 절차 시험(E3 20문항)에서 두 판정자 일치율 · 사람 표본 30문항 × 실패 유형 3개로 TPR/TNR.
- 결과
  - 코드 채점 기준선(E1 · E2): 2026-11-18 돎(verification/agents.md).
  - 하위 에이전트 판정 · 사람 표본: 검증 대기.

## 다시 볼 조건

- 판정자 TPR 또는 TNR이 0.8 아래면 그 실패 유형은 사람 채점으로 돌려요.
- 두 판정자 일치(κ)가 0.6 아래면 루브릭을 고쳐요.
