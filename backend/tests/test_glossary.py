"""쉬운 용어 사전: 모양 · 수 · 숫자 규칙 · 근거 · 글에서 용어 찾기."""

import re
from collections import Counter

from v3_kb import repo_index

from app.knowledge import glossary
from app.knowledge.cards import DOC_REFS

G = glossary.load()
MONEY_OR_PERIOD = re.compile(r"\d[\d,.]*\s*(?:만\s*원|천\s*원|억\s*원|억|원|일|주일|주|개월|%)")


def test_has_about_fifty_terms_in_main_groups():
    assert 50 <= len(G) <= 80
    by = Counter(t.trade for t in G)
    assert by["공통"] >= 20 and by["목공"] >= 10 and by["도배"] >= 5


def test_names_are_unique_across_terms_and_other_names():
    names = Counter(n for t in G for n in t.names())
    assert not [n for n, k in names.items() if k > 1]


def test_easy_meaning_has_no_money_or_period_number():
    for t in G:
        assert not MONEY_OR_PERIOD.search(t.easy), (t.term, t.easy)


def test_every_cite_is_a_known_chunk_or_screen_text():
    ix = repo_index()
    for t in G:
        for r in t.cites:
            assert r in ix.by_ref or r in DOC_REFS, (t.term, r)


def test_easy_meaning_must_be_one_haeyo_sentence():
    row = G[0].model_dump(mode="json")
    for bad in ("두 문장이에요. 이렇게요.", "해요체가 아니다."):
        try:
            glossary.Term.model_validate({**row, "easy": bad})
        except ValueError:
            continue
        raise AssertionError(bad)


def test_terms_in_prefers_longer_name_and_keeps_order():
    found = glossary.terms_in("마이너스 몰딩이랑 평몰딩은 뭐가 달라요? 몰딩 위에 젯소를 발라요")
    assert [t.term for t in found] == ["마이너스 몰딩", "평몰딩", "몰딩", "젯소"]


def test_terms_in_matches_other_names_and_one_letter_term_only_alone():
    found = [t.term for t in glossary.terms_in("빠데로 메우고 3품 들었어요. 제품 설명")]
    assert found == ["퍼티", "품"]
    assert glossary.terms_in("이 제품은 좋아요") == []


def test_one_letter_term_skips_words_that_start_with_it():
    assert glossary.terms_in("도배 품질을 높이고 재료 품목과 수량을 봐요") == []
    assert [t.term for t in glossary.terms_in("품은 몇 개예요? 4품이에요")] == ["품"]
