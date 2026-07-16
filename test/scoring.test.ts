import assert from "node:assert/strict";
import test from "node:test";
import { gradeScore, scoreFindings } from "../src/scoring.js";

test("scores findings by severity and assigns grades", () => {
  const score = scoreFindings([
    { ruleId: "SP100", severity: "critical", title: "x", message: "x", location: { path: "SKILL.md" } },
    { ruleId: "SP006", severity: "warning", title: "x", message: "x", location: { path: "SKILL.md" } },
  ]);
  assert.equal(score, 65);
  assert.equal(gradeScore(score), "D");
  assert.equal(gradeScore(95), "A");
});
