# 주요 API 호출 순서와 상태

[API 안내](README.md) · [전체 경로](endpoints.md) · [인증·오류](common.md) · [현재 v2 구조](../v2/structure.md)

기준: `dev` SHA `1a3e656`. 아래 순서는 등록된 FastAPI API와 서비스의 상태 전이를 따라 작성했다. **경로의 `/api` 접두어는 브라우저 앞단에서만** 추가한다. 예시 데이터는 전부 합성값이며 실제 회원·업체·세션·파일 정보를 포함하지 않는다. 개별 본문 필드 전체는 로컬 [Swagger/OpenAPI](README.md#swagger와-openapi-보기)를 확인한다.

## 1. 로그인과 업체 승인

```text
고객:
  POST /auth/signup(201 · 세션 쿠키) 또는 POST /auth/login
    → GET /me → GET /regions → POST /projects

업체:
  POST /auth/vendor-signup(사업자등록증 multipart, 201 · 세션 쿠키)
    → GET /vendor/application(업체 승인 전에도 가능)
    → 관리자 GET /admin/vendors → POST /admin/vendors/{vendor_id}/review
      ├ 승인: 업체의 /vendor/profile · /vendor/prices · /vendor/visits 사용 가능
      ├ 보완 요청: POST /vendor/application/resubmit → 재심사
      └ 거절: POST /vendor/application/reapply → 재심사
```

- 고객 가입 `POST /auth/signup`은 JSON, 업체 가입 `POST /auth/vendor-signup`은 **Form 필드 + `license_file`**인 multipart다. 공개 API라도 Origin·본문 크기·가입 횟수 제한을 받는다.
- 로그인 성공 시 응답 본문(`MeOut`) 외에 **HttpOnly 세션 쿠키**가 설정된다. 이후 `GET /me`로 역할을 확인한다. API 인증은 JWT Bearer가 아니다.
- 업체 심사는 관리자만 결정할 수 있다. `pending`일 때 승인·보완·거절을 반영하고 같은 신청에 결정이 이미 났으면 `409 invalid_state`가 가능하다. 업체는 `vendor` 역할이어도 **승인 전까지** 단가·실측·일정 API에서 `403 vendor_not_approved`를 받는다.
- `PUT /vendor/profile`은 읽은 `updated_at` 기준으로 충돌을 확인한다(`409 stale`). 사진은 `POST /files`의 `kind=portfolio`로 먼저 올리고 `POST /vendor/portfolio`로 연결한다.
- `GET /vendor/prices?trade=dobae` → `PUT /vendor/prices/dobae`(초안) → `POST /vendor/prices/dobae/confirm`(확정) 순서다. 고객 가견적에는 **확인된 업체 단가 묶음**만 사용한다. 단가 근거는 `kind=price_doc` 파일을 먼저 올린 다음 `POST /vendor/price-files`로 연결한다.

## 2. 고객의 집 등록부터 실측 요청

```text
GET /regions
  → POST /projects                      고객 집·공간·공정·사진 연결
  → GET /projects/{project_id}
  → GET /projects/{project_id}/standard 표준견적서(공공 기준 참고 금액)
  → GET /projects/{project_id}/plan     예상 공정표
  → POST /projects/{project_id}/plan    시작일·주말 조건을 바꿔 다시 계산(업체 확정 전)
  → GET /projects/{project_id}/vendors?trade=dobae
  → GET /projects/{project_id}/vendors/{vendor_id}?trade=dobae
  → POST /projects/{project_id}/visits  선택 업체에게 실측 요청
  → GET /projects/{project_id}/visits   상태·남은 자리·동의 결과 확인
```

- 새 프로젝트는 고객 역할만 생성하며 `POST /projects` 성공 시 **201**을 반환한다. 집 정보·공종·공간은 [`ProjectCreate`](../../backend/app/project/schemas.py) 구조를 따른다. 사진·도면은 `POST /files`(`kind=photo` 또는 `plan`)로 먼저 올려 파일 ID를 프로젝트에 연결한다.
- 프로젝트 만들기와 수정은 고객 본인만 가능하고, 프로젝트·표준견적서·공정표 조회는 소유 고객 또는 관리자만 가능하다. 타인의 자료는 일반적으로 `404 not_found`로 숨긴다.
- 첫 실측 요청을 보내면 프로젝트가 잠긴다. 그 뒤 `PATCH /projects/{project_id}`는 `409 locked`이며, 예상 공정표도 업체 확정 뒤에는 `409 dates_locked`가 될 수 있다.
- 업체 고르기는 고객이 선택한 `trade=dobae|mokgong`의 승인 업체·가견적을 보여 주고 **공정당 실측 요청을 최대 3곳**까지 받는다. 연락처를 제공하는 경우에만, 목록에서 받은 `consent_ver`와 `share_contact_ids`를 요청에 넣고 필요한 주소·연락처를 확인한다. 연락처 미공유면 `consent_ver`를 생략할 수 있다. 서버는 동의 문구가 바뀌면 `409 consent_changed`, 자리가 다 찼으면 `409 slots_full`, 연락처·주소가 부족하면 해당 `422`를 돌려준다.

예시 구조(합성 UUID이며 실제 업체에 전송되는 요청은 아님):

```json
{
  "trade": "dobae",
  "vendor_ids": ["00000000-0000-4000-8000-000000000001"],
  "share_contact_ids": [],
  "message": "견적서 양식을 확인하고 싶습니다."
}
```

`share_contact_ids`가 비어 있으면 업체에 고객 연락처를 공유하겠다는 동의가 아니다. 실제 UI는 동의할 업체를 선택한 뒤 해당 정보·최신 동의 문구를 확인해야 한다. **요청 보내기 전의 업체 선택**과 **POST 성공 후 저장된 실측 요청**을 구분한다.

**일부 업체만 성공할 수 있음:** `POST /projects/{project_id}/visits`의 성공 응답 `VisitCreateOut`에는 실제 생성된 요청 **`created`**와 요청하지 못한 업체 **`failed`**가 함께 들어간다. 업체가 이용 불가(`unavailable`)이거나 이미 요청함(`already`)이면 실패 목록에 남기고 나머지 업체의 요청은 성공할 수 있다. `HTTP 201`만 보고 입력한 `vendor_ids`가 전부 생성됐다고 취급하지 않는다. 생성할 새 업체가 하나도 없으면 `409 already` 또는 `409 unavailable`, 남은 자리보다 신규 업체가 많으면 `409 slots_full`이다. 사용자는 **`created/failed` 결과를 모두 확인**해야 한다.

## 3. 업체의 실측 견적 제출과 고객 확정

```text
승인 업체:
  GET /vendor/visits               작업함
  GET /vendor/visits/{visit_id}    요청·공개 가능한 연락처
  POST /files (kind=quote_doc)     업체 자체 견적 파일 업로드
  GET /vendor/visits/{visit_id}/quote
  PUT /vendor/visits/{visit_id}/quote     파일 ID + 금액·부가세 방식 등 임시 저장
  POST /vendor/visits/{visit_id}/quote/send  실제 보내기
    └ 다시 보내려면 새 임시 저장 후 send: 같은 요청 아래 새 버전

고객:
  GET /projects/{project_id}/quotes?trade=dobae
  GET /projects/{project_id}/quotes/{quote_id}/files/{file_id}
  POST /projects/{project_id}/quotes/{visit_id}/confirm
  GET /projects/{project_id}/deals
```

- 업체는 **자체 양식 파일**을 제출한다. `PUT` 임시 저장은 파일 목록·금액·부가세 방식 등을 통째로 받아 견적서 **미발송 버전**으로 저장한다. `POST .../send`가 고객에게 발송하는 단계이며, 누락된 필수 칸은 `422 missing`과 `error.fields`로 알려 준다.
- 이미 보낸 버전을 `send`만 다시 눌렀으면 `409 already_sent`; 다시 제출하려면 새 임시 저장을 만들어 `send`한다. 확정이나 닫힘 이후에는 `409 invalid_state`가 가능하다. 고객은 보내진 버전만 전용 파일 조회 API로 읽을 수 있고, 업체는 자기 임시·발송 파일을 읽을 수 있다.
- 고객 확정에는 **보고 있던 견적서 버전 `seen_ver`**를 사용한다. 견적이 변경됐다면 `409 quote_changed`로 막는다. 확정하면 해당 공종의 다른 실측 요청은 닫힌다. 날짜 수락 전에는 `POST /projects/{project_id}/deals/{deal_id}/reselect`로 다시 고를 수 있다.
- `POST /projects/{project_id}/quotes/{visit_id}/confirm`의 `visit_id`는 **실측 요청 ID**이며, `GET /projects/{project_id}/quotes/{quote_id}/files/{file_id}`의 `quote_id`는 **발송된 견적 버전 ID**다. 두 ID를 바꿔 넣지 않는다.
- `POST /projects/{project_id}/visits/{visit_id}/cancel`은 견적이 오기 전, `POST /projects/{project_id}/visits/reselect`는 확정 전 해당 공종 요청을 모두 닫는 작업이다. 확정 뒤의 다시 고르기와 API가 다르므로 구분한다.

업체 파일 내용에 자동 OCR로 가격 행을 추출하거나 업체 양식을 표준 행으로 변환하는 API는 없다. 서버는 업체가 직접 입력한 금액의 공급가·부가세·합계를 계산하고, 표준견적과 비교한다.

## 4. 날짜 제안·변경·확정 공정표

```text
업체 확정 뒤:
  업체 GET /vendor/jobs/{deal_id}
  업체 GET /vendor/jobs/{deal_id}/dates/preview?start=...&end=...&crew=...
       → 작업일·겹침·필요 인원 미리보기(저장하지 않음)
  업체 POST /vendor/jobs/{deal_id}/dates
       → 날짜 제안(initial 또는 change)

  고객 GET /projects/{project_id}/schedule
       → 제안 ID, 최신 final_version 확인
  고객 POST /projects/{project_id}/deals/{deal_id}/dates/{proposal_id}/accept
       → 수락한 날짜 기록 + 확정 공정표 버전 증가
  고객 GET /projects/{project_id}/plan?kind=final

다른 날짜 요청:
  고객 POST /projects/{project_id}/deals/{deal_id}/date-requests
  업체 GET /vendor/jobs/{deal_id}
  업체 POST /vendor/jobs/{deal_id}/dates (필요 시 kind=change, request_id 등)
  고객 GET /projects/{project_id}/schedule → 새 제안 확인·수락
```

`POST .../dates/{proposal_id}/accept`는 `AcceptIn`의 **`seen_version`**을 본문으로 받는다. 이 값은 먼저 가져온 `GET /projects/{project_id}/schedule`의 최신 **확정 공정표 버전**이어야 한다. 아직 확정본이 없을 때는 `0`이다. 예시:

```json
{"seen_version": 0}
```

이 값은 **예시**이며 다른 사용자가 이미 공정 날짜를 수락했다면 최신 값과 일치하지 않을 수 있다. 고객이 수락을 누르기 전에는 확인 화면의 날짜·다른 공정 겹침을 보여 주고, 수락 응답에서 갱신된 공정표를 읽어야 한다. `409 plan_changed`(보았던 버전 불일치), `409 dates_changed`(업체가 새 제안), `409 overlap`(공사 기간 겹침), `409 invalid_state`(이미 수락/종료) 등은 최신 자료를 다시 읽고 처리한다.

업체가 처음 날짜를 올린 뒤 고객은 최대 **2회** 다른 날짜를 요청할 수 있다. 수락한 날짜를 바꾸는 경우에도 업체의 새 날짜 제안 → 고객 수락 단계가 필요하다. 날짜 미리보기는 상태를 저장하지 않으며, 제안 저장과 고객 확정은 서로 다른 API다.

현재 구현된 것은 위 날짜 제안·요청·고객 수락·겹침·버전 확인이다. **일정 MCP로 여러 업체 연기 영향을 자동 조정하고 재확정시키는 흐름**과 일반 백그라운드 worker는 구현되지 않았다.

## 5. 공사 중 추가 금액과 완료 확인

```text
업체 POST /files (kind=work_photo)       선택: 공사 사진 준비
업체 POST /vendor/jobs/{deal_id}/extras  추가 금액 기록(201)
고객 GET /projects/{project_id}/schedule 또는 /overview
고객 POST /projects/{project_id}/deals/{deal_id}/extras/{extra_id}/ack
     → ack="ok"(확인) 또는 ack="talk"(업체와 상의)

업체 POST /vendor/jobs/{deal_id}/done
고객 POST /projects/{project_id}/deals/{deal_id}/check
     → 확인 완료 또는 남은 일 표시
업체가 남은 일을 처리한 뒤 필요하면 다시 done
```

추가 금액은 고객에게 알려 주는 기록이며, 한 번 올린 행을 수정하지 않고 새로 올린다. 요청의 `entered_amount`·`vat_mode`에서 서버가 부가세·합계를 계산한다. 고객은 한 번 `ack`한 추가 금액을 다시 처리하려 하면 `409 invalid_state`가 날 수 있다. 작업 완료는 업체가 정해진 공사 마지막 날부터 올릴 수 있고, 고객은 업체 완료 표시 뒤 결과를 확인한다. `409 too_early`·`409 invalid_state` 등은 현재 상태에 맞게 처리한다.

사진 파일은 업로드한 주인/관리자 또는 해당 방문·견적·공사 맥락에서 권한 확인을 거치는 전용 GET으로만 접근한다. 파일 ID만으로 타인의 견적이나 공사 사진이 공개되지 않는다.

## 6. v2 화면: 계산, 상담, 저장

v2는 기존 `/projects` 업무 흐름과 별도 화면이다. `frontend/components/v2/data.ts`의 `SHOWN_CATS=["wallpaper"]` 때문에 **현재 v2 화면은 도배만 노출**한다. 백엔드의 `v2/quote`·`plan`·`check`·`quick-budget` 등은 로그인 세션에서 **입력을 계산**할 뿐, 대부분 `/v2/cases`에 자동 저장하지 않는다.

### 계산과 저장의 차이

- `POST /v2/quick-budget`: 빠른 예산 범위와 추가 질문을 계산. `POST /v2/quote`·`POST /v2/plan`: 입력에 대한 표준견적/공정표 계산. 금액·기간은 서버가 계산한다. 특히 `POST /v2/quote`는 평형·도면이 없어도 **32평 가정값** 등으로 계산할 수 있으므로 응답 `inp.assumed`에 표시된 가정을 확인하고, 실제 현장 확정 수치로 취급하지 않는다.
- `POST /v2/cases`: 고객이 선택한 `state`를 새 인테리어로 저장(최대 **30건**). `PUT /v2/cases/{case_id}`: 전체 선택 상태를 저장하면서 `quote_in`·`plan_in`이 있으면 서버에서 다시 계산한다. 금액·날짜 계산 실패 시 해당 계산 결과는 비워질 수 있다. `PATCH`는 제목만, `DELETE`는 한 건 삭제다.
- v2 화면은 사용자가 단계를 고를 때 지연 저장을 수행한다. 현재 `cases.ts`는 화면 상태를 모아 API로 전달하고, 서버는 `state JSONB`와 계산 결과를 따로 둔다. **응답이 보였다는 이유만으로 모든 추천 값을 확정 저장했다고 가정하지 않는다.**

### AI 한 턴과 화면 도구

```text
POST /v2/ask (kind="chat", message, 선택적으로 chat_id·profile·quote·plan)
  ├ 범위 밖 안내: 200 + done=true, gate="out" → LLM 호출·대화 저장 없음
  ├ 도구 없이 답 완료: 200 + done=true, text → 성공한 chat만 DB 저장
  ├ 모델/검사 실패: 200 + done=true, failed=true → 대화 저장 없음
  └ 브라우저 도구 호출: 200 + done=false, turn, tool_calls
       → 브라우저가 도구 수행 → POST /v2/ask/{turn_id} (results)
       → 다시 done=false(추가 도구) 또는 done=true(최종 답)
```

가장 작은 합성 질문 예:

```json
{"kind": "chat", "message": "도배 전에 무엇을 확인해야 하나요?"}
```

`done=false` 응답의 모양(구체 도구는 모델이 판단하므로 보장되지 않음):

```json
{
  "done": false,
  "turn": "예시-임시-턴-식별자",
  "tool_calls": [
    { "id": "예시-도구-ID", "name": "set_home_info", "arguments": { "pyeong": 32 } }
  ],
  "text": ""
}
```

브라우저는 서버가 보낸 `tool_calls`만 실행하고 **해당 `id`의 실제 실행 결과**를 문자열 `content`로 만들어 다음 요청에 돌려준다. `set_home_info`·`set_scope` 등은 고객 값 **제안**이며, 실제 화면은 `[담기]` 버튼을 눌러야 `apply()`로 보드에 반영한다. 도구 결과로 `saved=false`가 왔다고 해서 저장이 완료된 것이 아니다.

```json
{
  "results": [
    {"id": "예시-도구-ID", "content": "{\"ok\":true,\"saved\":false}"}
  ]
}
```

위 응답은 **형식 예시**이며 도구 결과를 실제로 실행하지 않고 합성해 전송하라는 뜻이 아니다. `turn`은 Redis에 약 10분 보관한다. 결과 ID가 맞지 않거나 중복되면 **422 invalid**, 이미 다른 요청이 같은 턴을 재개했거나 만료·소유자 불일치면 **404 not_found**다. 잘못된 ID의 422는 턴을 지우지 않으므로 실제 결과로 재시도할 수 있다.

최종 JSON에서 `failed=true`는 LLM/출력 검사 실패를 알리는 **응답 필드**이며, HTTP 오류(예: 422/409/503)와 다르다. `gate="out"`도 **HTTP 200 성공 응답** 안의 범위 밖 고정 안내다. 일반 상담(`kind=chat`)에서 성공한 최종 턴만 `chats`·`chat_messages`에 저장한다. `kind=quote_explanation|schedule` 설명 요청은 일반 채팅 이력에 저장하지 않는다. 기존 대화의 동시 질문은 DB `rev`로 검사해 늦은 저장 요청이 `409 conflict`가 될 수 있다.

세부 계약: [`V2AskIn`·`V2AskOut`](../../backend/app/v2/schemas.py) · [`ask_chat.py`](../../backend/app/v2/ask_chat.py) · [`ask.py`](../../backend/app/v2/ask.py) · [도구 목록](../../backend/app/v2/ask_tools.py) · [프런트 도구 실행](../../frontend/components/v2/ai/tools.ts) · [확인 버튼](../../frontend/components/v2/ai/ask.tsx).

## 현재 제한과 검증 범위

- v2 상담은 **완료한 JSON을 한 번에 반환**한다. 별도 `/chat/*` API·SSE 스트리밍은 없다.
- `mcp_server.py`는 빈 파일이며 일정 MCP 도구가 HTTP API로 등록돼 있지 않다.
- `worker.py`는 `ping`과 `DEMO_AUTO` 시연 자동응답만 등록했다. 일반 유료 LLM 설명·정기 단가 수집·메시지 발송이 자동 동작한다고 가정하지 않는다.
- 기준 `dev` CI 성공과 실제 브라우저 업무 시나리오/실모델 평가/AWS 배포 확인은 별개다. 이 안내는 코드 대조와 로컬 문서 검증을 근거로 하며, 외부 서버 전체 API QA를 수행한 결과가 아니다.
