"""바닥 공종 폴더(specialists/floor): 설정 · 검색 · 연결. DB · LLM 호출 없이 검증한다."""

from v3_kb import repo_kb

from app.agent.v3 import answer, trades
from app.agent.v3.specialists import registered


def test_floor_folder_replaces_builtin_setting():
    s = trades.BY_CODE["floor"]
    assert [x.code for x in trades.SPECS].count("floor") == 1
    assert s.ko == "바닥" and s.depth == "knowledge" and not s.calc  # 계산 엔진이 붙기 전
    assert s.check_where == "실측 때 바닥 업체"
    assert s.slots == ()  # 되묻기 칸은 쓰는 곳(바닥 되묻기 도구)과 같이 더해요
    sp = registered()["floor"]
    assert sp.retrieve and sp.run and sp.prompt_path and sp.prompt_path.is_file()


def test_floor_words_route_new_customer_terms():
    assert trades.trades_in("PVC 타일이랑 장판 뭐가 나아요?")[0] == "floor"
    assert trades.trades_in("헤링본 마루로 하고 싶어요")[0] == "floor"
    assert trades.trades_in("현관 바닥 타일 바꾸려고요") == ["tile"]  # 바닥 타일은 타일 공종
    assert trades.trades_in("PVC 장판 두께는요?") == ["floor"]


def test_floor_words_skip_wall_tile_and_sheet_film():
    # 헤링본 · PVC 시트는 벽 타일 · 시트지(필름)에도 써서 바닥으로 잡지 않아요(PR 리뷰)
    assert trades.trades_in("헤링본 벽 타일 붙이려는데 줄눈은 어떻게 해요?") == ["tile"]
    assert "floor" not in trades.trades_in("욕실 벽에 헤링본 타일 깔면 비싸요?")
    for q in ("주방 상부장에 PVC 시트지 붙여도 돼요?", "붙박이장 PVC 시트지 들떴어요",
              "싱크대 문짝 PVC 시트 필름 시공 얼마예요?"):  # fmt: skip
        got = trades.trades_in(q)
        assert got[0] == "film" and "floor" not in got


def _record(monkeypatch):
    original = answer.search3.search
    calls = []

    def record(ix, q, **kwargs):
        calls.append((q, kwargs.get("policy_text"), kwargs["trades"]))
        return original(ix, q, **kwargs)

    monkeypatch.setattr(answer.search3, "search", record)
    return calls


def test_floor_search_uses_floor_weight(monkeypatch):
    calls = _record(monkeypatch)
    q = "데코타일 직접 붙여도 돼요?"
    answer.search(repo_kb(), q, "floor")
    assert calls == [(q, None, ["floor"])]  # 질문 그대로 · 바닥 공종 무게


def test_floor_source_data_has_own_refs_docs_and_trades():
    kb = repo_kb()
    refs = [r for r in kb.ix.by_ref if 17001 <= int(r[1:]) <= 17999]
    nums = sorted(int(r[1:]) for r in refs)
    assert (
        len(nums) == 395 and nums[0] == 17001 and nums[-1] < 20001
    )  # 시공일지 · v3 지식과 안 겹침
    kcs = kb.ix.by_ref["K17001"]
    assert kcs.doc.kind in ("kcs", "official") and "바닥재" in kcs.chunk.trades + ("타일",)
    assert (
        len({kb.ix.by_ref[r].chunk.doc for r in refs}) == 17
    )  # 출처 문서마다 하나(파일 하나가 문서 하나가 아님)
