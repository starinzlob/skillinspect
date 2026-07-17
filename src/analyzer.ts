import { existsSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { parseDocument } from "yaml";
import { emptyCapabilityManifest, inferCapabilities } from "./capabilities.js";
import { rule } from "./catalog.js";
import { listSkillFiles, type SkillFile } from "./discovery.js";
import { parseSkillDocument } from "./frontmatter.js";
import { gradeScore, scoreFindings } from "./scoring.js";
import type { CheckOptions, Finding, Location, SkillReport } from "./types.js";

const textExtensions = new Set([
  ".md", ".mdc", ".txt", ".yaml", ".yml", ".json", ".toml", ".sh", ".bash",
  ".zsh", ".py", ".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".html", ".css",
]);

function finding(ruleId: string, message: string, location: Location): Finding {
  const definition = rule(ruleId);
  return {
    ruleId,
    severity: definition.severity,
    title: definition.title,
    message,
    location,
    remediation: definition.remediation,
  };
}

function isTextFile(file: SkillFile): boolean {
  if (file.size > 1024 * 1024) return false;
  if (path.basename(file.relative) === "SKILL.md") return true;
  return textExtensions.has(path.extname(file.relative).toLowerCase());
}

function lineOf(content: string, index: number): number {
  return content.slice(0, index).split("\n").length;
}

function referencesFrom(content: string): Array<{ value: string; line: number }> {
  const references: Array<{ value: string; line: number }> = [];
  const seen = new Set<string>();
  const patterns = [
    /\[[^\]]*\]\(([^)]+)\)/g,
    /`((?:scripts|references|assets)\/[^`]+)`/g,
  ];
  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) {
      const value = match[1]?.trim();
      if (!value || match.index === undefined) continue;
      const line = lineOf(content, match.index);
      const key = `${value}:${line}`;
      if (!seen.has(key)) {
        seen.add(key);
        references.push({ value, line });
      }
    }
  }
  return references;
}

function inspectReferences(root: string, content: string): Finding[] {
  const findings: Finding[] = [];
  for (const reference of referencesFrom(content)) {
    let value = reference.value.split(/\s+["']/)[0] ?? reference.value;
    value = value.split("#")[0] ?? value;
    if (!value || /^(?:https?:|mailto:|data:|#)/i.test(value) || /[<>{}*]/.test(value)) continue;
    try {
      value = decodeURIComponent(value);
    } catch {
      // Leave malformed escapes to the missing-resource check.
    }
    const resolved = path.resolve(root, value);
    const inside = resolved === root || resolved.startsWith(root + path.sep);
    if (!inside) {
      findings.push(finding("SP011", `Reference leaves the skill directory: ${reference.value}`, { path: "SKILL.md", line: reference.line }));
    } else if (!existsSync(resolved)) {
      findings.push(finding("SP010", `Referenced resource does not exist: ${reference.value}`, { path: "SKILL.md", line: reference.line }));
    }
  }
  return findings;
}

function inspectOpenAiMetadata(root: string, skillName: string): Finding[] {
  const relative = "agents/openai.yaml";
  const absolute = path.join(root, relative);
  if (!existsSync(absolute)) return [];
  const content = readFileSync(absolute, "utf8");
  const document = parseDocument(content);
  if (document.errors.length > 0) {
    return [finding("SP012", `agents/openai.yaml is invalid YAML: ${document.errors[0]?.message ?? "unknown error"}`, { path: relative, line: 1 })];
  }
  const data = document.toJS() as { interface?: Record<string, unknown> } | null;
  const ui = data?.interface;
  const problems: string[] = [];
  if (!ui || typeof ui !== "object") problems.push("missing interface mapping");
  const short = ui?.short_description;
  if (typeof short !== "string" || short.length < 25 || short.length > 64) {
    problems.push("short_description must be 25-64 characters");
  }
  const prompt = ui?.default_prompt;
  if (typeof prompt !== "string" || !prompt.includes(`$${skillName}`)) {
    problems.push(`default_prompt must mention $${skillName}`);
  }
  return problems.length
    ? [finding("SP012", problems.join("; "), { path: relative, line: 1 })]
    : [];
}

function inspectSecurity(root: string, files: SkillFile[]): Finding[] {
  const findings: Finding[] = [];
  for (const file of files) {
    if (file.isSymlink) {
      let real: string | undefined;
      try { real = realpathSync(file.absolute); } catch { real = undefined; }
      if (!real || !(real === root || real.startsWith(root + path.sep))) {
        findings.push(finding("SP105", `Symlink resolves outside the skill: ${file.relative}`, { path: file.relative }));
      }
      continue;
    }
    if ((file.mode & 0o002) !== 0) {
      findings.push(finding("SP106", `File is writable by every local user: ${file.relative}`, { path: file.relative }));
    }
    if (!isTextFile(file)) continue;
    const content = readFileSync(file.absolute, "utf8");
    const lines = content.split(/\r?\n/);
    lines.forEach((text, index) => {
      const location = { path: file.relative, line: index + 1 };
      if (/(?:sk-[A-Za-z0-9_-]{16,}|ghp_[A-Za-z0-9]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|(?:api[_ -]?key|token|secret)\s*[:=]\s*["']?[A-Za-z0-9_./+-]{12,})/i.test(text)) {
        findings.push(finding("SP100", "A credential-like value appears in this file; the value is intentionally redacted.", location));
      }
      if (/\b(?:curl|wget)\b[^|\n]*\|\s*(?:sudo\s+)?(?:ba)?sh\b/i.test(text)) {
        findings.push(finding("SP101", "A remote response is piped directly into a shell.", location));
      }
      if (/(?:\benv\b|\bprintenv\b|\$\{?(?:TOKEN|API_KEY|SECRET|PASSWORD))[^\n|]*\|?[^\n]*(?:curl|wget)|(?:curl|wget)[^\n]*(?:\$\{?(?:TOKEN|API_KEY|SECRET|PASSWORD))/i.test(text)) {
        findings.push(finding("SP103", "Environment or credential data may be sent to a remote endpoint.", location));
      }
      if (/\brm\s+-[a-zA-Z]*r[a-zA-Z]*f[^\n]*(?:\/|\$HOME|~)|\bgit\s+reset\s+--hard\b|\bchmod\s+777\b|\bmkfs(?:\.|\s)|\bdd\s+[^\n]*\bof=\/dev\//i.test(text)) {
        findings.push(finding("SP102", "A destructive or difficult-to-reverse command is present.", location));
      }
      if (/\/(?:Users|home)\/[A-Za-z0-9._-]+\//.test(text)) {
        findings.push(finding("SP104", "A user-specific absolute path reduces portability.", location));
      }
    });
  }
  return findings;
}

function inspectScriptSyntax(root: string, files: SkillFile[]): Finding[] {
  const findings: Finding[] = [];
  for (const file of files) {
    if (file.isSymlink || !file.relative.startsWith("scripts/")) continue;
    const extension = path.extname(file.relative).toLowerCase();
    let command: string | undefined;
    let args: string[] = [];
    if ([".sh", ".bash", ".zsh"].includes(extension)) {
      command = "bash";
      args = ["-n", file.absolute];
    } else if ([".js", ".mjs", ".cjs"].includes(extension)) {
      command = process.execPath;
      args = ["--check", file.absolute];
    } else if (extension === ".py") {
      command = "python3";
      args = ["-c", "import ast,sys; ast.parse(open(sys.argv[1], encoding='utf-8').read())", file.absolute];
    }
    if (!command) continue;
    const result = spawnSync(command, args, { encoding: "utf8", timeout: 10_000 });
    if (result.status !== 0) {
      const detail = (result.stderr || result.stdout || "syntax check failed").trim().split("\n").slice(-1)[0];
      findings.push(finding("SP200", `${file.relative}: ${detail}`, { path: file.relative, line: 1 }));
    }
    const content = readFileSync(file.absolute, "utf8");
    if ((file.mode & 0o111) !== 0 && !content.startsWith("#!")) {
      findings.push(finding("SP201", `${file.relative} is executable but has no interpreter shebang.`, { path: file.relative, line: 1 }));
    }
  }
  return findings;
}

export function analyzeSkill(rootInput: string, options: CheckOptions): SkillReport {
  const root = path.resolve(rootInput);
  const skillFile = path.join(root, "SKILL.md");
  if (!existsSync(skillFile)) {
    const findings = [finding("SP001", `No SKILL.md found at ${root}.`, { path: "SKILL.md" })];
    return { root, name: path.basename(root), profile: options.profile, score: 70, grade: "C", filesScanned: 0, findings, capabilities: emptyCapabilityManifest() };
  }

  const content = readFileSync(skillFile, "utf8");
  const parsed = parseSkillDocument(content);
  const files = listSkillFiles(root);
  const findings: Finding[] = [];

  for (const error of parsed.errors) {
    findings.push(finding("SP002", error.message, { path: "SKILL.md", ...(error.line ? { line: error.line } : {}) }));
  }

  const name = typeof parsed.data.name === "string" ? parsed.data.name.trim() : "";
  const description = typeof parsed.data.description === "string" ? parsed.data.description.trim() : "";
  if (!name || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) || name.length > 64) {
    findings.push(finding("SP003", "Frontmatter name must be lowercase hyphen-case and no longer than 64 characters.", { path: "SKILL.md", line: 2 }));
  }
  if (!description) {
    findings.push(finding("SP004", "Frontmatter description is required.", { path: "SKILL.md", line: 3 }));
  } else if (description.length < 50) {
    findings.push(finding("SP006", "Description is too short to explain both capability and trigger context.", { path: "SKILL.md", line: 3 }));
  }
  if (name && path.basename(root) !== name) {
    findings.push(finding("SP005", `Folder “${path.basename(root)}” does not match skill name “${name}”.`, { path: "SKILL.md", line: 2 }));
  }

  const allowed = options.profile === "codex"
    ? new Set(["name", "description"])
    : new Set(["name", "description", "license", "compatibility", "metadata", "allowed-tools"]);
  for (const key of parsed.keys) {
    if (!allowed.has(key)) {
      findings.push(finding("SP007", `Frontmatter key “${key}” is not supported by the ${options.profile} profile.`, { path: "SKILL.md", line: 2 }));
    }
  }
  for (const match of content.matchAll(/\b(?:TODO|FIXME|REPLACE[_ -]?ME|Lorem ipsum)\b/gi)) {
    findings.push(finding("SP008", `Unresolved placeholder: ${match[0]}`, { path: "SKILL.md", line: lineOf(content, match.index ?? 0) }));
  }
  const lines = content.split(/\r?\n/).length;
  if (lines > 500) {
    findings.push(finding("SP009", `SKILL.md has ${lines} lines; the recommended maximum is 500.`, { path: "SKILL.md", line: 1 }));
  }

  findings.push(...inspectReferences(root, content));
  if (name) findings.push(...inspectOpenAiMetadata(root, name));
  findings.push(...inspectSecurity(root, files));
  if (options.smoke) findings.push(...inspectScriptSyntax(root, files));

  const filtered = findings.filter((item) => !options.ignoredRules.has(item.ruleId));
  const score = scoreFindings(filtered);
  return {
    root,
    name: name || path.basename(root),
    profile: options.profile,
    score,
    grade: gradeScore(score),
    filesScanned: files.length,
    findings: filtered,
    capabilities: inferCapabilities(files),
  };
}
