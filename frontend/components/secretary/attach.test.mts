// 재재 사진 · 문서 버튼 대상 고르기 시험(#181): pnpm test:unit
import assert from "node:assert/strict";
import { test } from "node:test";
import { attachTargets } from "./attach.ts";

test("채팅이 열린 업체만, 확정 업체 먼저, 같은 채팅은 한 번", () => {
  assert.deepEqual(attachTargets(null, []), []);
  assert.deepEqual(attachTargets(null, [{ vendor_name: "결도배", thread_id: null }]), []); // 채팅 없는 요청은 빼요
  const got = attachTargets({ vendor_name: "마루와벽", thread_id: "t1" }, [
    { vendor_name: "결도배", thread_id: "t2" },
    { vendor_name: "마루와벽", thread_id: "t1" },
  ]);
  assert.deepEqual(got.map((x) => x.label), ["마루와벽 채팅에서 사진 보내기", "결도배 채팅에서 사진 보내기"]);
  assert.equal(got[0].href, "/chat/t1");
  assert.equal(attachTargets(null, [{ vendor_name: "가", thread_id: "a/b" }])[0].href, "/chat/a%2Fb");
});
