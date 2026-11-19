"""읍면동 · 이웃 구 자료(B6) 확인. 9판이 쓰는 서울 동북권 5개 구만 있어요."""

from app.shared import regions
from app.shared.regions import EMD, NEIGHBORS, SGG, SGG_CODE, emd_list, is_emd, is_region, neighbors

FIVE = {"노원구", "도봉구", "강북구", "성북구", "중랑구"}


def test_emd_codes_follow_sgg_codes():
    assert {g for _, g in EMD} == FIVE and set(EMD) == set(SGG_CODE)
    for key, items in EMD.items():
        assert is_region(*key)
        gu = SGG_CODE[key]
        assert len(gu) == 10 and gu.isdigit() and gu.endswith("00000")
        codes = [c for c, _ in items]
        names = [n for _, n in items]
        assert codes == sorted(codes) and len(set(codes)) == len(codes)
        assert len(set(names)) == len(names)
        for c, n in items:
            # 법정동코드 10자리 = 시 · 도 2 + 시 · 군 · 구 3 + 읍면동 3 + 리 2
            assert len(c) == 10 and c.isdigit() and c[:5] == gu[:5] and c.endswith("00")
            assert n.endswith(("동", "가")), n
    assert len(EMD[("seoul", "성북구")]) == 39


def test_9th_draft_addresses_are_known():
    # 9판 화면에 나오는 주소: 노원구 상계동 · 월계동, 도봉구 창동
    for gu, dong in [
        ("노원구", "상계동"),
        ("노원구", "월계동"),
        ("도봉구", "창동"),
        ("강북구", "수유동"),
    ]:
        assert is_emd("seoul", gu, dong), (gu, dong)
    assert not is_emd("seoul", "노원구", "창동")
    assert {"code": "1135010500", "name": "상계동"} in emd_list("seoul", "노원구")


def test_unknown_gu_has_no_emd_or_neighbors():
    assert emd_list("seoul", "마포구") == [] and not is_emd("seoul", "마포구", "합정동")
    assert neighbors("seoul", "마포구") == []
    assert emd_list("nowhere", "노원구") == []


def test_neighbors_are_real_regions_and_symmetric():
    assert neighbors("seoul", "강북구")[:3] == [
        ("seoul", "도봉구"),
        ("seoul", "노원구"),
        ("seoul", "성북구"),
    ]
    for key, items in NEIGHBORS.items():
        assert key not in items and len(set(items)) == len(items)
        for sido, sgg in items:
            assert sgg in SGG[sido], (key, sgg)
            if (sido, sgg) in NEIGHBORS:  # 자료가 있는 구끼리는 서로 이웃이에요
                assert key in NEIGHBORS[(sido, sgg)], (key, sgg)
    assert ("gyeonggi", "의정부시") in neighbors("seoul", "노원구")
    assert regions.EMD_SOURCE and regions.NEIGHBOR_SOURCE
