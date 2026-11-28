// 원하는 공사 공정 탭 시험(#234): pnpm test:unit
import assert from "node:assert/strict";
import { test } from "node:test";
import { badTabs, errorTab } from "./workTab.ts";

test("고를 칸이 있는 탭에 점: 목공 할 곳은 목공 탭, 벽지 · 공간 · 면은 도배 탭, 다른 칸은 탭과 상관없어요", () => {
  assert.deepEqual([...badTabs(["mokgong"], true)], ["mokgong"]);
  assert.deepEqual([...badTabs(["grade", "spaces", "faces"], true)], ["dobae"]);
  assert.deepEqual([...badTabs(["region", "area", "budget"], true)], []);
  assert.deepEqual([...badTabs([], false)], ["dobae"]); // 도배를 끄면 도배 탭
});

test("제출할 때: 다른 탭에만 고를 칸이 있으면 그 탭으로 옮겨요", () => {
  assert.equal(errorTab(["mokgong"], true, "dobae"), "mokgong"); // 도배 탭에서 눌렀는데 목공 할 곳이 비었음
  assert.equal(errorTab(["grade"], true, "mokgong"), "dobae");
  assert.equal(errorTab(["mokgong", "grade"], true, "dobae"), "dobae"); // 보고 있는 탭에도 있으면 그대로
  assert.equal(errorTab(["mokgong", "grade"], true, "floor"), "mokgong"); // 아니면 공사 순서대로 첫 탭
  assert.equal(errorTab(["region"], true, "dobae"), null); // 탭 밖 칸만이면 옮기지 않아요
});
