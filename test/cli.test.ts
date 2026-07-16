import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

const cli = fileURLToPath(new URL("../src/cli.js", import.meta.url));
const repository = fileURLToPath(new URL("../..", import.meta.url));

function execute(...args: string[]) {
  return spawnSync(process.execPath, [cli, ...args], { encoding: "utf8", cwd: repository });
}

test("CLI checks good and broken fixtures and writes a badge", () => {
  const good = execute("check", "examples/good-skill", "--strict", "--smoke");
  assert.equal(good.status, 0, good.stdout + good.stderr);
  assert.match(good.stdout, /A \(100\/100\)/);

  const broken = execute("check", "examples/broken-skill", "--format", "json");
  assert.equal(broken.status, 1);
  const parsed = JSON.parse(broken.stdout) as { skills: Array<{ grade: string }> };
  assert.equal(parsed.skills[0]?.grade, "F");

  const directory = mkdtempSync(path.join(tmpdir(), "skillinspect-badge-"));
  try {
    const output = path.join(directory, "badge.svg");
    const badge = execute("badge", "examples/good-skill", "--output", output);
    assert.equal(badge.status, 0, badge.stderr);
    assert.equal(existsSync(output), true);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
