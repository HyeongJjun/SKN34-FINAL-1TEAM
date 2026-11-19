# 데이터 검증 기록

실제로 돌린 것만 적어요. 날짜 · 명령 · 결과(통과/실패, 숫자)를 그대로 남겨요. 실행 위치는 `C:\Workspace\SKN34\wt-v3`예요.

| 날짜 | 무엇 | 명령 · 방법 | 결과 | 남은 일 |
| --- | --- | --- | --- | --- |
| 2026-11-18 | 벽지 시장가 계산 | `python -X utf8 data/v3/scripts/wallpaper_price.py` | 실크 86,129원/평 · 합지 41,372원/평. 실견적 실크 614 · 합지 112건, 출처 8 · 8곳. 이상치 26행 | 반기마다 다시 돌림 |
| 2026-11-18 | 계산 방법 비교(출처 하나씩 빼기) | 같은 스크립트의 `estimator_check_loso` | 출처 중앙값 로그 오차(실크 / 합지): 묶은 중앙값 0.145 / 0.186 · 30건 상한 0.158 / 0.182 · √n 0.152 / 0.170 · 출처 중앙값의 중앙값 0.238 / 0.164. 행 오차 중앙값: 0.162 / 0.132 · 0.166 / 0.130 · 0.160 / 0.149 · 0.236 / 0.134 | 30건 상한을 고름(data-01) |
| 2026-11-18 | 실견적 원문 다시 열기 5건 | WebFetch로 원문 주소 | 숨고 J-096 금액 · 평형 · 등급 일치. 영진 C-259 금액 578만 원 일치, 평형은 행 51평 / 본문 바닥 48평으로 다름. 대동 N4-DD-0197은 트래픽 초과로 못 열림. 뽐뿌 B-068은 글자 깨짐. 디시 N4-DB-0046은 견적이 사진이라 숫자 못 봄(23평 올수리 턴키 견적인 것만 확인) | 영진 평형 확인 필요 |
| 2026-11-18 | 기준 단가 정리 | `python -X utf8 data/v3/scripts/refprice_2026.py` | 노임 31직종 + 평균 1줄, 품셈 10항목(쪽 글에 품 숫자가 있는지 확인 10/10 통과), 표준시장단가 10항목, 비교 18줄 | |
| 2026-11-18 | 노임 웹 대조 | yellowit 표(2026.1.1) · 유리지갑 표(2026.9.1)와 숫자 비교(스크립트 안 표) | 2026.1.1 19직종 모두 같음, 2026.9.1 12직종 모두 같음 | 도배공 · 내장공 2026.9.1 값은 웹으로 확인 못 함 |
| 2026-11-18 | 공휴일 | `python -X utf8 data/v3/scripts/holidays.py` | 46일, 요일 오류 0. `holidays.py`에 없는 평일 공휴일 4일, 두 목록 모두 없는 날 0, 공식에 없는 날 0 | 개발자: holidays.py 고치기 |
| 2026-11-18 | 면적 | `python -X utf8 data/v3/scripts/area.py` | 전용률 20곳 중앙값 0.760, 평면 20곳(35줄) 도배 면적 ÷ 공급 중앙값 2.194 | 민간 아파트 표본 없음 |
| 2026-11-18 | 지식 조각 원문 대조 7개 | 조각 요지와 `related_ref` 원문 조각을 나란히 읽음(하자 3 · 담보책임 1 · 행위허가 1 · 소음 1 · 실내공기질 1) | 숫자 · 조항 번호 모두 맞음. `kv3-defect-006`에 '봉투바름 들뜸 예외'가 없지만 `kv3-defect-007`에 있음 | |
| 2026-11-18 | 질문 표본 | 무작위 12개 읽기 + 출처 1쪽(클리앙 15973334) 다시 열기 | 원문을 옮긴 문장 없음, 출처 글과 질문 뜻이 맞음 | |
| 2026-11-18 | 묶음 점검 | `python -X utf8 data/v3/scripts/validate.py` | 문제 없음(종료 코드 0). 처음 돌렸을 때 날짜('1999. 9. 1.')를 문장 끝으로 센 1건이 걸려 세는 규칙을 고친 뒤 0 | 아래 표 |
| 2026-11-18 | 스크립트 린트 | `cd backend && uv run --no-sync ruff check ../data/v3/scripts --line-length 120` · `ruff format` | 처음 10건(안 쓰는 import · noqa 등) → 고친 뒤 통과, 5개 파일 포맷 | |
| 2026-11-18 | 하위 담당 자체 점검(보고 내용) | 지식 담당 · 질문 담당이 각자 돌린 점검 | 지식: 빈 칸 0 · id 중복 0 · 무작위 10조각 대조(문장 1곳 · 적용 대상 2곳 고침). 질문: 빈 칸 0 · 중복 0 · 기존 질문(questions_v5 6,042 · 질문세트_300 · 평가 세트 725)과 같은 글자 0 · 비슷도 0.72 이상 8개 고쳐 씀 | 이 줄은 보고를 옮긴 것이고 직접 다시 돌린 것은 위 `validate.py`예요 |

