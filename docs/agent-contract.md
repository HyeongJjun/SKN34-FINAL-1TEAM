# 에이전트 작업 협약

뼈대(#81) 위에서 에이전트를 나눠 만들 때 지킬 약속이다. 규칙 원문은 AGENTS.md 4절이고, 누가 맡는지는 이슈 담당자로 정한다.

## 1. 역할

- 안내원(오케스트레이터): 일반 지식(용어 · 시작 순서 · 시방서 검색)은 직접 답한다. 우리 집 이야기는 전문가에게 나눠 맡기고 답을 합친다.
- 공종 전문가(`trade`): 우리 집 조건을 묻고, 주의점 · 준비 사항을 알려 주고, 증상으로 공정을 나누고, 브리프를 만든다.
- 견적 설명 · 공정표 전문가: 계산 엔진 결과를 설명만 한다.
- 의도 라벨 `trade`(옛 이름 `consult`)는 공종 전문가(`trade`)로 보낸다. 학습 데이터 · eval · 모델 라벨도 `trade`다(#75).

## 2. 파일 나누기

| 묶음 | 고치는 파일 |
| --- | --- |
| 오케스트레이션 | `agent/gate.py` · `route.py` · `intent.py` · `orchestrator.py` · `graph.py`, `prompts/orchestrator_v*.md` · `guide_v*.md`, `evaluation/intent` · `orchestrator` · `guide` |
| 공종 | `agent/trade_agent.py` · `trades/dobae.py` · `trades/mokgong.py` · `extract.py`, `prompts/trade_v*.md`, `evaluation/trade` |
| 공정표 | `agent/schedule_agent.py`, `mcp_server.py`, `prompts/schedule_v*.md`, `evaluation/schedule` |
| 견적 설명 (담당 미정) | `agent/quote_explanation_agent.py`, `prompts/quote_explanation_v*.md`, `evaluation/quote_explanation` |
| 공용 | `agent/schemas.py` · `llm.py` · `trades/base.py`, `chat/tools.py`, `config.py` |

- 자기 묶음 파일만 고친다.
- `trades/base.py`(공정 설정 모양)는 공종 · 견적 설명 · 공정표가 같이 읽으므로 공용이다. 공정별 값은 공종이 맡는다.
- 공용 파일은 셋이 같이 쓰므로 충돌을 줄이려고 이렇게 고친다:
  1. 고칠 게 생기면 팀 채팅에 먼저 말한다.
  2. 새 줄 더하기만이면 기능 PR에 같이 둔다. PR 본문에 고친 공용 파일을 적는다.
  3. 기존 줄을 바꾸거나 지우면 그 변경만 담은 PR을 따로 올려 먼저 병합한다.
  4. 나머지는 dev로 rebase해서 받는다.

## 3. 에이전트 함수 모양

```python
async def trade(state: ChatState) -> dict:
    ...
    section = Section(
        title="[도배] 셀프 난이도: 전문가 필요",
        sentences=["결론 1~3문장"],
        caution="주의할 점 한 줄",
        tip="팁 한 줄",
    )
    return {"answer": AgentAnswer(sections=[section], cards=[...])}
```

- 답 모양: 전문가 하나가 `Section` 하나(제목 → 결론 → 주의 → 팁)를 낸다. "주의:" · "팁:"은 화면이 붙인다.
- 예상 비용은 문장에 쓰지 않고 `Card(kind="standard_quote")`로 붙인다. 화면이 표준견적서 금액으로 채운다.
- 받는 값: `state["ctx"]`(사용자 · 대화 · 프로젝트, 서버가 정함), `state["message"]`.
- 공정은 공종 전문가가 `match_trades`로 직접 고르고 `trades`로 돌려준다. 미리 채워져 오지 않는다.
- 돌려주는 값: `{"answer": AgentAnswer}`. 새 상태 키가 필요하면 `ChatState`(공용)에 더한다.
- `ctx`의 `user_id` · `project_id`를 LLM 출력으로 바꾸지 않는다.
- 문장에 금액 · 수량 · 날짜를 쓰지 않는다. 숫자는 계산 엔진 결과를 카드로 붙인다.
- LLM 실패(`llm.LLMError`)는 잡아서 `AgentAnswer(failed=True)`로 돌려준다. 규칙으로 만든 가짜 설명으로 채우지 않는다.

## 4. LLM 호출과 출력 모델

- LLM은 `llm.structured(role, schema, messages)`로만 부른다. role은 `orchestrator` · `trade` · `quote_explanation` · `schedule`.
- LLM에서 받는 모양(예: `TradeReply`)은 자기 에이전트 파일 안에 둔다. `schemas.py`에는 넣지 않는다.
- 에이전트 함수가 그 모양을 `AgentAnswer`로 바꿔 돌려준다.

## 5. 안내원이 전문가를 부를 때

- 복합 요청이면 안내원이 질문을 나눠 전문가마다 자기 몫만 넘긴다: `trade({**state, "message": 나눈 질문})`.
- 그래서 각 에이전트 함수는 받은 `state`만 보고 동작한다. 그래프에서 불리든 안내원이 부르든 결과가 같아야 한다.
- 전문가는 `orchestrator.py`를 import하지 않는다. 다른 전문가도 부르지 않는다.
- 안내원은 전문가들의 `sections`를 이어 붙인다.
- 일부만 실패하면 실패한 몫만 `Section(sentences=["설명을 만들지 못했어요"])`으로 넣는다. `failed`는 모두 실패했을 때만 켠다(출력 검사가 답 전체를 바꾸므로).
- 턴당 하위 호출은 3회까지, 에이전트별 도구 호출은 4회까지다.

## 6. 데이터와 도구

- 기능 데이터(프로젝트 · 견적 · 공정표)는 `chat/tools.py`의 도구로 받는다. 기능 service를 import하지 않는다.
- 일정 MCP는 `schedule_agent.py`만 부른다.
- 시방서 검색은 `knowledge.service` 함수를 도구로 감싸 쓴다.
- 업체가 쓴 글은 지시문에 넣지 않고 데이터로만 넘긴다.

## 7. 테스트와 eval

- 테스트는 `backend/tests/test_agent_<묶음>.py`. `llm.set_stub`으로 답을 정하고 `LLM_LIVE=false`로 돈다.
- eval 세트는 `evaluation/<묶음>/`에 두고 dev와 held-out을 2:1로 나눈다.
- 프롬프트를 바꾸는 PR은 커밋 type `prompt`로 하고 eval 결과를 붙인다.

## 8. 아직 정할 것

- 견적 설명 전문가 담당
- 대화 API(`chat/router` · `service`, SSE, 대화 잠금) 담당. 화면 연결과 맞물린다
- 공종 전문가가 넘기는 브리프 모양과 저장 자리(`chat.service`)
- 도구 부르는 방식: LLM이 도구를 고르게 할지(`llm.py`에 도구 호출 추가, 첫 공용 PR), 코드가 먼저 도구를 불러 결과만 넘길지
