import assert from "node:assert/strict";
import test from "node:test";
import { parseSkillDocument } from "../src/frontmatter.js";

test("parses folded YAML frontmatter and body", () => {
  const parsed = parseSkillDocument(`---
name: sample-skill
description: >-
  Analyze sample inputs and explain failures.
  Use when a user requests a sample audit.
---

# Sample

Inspect the input.`);

  assert.equal(parsed.errors.length, 0);
  assert.equal(parsed.data.name, "sample-skill");
  assert.match(String(parsed.data.description), /sample audit/);
  assert.match(parsed.body, /# Sample/);
});

test("reports a missing frontmatter delimiter", () => {
  const parsed = parseSkillDocument("# Missing frontmatter");
  assert.equal(parsed.errors.length, 1);
  assert.match(parsed.errors[0]?.message ?? "", /must start/);
});
