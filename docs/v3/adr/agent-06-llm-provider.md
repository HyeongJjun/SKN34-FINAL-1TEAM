# agent-06 LLM 공급자: OpenAI 하나 유지(키 있을 때만), 입구 관문의 Jev(OpenRouter)는 뺌

- 상태: **사용자 확인 필요** (공급자 · 계정 · 비용은 사용자가 정해요)
- 날짜: 2026-11-18 · 쓴 역할: 에이전트 설계
- 관련 코드: `backend/app/agent/llm.py`, `backend/app/agent/gate.py`(Jev), `backend/app/config.py`(`OPENAI_*` · `OPENROUTER_API_KEY` · `JEV_*`), `rag_chunks`(1536차원 임베딩)

## 배경

LLM 모드는 '키를 넣으면 같은 코드가 LLM을 써요'(지시문 1장)예요. 지금 코드는 대화 · 구조화 출력 · 임베딩을 OpenAI로, 입구 분류의 낮은 신뢰도 판정을 Jev(OpenRouter)로 해서 공급자가 둘이에요. v3 LLM 모드의 공급자를 정해야 지시문 · 테스트 스텁 · 비용 기록을 한 벌로 만들 수 있어요.

## 대안

| 안 | 내용 | 좋은 점 | 걸리는 점 |
| --- | --- | --- | --- |
| A OpenAI 하나 유지 + Jev 뺌 | 대화 · 구조화 · 임베딩 모두 OpenAI(`llm.py` 그대로), 관문은 분류기 + 규칙 + 되묻기 | 지금 코드 · 테스트 스텁 · 임베딩(text-embedding-3-small 1536차원, 이미 적재) 그대로. 키 하나 | 공급자 한 곳에 묶임 |
| B Anthropic(Claude)으로 바꿈 | 대화를 Claude로 | 한국어 글 품질 기대 | Anthropic은 자체 임베딩 모델이 없어 [1] 임베딩 공급자가 따로 필요(또는 다시 임베딩). `llm.py` · 스텁 다시 씀 |
| C OpenRouter로 여러 공급자 | 공급자를 바꿔 가며 | 유연 | 키 · 비용 추적 · 출력 모양이 공급자마다 달라 시험이 늘어요. '공급자 하나' 원칙과 어긋남 |
| (덧) Jev 두기 | 분류기 신뢰도 < 0.7일 때 Jev 한 번 | 애매한 문장 일부를 더 맞힘 | 두 번째 키 · 비용. 측정상 없어도 됨(아래) |

## 고른 것과 이유

- 고른 안(권고): **A**
- 이유
  1. 지금 `llm.py`가 OpenAI 한 곳으로 모여 있고, 지식 조각 임베딩이 text-embedding-3-small 1536차원으로 이미 적재돼 있어요. 공급자를 바꾸면 임베딩을 다시 만들어야 해요(B: Anthropic은 임베딩 모델이 없음 [1]).
  2. Jev가 없어도 관문이 충분해요: 분류기(≥0.7) → 규칙 → 분류기 조합이 held-out 0.970(67문장)이고, 0.7 이상으로 바로 받은 것의 정확도는 1.000이었어요. 나머지는 후보 버튼으로 되묻는 편이 비용 없이 정확해요 [2][3].
  3. 무료 모드가 기본이라 LLM 모드는 '있으면 더 좋은' 층이에요. 공급자 하나로 지시문 판 · eval · 비용 기록을 단순하게 둬요.
- 공급자 선택(OpenAI 유지 vs Claude)은 계정 · 비용 문제라 **사용자 확인 필요**예요. B를 고르면 임베딩 공급자를 함께 정해야 해요.

## 근거 (직접 열어 확인한 것)

1. Claude Docs, Embeddings — https://platform.claude.com/docs/en/build-with-claude/embeddings (확인 2026-11-18) — "Anthropic does not offer its own embedding model", Voyage AI 안내
2. Intent Detection in the Age of LLMs (arXiv 2410.01627) — https://arxiv.org/abs/2410.01627 (확인 2026-11-18) — 불확실할 때만 비싼 판정으로 넘기는 계단식
3. Conformal Intent Classification and Clarification (arXiv 2403.18973) — https://arxiv.org/abs/2403.18973 (확인 2026-11-18) — 후보 묶음으로 되묻기

## 검증

- 방법: E1에서 'Jev 없는 관문'의 되묻기 비율 · 정확도를 v3 세트로 재요. LLM 모드는 `LLM_LIVE=false` 스텁 테스트로 배선만 확인하고, 실제 호출은 사용자 승인 뒤 비용을 먼저 보여 드려요.
- 결과: E1 기준선(Jev 없음) held-out 0.970 · 0.7 이상 정확도 1.000(2026-11-18). LLM 모드 실제 호출은 검증 대기(유료라 안 함).

## 다시 볼 조건

- 사용자가 다른 공급자를 고르면 이 ADR을 바꿔요(→ 새 ADR).
- v3 라벨 세트에서 되묻기 비율이 20%를 넘으면 관문 보조 판정(LLM 한 번)을 다시 봐요.
