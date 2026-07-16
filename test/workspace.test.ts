import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { analyzeTarget } from "../src/workspace.js";

test("discovers multiple nested skills", () => {
  const root = mkdtempSync(path.join(tmpdir(), "skillproof-workspace-"));
  try {
    for (const name of ["first-skill", "second-skill"]) {
      const skill = path.join(root, "skills", name);
      mkdirSync(skill, { recursive: true });
      writeFileSync(path.join(skill, "SKILL.md"), `---\nname: ${name}\ndescription: Inspect local files safely. Use when a user requests a focused read-only review of project artifacts.\n---\n\n# ${name}\n`, "utf8");
    }
    const report = analyzeTarget(root, { profile: "codex", smoke: false, ignoredRules: new Set() });
    assert.equal(report.summary.skills, 2);
    assert.equal(report.summary.averageScore, 100);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