## `validate.py` 결과(2026-11-18)

| 묶음 | 무엇 | 결과 |
| --- | --- | --- |
| knowledge | 조각 수 | 190 |
| knowledge | 필수 10칸 빈 칸 수 | 0 |
| knowledge | id 중복 | 0 |
| knowledge | source_url 없는 행 | 0 |
| knowledge | 요지 문장 수 3~6 벗어남 | 0 |
| knowledge | 공종 · 주제 · 라이선스 값 밖 | 0 · 0 · 0 |
| knowledge | summary 같은 글자 중복 | 0 |
| knowledge | 공종별(최소) | 6 (dobae 18, mokgong 16, floor 6, tile 6, bath 6, kitchen 8, paint 6, film 6, electric 6, window 10, demolition 14, plumbing 12, common 76) |
| knowledge | 주제별 | defect 35, dispute 24, productivity 21, spec 19, contract 16, safety 15, guide 15, permit 10, air 10, noise 7, asbestos 7, license_biz 6, waste 5 |
| knowledge | verify별 | version_checked 106, repo_copy 57, web_opened 27 |
| knowledge | license별 | 공공저작물(저작권법 제7조, 법령 · 고시) 112, 확인 못 함(요지만) 58, 공공누리 제1유형 15, 공공누리 제4유형(요지만) 5 |
| knowledge/sources.csv | 문서 수 · doc_key 중복 | 74 · 0 |
| knowledge/sources.csv | chunk_count 합 = 조각 수 | 190 = 190 → 맞음 |
| knowledge/sources.csv | sources.csv에 없는 doc_key를 쓴 조각 | 0 |
| questions/dobae | 개수 · 빈 칸 · 값 밖 · 80자 초과 · 파일 안 중복 | 40 · 0 · 0 · 0 · 0 |
| questions/dobae | intent 종류 · 범위밖 · 가격 비율 | 9 · 2 · 15% |
| questions/mokgong | 개수 · 빈 칸 · 값 밖 · 80자 초과 · 파일 안 중복 | 39 · 0 · 0 · 0 · 0 |
| questions/mokgong | intent 종류 · 범위밖 · 가격 비율 | 8 · 2 · 13% |
| questions/floor | 개수 · 빈 칸 · 값 밖 · 80자 초과 · 파일 안 중복 | 38 · 0 · 0 · 0 · 0 |
| questions/floor | intent 종류 · 범위밖 · 가격 비율 | 9 · 2 · 5% |
| questions/tile | 개수 · 빈 칸 · 값 밖 · 80자 초과 · 파일 안 중복 | 38 · 0 · 0 · 0 · 0 |
| questions/tile | intent 종류 · 범위밖 · 가격 비율 | 9 · 2 · 8% |
| questions/bath | 개수 · 빈 칸 · 값 밖 · 80자 초과 · 파일 안 중복 | 38 · 0 · 0 · 0 · 0 |
| questions/bath | intent 종류 · 범위밖 · 가격 비율 | 9 · 2 · 11% |
| questions/kitchen | 개수 · 빈 칸 · 값 밖 · 80자 초과 · 파일 안 중복 | 36 · 0 · 0 · 0 · 0 |
| questions/kitchen | intent 종류 · 범위밖 · 가격 비율 | 9 · 2 · 8% |
| questions/paint | 개수 · 빈 칸 · 값 밖 · 80자 초과 · 파일 안 중복 | 36 · 0 · 0 · 0 · 0 |
| questions/paint | intent 종류 · 범위밖 · 가격 비율 | 9 · 2 · 6% |
| questions/film | 개수 · 빈 칸 · 값 밖 · 80자 초과 · 파일 안 중복 | 36 · 0 · 0 · 0 · 0 |
| questions/film | intent 종류 · 범위밖 · 가격 비율 | 9 · 2 · 8% |
| questions/electric | 개수 · 빈 칸 · 값 밖 · 80자 초과 · 파일 안 중복 | 38 · 0 · 0 · 0 · 0 |
| questions/electric | intent 종류 · 범위밖 · 가격 비율 | 9 · 2 · 3% |
| questions/window | 개수 · 빈 칸 · 값 밖 · 80자 초과 · 파일 안 중복 | 40 · 0 · 0 · 0 · 0 |
| questions/window | intent 종류 · 범위밖 · 가격 비율 | 9 · 2 · 5% |
| questions/demolition | 개수 · 빈 칸 · 값 밖 · 80자 초과 · 파일 안 중복 | 36 · 0 · 0 · 0 · 0 |
| questions/demolition | intent 종류 · 범위밖 · 가격 비율 | 9 · 2 · 14% |
| questions/plumbing | 개수 · 빈 칸 · 값 밖 · 80자 초과 · 파일 안 중복 | 38 · 0 · 0 · 0 · 0 |
| questions/plumbing | intent 종류 · 범위밖 · 가격 비율 | 9 · 2 · 8% |
| questions/common | 개수 · 빈 칸 · 값 밖 · 80자 초과 · 파일 안 중복 | 40 · 0 · 0 · 0 · 0 |
| questions/common | intent 종류 · 범위밖 · 가격 비율 | 7 · 4 · 15% |
| questions(전체) | 질문 수 | 493 |
| questions(전체) | id 중복 · 파일 사이 글자 중복 | 0 · 0 |
| questions(전체) | source_url 없는 행 | 0 |
| questions(전체) | intent | 공법 113, 하자 109, 자재 76, 순서 46, 가격 45, 계약 33, 범위밖 28, 기간 27, 업체 16 |
| questions(전체) | expect | answer 423, ask_back 42, out_of_scope 28 |
| questions(전체) | source_check | opened 358, existing_collection 113, search_snippet 22 |
| questions(전체) | difficulty 1 · 2 · 3 | 142 · 262 · 89 |
| questions(전체) | split dev · heldout | 330 · 163 |
| questions(전체) | split 해시 규칙과 다른 행 | 0 |
| questions/sources.csv | 주소 수 · n_questions 합 | 219 · 493 |
| questions/sources.csv | sources.csv에 없는 source_url을 쓴 질문 | 0 |
| wallpaper_price | 실견적 행 · id 중복 · 주소 없는 행 | 761 · 0 · 0 |
| wallpaper_price | 이상치 표시 | 없음 735, source_fence 23, global_fence 3 |
| wallpaper_price | 평당 시공가가 있는 출처 수(웹 포함) | 14 |
| wallpaper_price | 출처표 행 · 주소 없는 행 | 33 · 0 |
| wallpaper_price | 웹 자료 행 · 주소 없는 행 | 21 · 0 |
| wallpaper_price | 실크 대표값(평당) · 25~75% | 86,129 · 73,471~104,545 |
| wallpaper_price | 합지 대표값(평당) · 25~75% | 41,372 · 36,917~46,875 |
| refprice_2026/wages_2026.csv | 행 · 출처 칸 빈 행 | 32 · 0 (source 0, source_file 0, checked_at 0) |
| refprice_2026/pumsem_2026.csv | 행 · 출처 칸 빈 행 | 10 · 0 (source 0, source_file 0, checked_at 0) |
| refprice_2026/std_market_price.csv | 행 · 출처 칸 빈 행 | 10 · 0 (source_2025h2 0, checked_at 0) |
| refprice_2026/comparison.csv | 행 · 출처 칸 빈 행 | 18 · 0 (v3_source 0, repo_source 0, checked_at 0) |
| holidays | 행 · 날짜 중복 · 출처 없는 행 | 46 · 0 · 0 |
| holidays | 요일 확인 오류 | 0 |
| holidays | holidays.py에 없는 평일 공휴일 | 2026-05-01 노동절 · 2026-07-17 제헌절 · 2027-05-03 대체공휴일(노동절) · 2027-07-19 대체공휴일(제헌절) |
| holidays | 저장소 두 목록 다 없는 평일 공휴일 | 없음 |
| area/exclusive_ratio.csv | 행 · 출처 칸 빈 행 | 38 · 0 (source_url 0) |
| area/plan_paper_area.csv | 행 · 출처 칸 빈 행 | 35 · 0 (source_url 0) |

문제 없음

## 못 한 검증

- 웹 검색 한도(이 턴, 전체 에이전트 공유 200회)가 다 차서 영어 검색 · 추가 출처 검색은 못 했어요.
- 대한건설협회 임금 보고서 · 2026 표준시장단가 · 조달청 벽지 가격 원문은 직접 열지 못했어요(data-sources.md '확인 못 한 것').
- 테스트 DB · 백엔드 테스트는 이 역할 범위 밖이라 돌리지 않았어요. 스크립트는 `backend/app`의 순수 계산 함수만 불러요.
