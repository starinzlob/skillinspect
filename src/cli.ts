#!/usr/bin/env node
import { writeFileSync } from "node:fs";
import path from "node:path";
import { ruleCatalog } from "./catalog.js";
import { badgeSvg, formatGithub, formatText } from "./format.js";
import type { Profile } from "./types.js";
import { analyzeTarget } from "./workspace.js";

interface Options {
  command: "check" | "badge" | "rules" | "help";
  target: string;
  profile: Profile;
  format: "text" | "json" | "github";
  smoke: boolean;
  strict: boolean;
  ignoredRules: Set<string>;
  output?: string;
}

function help(): string {
  return `SkillProof — AI Agent Skill quality and security audit

Usage:
  skillproof check [path] [--profile codex|portable] [--format text|json|github]
  skillproof badge [path] [--output skillproof.svg]
  skillproof rules

Options:
  --smoke          Parse Bash, Node.js, and Python scripts without executing them
  --strict         Fail on warnings as well as errors
  --ignore <id>    Ignore a rule ID; repeatable
  --profile <name> codex or portable (default: codex)
  --format <name>  text, json, or github
  --output <path>  Write badge SVG to a file
  --help           Show this help
`;
}

function valueAfter(args: string[], index: number, flag: string): string {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value.`);
  return value;
}

function parseArgs(argv: string[]): Options {
  const rawCommand = argv[0] ?? "help";
  if (rawCommand === "--help" || rawCommand === "-h") {
    return { command: "help", target: ".", profile: "codex", format: "text", smoke: false, strict: false, ignoredRules: new Set() };
  }
  if (!["check", "badge", "rules", "help"].includes(rawCommand)) {
    throw new Error(`Unknown command: ${rawCommand}.`);
  }
  const command = rawCommand as Options["command"];
  let target = ".";
  let profile: Profile = "codex";
  let format: Options["format"] = "text";
  let smoke = false;
  let strict = false;
  let output: string | undefined;
  const ignoredRules = new Set<string>();

  let index = 1;
  if (argv[index] && !argv[index]?.startsWith("--")) {
    target = argv[index] ?? ".";
    index += 1;
  }
  for (; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") return { command: "help", target, profile, format, smoke, strict, ignoredRules };
    if (arg === "--smoke") { smoke = true; continue; }
    if (arg === "--strict") { strict = true; continue; }
    if (arg === "--profile") {
      const value = valueAfter(argv, index, arg);
      if (value !== "codex" && value !== "portable") throw new Error(`Unknown profile: ${value}.`);
      profile = value;
      index += 1;
      continue;
    }
    if (arg === "--format") {
      const value = valueAfter(argv, index, arg);
      if (value !== "text" && value !== "json" && value !== "github") throw new Error(`Unknown format: ${value}.`);
      format = value;
      index += 1;
      continue;
    }
    if (arg === "--ignore") {
      const id = valueAfter(argv, index, arg).toUpperCase();
      if (!ruleCatalog.some((definition) => definition.id === id)) {
        throw new Error(`Unknown rule ID: ${id}. Run \`skillproof rules\` to list valid IDs.`);
      }
      ignoredRules.add(id);
      index += 1;
      continue;
    }
    if (arg === "--output") {
      output = path.resolve(valueAfter(argv, index, arg));
      index += 1;
      continue;
    }
    throw new Error(`Unknown option: ${arg}.`);
  }
  return { command, target, profile, format, smoke, strict, ignoredRules, ...(output ? { output } : {}) };
}

export function run(argv = process.argv.slice(2)): number {
  const options = parseArgs(argv);
  if (options.command === "help") {
    console.log(help());
    return 0;
  }
  if (options.command === "rules") {
    for (const definition of ruleCatalog) {
      console.log(`${definition.id}\t${definition.severity}\t${definition.title}`);
    }
    return 0;
  }

  const report = analyzeTarget(options.target, {
    profile: options.profile,
    smoke: options.smoke,
    ignoredRules: options.ignoredRules,
  });
  if (options.command === "badge") {
    if (report.skills.length !== 1) throw new Error("Badge generation requires exactly one skill.");
    const skill = report.skills[0];
    if (!skill) throw new Error("No skill report available.");
    const svg = badgeSvg("SkillProof", skill.grade, skill.score);
    if (options.output) {
      writeFileSync(options.output, svg, "utf8");
      console.log(`✓ Wrote ${options.output}`);
    } else {
      process.stdout.write(svg);
    }
    return 0;
  }

  if (options.format === "json") console.log(JSON.stringify(report, null, 2));
  else if (options.format === "github") console.log(formatGithub(report));
  else console.log(formatText(report));

  const findings = report.skills.flatMap((skill) => skill.findings);
  const blocking = findings.some((item) =>
    item.severity === "critical" || item.severity === "error" || (options.strict && item.severity === "warning"),
  );
  return blocking ? 1 : 0;
}

try {
  process.exitCode = run();
} catch (error) {
  console.error(`SkillProof error: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
