# agent-05 로컬 모델: 제품 기본에는 쓰지 않고, 검색용 작은 모델만 승인 뒤 실험

- 상태: **사용자 확인 필요** (내려받기가 커서 리드가 사용자에게 물어요. 이번에는 아무것도 내려받지 않았어요)
- 날짜: 2026-11-18 · 쓴 역할: 에이전트 설계
- 관련 코드: `backend/app/agent/llm.py`, `backend/app/knowledge/*`, 설계 [agents.md](../agents.md) 10 · 11절, 실험 [PLAN.md](../../../evaluation/v3/PLAN.md) E2 · E3

## 배경

무료 모드에서 '생성 모델 없이' 답하는 길(ADR-02)과 '무료 로컬 모델로 답하는' 길이 있어요. 로컬 모델은 내려받기가 수백 MB~수 GB라 지시문 3.4절에 따라 사용자 확인이 먼저예요. 무엇을, 어디에 쓸지 후보와 권고를 정리해요.

## 대안

| 안 | 내용 | 크기 · 라이선스(모델 카드 기준) | 좋은 점 | 걸리는 점 |
| --- | --- | --- | --- | --- |
| A 로컬 모델 없음 | 무료 모드 = 규칙 · 분류기 · 카드 · 검색 · 계산 엔진 | 0 | 결정적, 서버 부담 없음, 라이선스 걱정 없음 | 카드 밖 질문은 추출식 수준 |
| B 로컬 생성 모델(Ollama 등) | 담당 글쓰기를 로컬 모델로 | Qwen3-4B 2.5GB(Ollama, Apache-2.0) [1] · Kanana-1.5-2.1B(Apache-2.0, 파일 크기 확인 못 함) [2] · EXAONE-4.0-1.2B Q4_K_M 812MB(EXAONE 1.2-**NC**) [3] · Gemma3 4B 3.4GB(Gemma Terms) [4] · HyperCLOVA X SEED 1.5B(전용 라이선스, 상업 조건 확인 못 함) [5] | 자연스러운 글, 키 없음 | 서버 CPU에서 느림(운영은 EC2 한 대), 작은 모델 한국어 점수가 낮음(예: EXAONE 1.2B KMMLU-Redux 40~47, HyperCLOVA X SEED 1.5B KMMLU 0.39), 근거를 줘도 지어냄 [8], NC 라이선스 |
| C 로컬 임베딩 · 재순위만 | 검색만 좋게(의미 검색 · 재순위), 답은 카드 · 추출식 | KURE-v1 0.6B(MIT) [6] · bge-reranker-v2-m3 0.6B(Apache-2.0) [7] · voyage-4-nano(Apache-2.0, 크기 확인 못 함) [9] | 키 없이 의미 검색. 답 내용은 그대로 검증된 글 | 내려받기(각 약 0.6B 가중치), 서버 메모리 · 지연, 새 의존성 |
| D 형태소 분석기만 | Kiwi로 BM25 낱말 나누기 | kiwipiepy(Apache-2.0), 모델 약 58.7MB [10] | 작음, 한국어 낱말 경계 | 지금 바이그램보다 나은지 미확인(공개 비교 수치 못 찾음) |

## 고른 것과 이유 (권고)

- 권고: **제품 기본은 A.** 실험은 **D → C 순서로, 사용자 승인 뒤.** B는 사용자가 원하면 실험용(E3 비교안)으로만.
- 이유
  1. 무료 모드는 '틀리지 않는 것'이 먼저예요. B는 근거를 줘도 지어낸 내용이 남고 [8] 작은 모델일수록 한국어 점수가 낮아요 [3][5].
  2. 키 있는 의미 검색(11-13 순위 사본)을 더하면 held-out hit@5가 0.697 → 0.758로 올랐어요. 같은 이득을 키 없이 얻는 길이 C라서, 답은 그대로 두고 검색만 좋게 하는 쪽이 이득 대비 위험이 작아요.
  3. KURE-v1은 한국어 검색에서 text-embedding-3-large보다 높다고 보고돼요(Recall@5 0.739 vs 0.664, 제작자 보고) [6]. 믿집 세트로 직접 재야 해요.
  4. D는 가장 작아서(약 58.7MB) 먼저 시험하기 좋아요. 지시문 3.4절 '작은 라이브러리'에 가깝지만, 모델 파일을 받아야 해서 함께 물어요.

## 근거 (직접 열어 확인한 것)

1. Qwen/Qwen3-4B — https://huggingface.co/Qwen/Qwen3-4B · Ollama qwen3 — https://ollama.com/library/qwen3 (확인 2026-11-18) — Apache-2.0, 4.0B, 4b 2.5GB · 8b 5.2GB
2. kakaocorp/kanana-1.5-2.1b-instruct-2505 — https://huggingface.co/kakaocorp/kanana-1.5-2.1b-instruct-2505 (확인 2026-11-18) — Apache-2.0, KoMT-Bench 6.54
3. LGAI-EXAONE/EXAONE-4.0-1.2B — https://huggingface.co/LGAI-EXAONE/EXAONE-4.0-1.2B (+ GGUF 파일 목록) (확인 2026-11-18) — 1.2-NC 라이선스, KMMLU-Redux 46.9 · 40.4, Q4_K_M 812MB
4. Ollama gemma3 — https://ollama.com/library/gemma3 (확인 2026-11-18) — 1b 806MB · 4b 3.4GB, Gemma Terms of Use
5. naver-hyperclovax/HyperCLOVAX-SEED-Text-Instruct-1.5B — https://huggingface.co/naver-hyperclovax/HyperCLOVAX-SEED-Text-Instruct-1.5B (확인 2026-11-18) — 전용 라이선스, KMMLU 0.393
6. nlpai-lab/KURE-v1 — https://huggingface.co/nlpai-lab/KURE-v1 (확인 2026-11-18) — MIT, 0.6B, 한국어 Recall@5 0.739
7. BAAI/bge-reranker-v2-m3 — https://huggingface.co/BAAI/bge-reranker-v2-m3 (확인 2026-11-18) — Apache-2.0, 0.6B
8. Benchmarking LLM Faithfulness in RAG (arXiv 2505.04847) — https://arxiv.org/abs/2505.04847 (확인 2026-11-18) — 맥락을 줘도 근거 없는 내용이 자주 남음
9. Claude Docs, Embeddings — https://platform.claude.com/docs/en/build-with-claude/embeddings (확인 2026-11-18) — voyage-4-nano 공개 가중치(Apache 2.0)
10. kiwipiepy — https://github.com/bab2min/kiwipiepy (확인 2026-11-18) — Apache-2.0, CoNg 모델 약 58.7MB

## 검증

- 방법: 승인 뒤 E2(Kiwi BM25 · KURE 하이브리드 · 재순위)를 dev로 견주고 held-out 한 번. B를 허락하면 E3에 비교안으로 더해 근거성 · 지어낸 숫자 · 지연을 재요.
- 결과: 검증 대기(내려받기 승인 전).

## 다시 볼 조건

- 운영 서버가 GPU를 갖게 되거나, 작은 한국어 모델의 RAG 근거성이 E3에서 0.9를 넘으면 B를 다시 봐요.
- C가 E2에서 무료 모드 hit@5를 0.05 이상 올리면 제품 무료 모드에 넣는 것을 사용자에게 물어요.
