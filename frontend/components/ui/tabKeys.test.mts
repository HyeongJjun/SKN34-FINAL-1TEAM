// 공정 탭 키보드 시험(#234): pnpm test:unit
import assert from "node:assert/strict";
import { test } from "node:test";
import { nextTab } from "./tabKeys.ts";

test("← → 는 돌아가며, Home · End는 처음 · 끝, 다른 키는 그대로", () => {
  assert.equal(nextTab(0, 2, "ArrowRight"), 1);
  assert.equal(nextTab(1, 2, "ArrowRight"), 0);
  assert.equal(nextTab(0, 3, "ArrowLeft"), 2);
  assert.equal(nextTab(1, 3, "Home"), 0);
  assert.equal(nextTab(0, 3, "End"), 2);
  assert.equal(nextTab(0, 3, "Enter"), -1);
  assert.equal(nextTab(-1, 3, "ArrowRight"), -1); // 고른 탭을 못 찾으면 안 움직여요
});
