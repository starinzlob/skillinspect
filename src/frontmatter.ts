import { LineCounter, parseDocument } from "yaml";
import type { ParsedSkill } from "./types.js";

export function parseSkillDocument(content: string): ParsedSkill {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  if (lines[0]?.trim() !== "---") {
    return {
      data: {},
      body: content,
      bodyStartLine: 1,
      keys: [],
      errors: [{ message: "SKILL.md must start with YAML frontmatter.", line: 1 }],
    };
  }

  const closingIndex = lines.slice(1).findIndex((line) => line.trim() === "---");
  if (closingIndex === -1) {
    return {
      data: {},
      body: "",
      bodyStartLine: lines.length,
      keys: [],
      errors: [{ message: "Frontmatter is missing its closing --- line.", line: 1 }],
    };
  }

  const end = closingIndex + 1;
  const yamlSource = lines.slice(1, end).join("\n");
  const lineCounter = new LineCounter();
  const document = parseDocument(yamlSource, { lineCounter, prettyErrors: false });
  const errors = document.errors.map((error) => {
    const position = error.pos[0];
    const line = typeof position === "number" ? lineCounter.linePos(position).line + 1 : undefined;
    return { message: error.message, ...(line ? { line } : {}) };
  });
  let data: Record<string, unknown> = {};
  if (errors.length === 0) {
    const value = document.toJS() as unknown;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      data = value as Record<string, unknown>;
    } else {
      errors.push({ message: "Frontmatter must be a YAML mapping.", line: 2 });
    }
  }

  return {
    data,
    body: lines.slice(end + 1).join("\n"),
    bodyStartLine: end + 2,
    keys: Object.keys(data),
    errors,
  };
}
