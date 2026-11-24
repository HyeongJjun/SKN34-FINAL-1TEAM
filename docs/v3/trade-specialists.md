# v3 공종별 에이전트 구조와 추가 방법

## 현재 구조

공종별 기본 설정, 검색, 답변 지침을 각 공종 폴더에서 관리한다. 현재 전용 폴더가 연결된 공종은 **도배**다. 목공·전기·철거 등은 공종 설정과 공통 상담 흐름을 사용한다.

내 포크 `dev` 대비 추가·수정된 항목을 표시했다.

```text
backend/
├── app/
│   ├── agent/
│   │   ├── v3/
│   │   │   ├── turn.py
│   │   │   ├── gate.py
│   │   │   ├── orchestrator.py
│   │   │   ├── guide.py
│   │   │   ├── trades.py            [수정] 공종별 기본 설정 관리
│   │   │   ├── trade_agent.py       [수정] 공종별 실행 함수 선택
│   │   │   ├── answer.py            [수정] 공종별 검색 함수 선택
│   │   │   ├── llm_mode.py          [수정] 공종별 답변 지침 적용
│   │   │   ├── quote_explain.py
│   │   │   ├── schedule_agent.py
│   │   │   ├── prompts/
│   │   │   │   └── trade_v1.md
│   │   │   └── specialists/         [추가]
│   │   │       ├── __init__.py       공종별 실행·검색·프롬프트 등록
│   │   │       └── dobae/
│   │   │           ├── agent.py           도배 에이전트 실행 시작점
│   │   │           ├── spec.py            도배 기본 설정
│   │   │           ├── retrieval.py       도배 검색 진입점
│   │   │           ├── keyword_search.py  도배 검색어 보정·키워드 검색
│   │   │           └── prompt_v1.md       도배 전용 답변 지침
│   │   └── cards/
│   │       ├── dobae.jsonl
│   │       └── mokgong.jsonl
│   ├── chat/
│   │   ├── router.py
│   │   ├── service.py
│   │   └── tools.py                 [수정] 업무 도구 4종 정의
│   ├── knowledge/
│   ├── calc/
│   ├── project/
│   ├── visit/
│   ├── quote/
│   └── schedule/
└── tests/
    └── test_v3_trade_specialists.py [추가] 공종별 연결 테스트

evaluation/
└── v3/
    └── trades/
        └── dobae/                   [추가] 도배 평가 데이터
            └── questions.jsonl      평가 질문과 기대 결과
```

## 질문 처리 흐름

1. `POST /ai/turns`를 받은 `chat/service.py`가 대화 정보와 활성 지식 자료의 키워드 색인을 준비한다.
2. `turn.py`가 `gate.py`의 결과로 담당을 고른다. 단일 공종 질문은 해당 담당을 호출하고, 복합 요청은 `orchestrator.py`가 나눠 호출한 뒤 답변을 합친다.
3. `trade_agent.py`가 등록된 공종 전용 실행 함수를 선택한다. 도배의 `agent.py`는 현재 공통 상담을 호출한다.
4. 지식 답변이 필요하면 `answer.py`가 공종별 검색 함수를 고른다. 도배는 `retrieval.py` → `keyword_search.py` → 공통 `knowledge/search3.py` 순서로 **키워드 RAG**를 실행한다. 공통 답변 흐름은 검색 근거를 바탕으로 카드, 자료 발췌, 확인 안내 중 필요한 답을 고른다.
5. LLM 모드에서 일부 답변을 다시 쓸 때 `llm_mode.py`가 공통 지침에 등록된 공종 지침을 덧붙인다. 완성된 답은 검사하고 저장한 뒤 채팅으로 보낸다.

[전체 v3 에이전트 설계](agents.md) · [답변 카드 기준](adr/agent-07-answer-cards.md)

## 공종 에이전트 추가 방법

목공처럼 **이미 등록된 공종을 전용으로 개발**할 때는 기존 공종 코드(`mokgong`)를 그대로 쓴다.

1. `backend/app/agent/v3/specialists/mokgong/`을 만들고 필요한 파일을 둔다. 검색을 바꿀 때는 `retrieval.py`와 키워드 검색 파일을, 답변 지침을 바꿀 때는 `prompt_v1.md`를 사용한다. 상담 흐름을 바꿀 때는 `agent.py`를 추가한다.
2. [공종 등록 파일](../../backend/app/agent/v3/specialists/__init__.py)의 `SPECIALISTS`에 공종 코드를 추가하고 필요한 항목만 연결한다. `retrieve`는 검색 함수, `prompt_path`는 답변 지침 경로, `run`은 실행 함수다. 생략한 항목에는 기존 공통 동작이 적용된다. 이 등록으로 `turn.py`, `answer.py`, `llm_mode.py`의 기존 연결을 재사용한다.
3. 기본 설정도 공종 폴더에서 관리하려면 도배의 [spec.py](../../backend/app/agent/v3/specialists/dobae/spec.py)처럼 설정을 분리하고 [trades.py](../../backend/app/agent/v3/trades.py)의 `SPECS`에서 불러온다. `TradeSpec`과 `Slot`은 `trades.py`에 정의돼 있다.
4. `evaluation/v3/trades/mokgong/questions.jsonl`에 평가 질문과 기대 결과를 추가한다. [도배 평가 데이터](../../evaluation/v3/trades/dobae/questions.jsonl)를 예시로 사용한다. [연결 테스트](../../backend/tests/test_v3_trade_specialists.py)를 참고해 전용 기능이 호출되는지, 기존 공종과 답변 카드 흐름이 유지되는지 확인한다.

서비스에서 처음 인식할 공종이라면 [schemas.py](../../backend/app/agent/v3/schemas.py)의 `TradeCode`와 `trades.py`의 `SPECS`에 먼저 등록한다. 공종을 알아보는 질문 단어와 지식 자료의 공종 태그도 해당 설정에 맞춘다.

## 업무 도구의 위치와 범위

[chat/tools.py](../../backend/app/chat/tools.py)의 `WorkTool`에 도구 이름을 정의했다. 아래 네 가지의 AI 실행 연결은 후속이다.

| 도구 | 담당 범위 |
| --- | --- |
| 폼 자동 입력·관리 | 대화에서 양식에 넣을 값을 뽑고 빠진 필수 항목을 안내한다. |
| 실측 일정 조율·관리 | 고객 희망일과 업체 가능 기간을 확인해 방문 시간 선택지를 안내한다. |
| 업체 견적서 작성·관리 | 업체 견적 입력 초안을 만들고 고객의 견적 비교를 돕는다. |
| 프로젝트 진행 상태 관리 | 현재 단계와 공사 일정·추가 금액·완료 확인 등 다음 할 일을 안내한다. |
