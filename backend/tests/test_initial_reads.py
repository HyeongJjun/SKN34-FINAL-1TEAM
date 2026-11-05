"""표준견적서 · 예상 공정표의 최초 생성과 집 정보 변경 후 동시 조회 회귀 검사."""

import asyncio
from concurrent.futures import ThreadPoolExecutor

import pytest

from app.quote import service as quote_service
from app.quote.schemas import StandardOut
from app.schedule import service as schedule_service
from app.schedule.schemas import PlanOut
from tests.conftest import query
from tests.helpers import signup
from tests.test_project import body


@pytest.mark.parametrize("endpoint", ["standard", "plan"])
@pytest.mark.parametrize("revision", [1, 2])
def test_concurrent_reads_return_one_complete_version(api, monkeypatch, endpoint, revision):
    signup(api)
    p = api.post("/projects", json=body()).json()
    url = f"/projects/{p['id']}/{endpoint}"
    if revision == 2:
        assert api.get(url).status_code == 200
        assert api.patch(f"/projects/{p['id']}", json=body(occupied=False)).status_code == 200

    service = quote_service if endpoint == "standard" else schedule_service
    original = service._latest
    barrier = asyncio.Barrier(4)
    reads = 0

    async def same_snapshot(*args):
        nonlocal reads
        result = await original(*args)
        reads += 1
        if reads <= 4:
            # 모두 같은 저장 전 버전을 읽은 뒤 INSERT하도록 해 경쟁을 반드시 일으킨다.
            await asyncio.wait_for(barrier.wait(), timeout=10)
        return result

    monkeypatch.setattr(service, "_latest", same_snapshot)
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(lambda _: api.get(url), range(4)))
    assert [r.status_code for r in results] == [200] * 4
    payload = results[0].json()
    schema = StandardOut if endpoint == "standard" else PlanOut
    for result in results:
        # DB의 numeric 소수 자릿수('10.0' / '10')는 값으로 비교한다.
        assert schema.model_validate(result.json()) == schema.model_validate(payload)
    if endpoint == "standard":
        assert len(payload["trades"]) == 2
        assert all(t["version"] == revision and t["lines"] for t in payload["trades"])
        assert len(query("select id from standard_quotes")) == 2 * revision
    else:
        assert payload["version"] == revision and payload["blocks"] and payload["days"]
        assert len(query("select id from plans")) == revision
