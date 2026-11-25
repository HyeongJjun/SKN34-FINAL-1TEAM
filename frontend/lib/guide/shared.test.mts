// 백과 용어 칸 주소(withTerm) 시험: pnpm test:unit
// 보던 화면 주소에 ?term=만 붙이고 빼요. 다른 검색어는 그대로예요
import assert from "node:assert/strict";
import { test } from "node:test";
import { withTerm } from "./shared.ts";

test("보던 화면 주소에 ?term=만 붙여요", () => {
  assert.equal(withTerm("/guide", "", "퍼티"), "/guide?term=%ED%8D%BC%ED%8B%B0");
  assert.equal(withTerm("/guide/how-it-goes", "", "천장-몰딩"), `/guide/how-it-goes?term=${encodeURIComponent("천장-몰딩")}`);
  // 용어 사전 갈래 · 그림 거르기는 그대로, 열린 용어는 바꿔 써요
  assert.equal(withTerm("/guide/terms", "trade=dobae&img=1", "초배"), `/guide/terms?trade=dobae&img=1&term=${encodeURIComponent("초배")}`);
  assert.equal(withTerm("/guide/terms", "trade=dobae&term=a", "b"), "/guide/terms?trade=dobae&term=b");
});

test("닫을 때는 ?term=만 빼요", () => {
  assert.equal(withTerm("/guide/how-it-goes", "term=a"), "/guide/how-it-goes");
  assert.equal(withTerm("/guide/terms", "trade=dobae&term=a&img=1"), "/guide/terms?trade=dobae&img=1");
  assert.equal(withTerm("/guide/steps", ""), "/guide/steps");
});
