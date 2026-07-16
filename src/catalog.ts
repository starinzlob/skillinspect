import type { Severity } from "./types.js";

export interface RuleDefinition {
  id: string;
  severity: Severity;
  title: string;
  remediation: string;
}

export const ruleCatalog: RuleDefinition[] = [
  { id: "SP001", severity: "critical", title: "Missing SKILL.md", remediation: "Add a SKILL.md at the skill root." },
  { id: "SP002", severity: "critical", title: "Invalid frontmatter", remediation: "Use valid YAML between opening and closing --- lines." },
  { id: "SP003", severity: "error", title: "Invalid skill name", remediation: "Use a lowercase hyphenated name under 64 characters." },
  { id: "SP004", severity: "error", title: "Missing description", remediation: "Describe what the skill does and when it should trigger." },
  { id: "SP005", severity: "warning", title: "Folder and skill name differ", remediation: "Rename the folder or frontmatter name so they match." },
  { id: "SP006", severity: "warning", title: "Weak description", remediation: "Add concrete capabilities and trigger contexts to the description." },
  { id: "SP007", severity: "warning", title: "Unsupported metadata key", remediation: "Remove unsupported frontmatter keys or use the portable profile." },
  { id: "SP008", severity: "warning", title: "Unresolved placeholder", remediation: "Replace TODO and placeholder text before publishing." },
  { id: "SP009", severity: "warning", title: "Oversized SKILL.md", remediation: "Move detailed material into one-level references and keep SKILL.md under 500 lines." },
  { id: "SP010", severity: "error", title: "Missing referenced resource", remediation: "Add the referenced file or correct the relative path." },
  { id: "SP011", severity: "critical", title: "Reference escapes skill root", remediation: "Keep every bundled reference inside the skill directory." },
  { id: "SP012", severity: "warning", title: "Invalid OpenAI skill metadata", remediation: "Fix agents/openai.yaml interface fields and default prompt." },
  { id: "SP100", severity: "critical", title: "Possible embedded secret", remediation: "Remove the secret and read it from the environment at runtime." },
  { id: "SP101", severity: "critical", title: "Remote code piped to a shell", remediation: "Download, verify, and invoke remote installers as separate reviewed steps." },
  { id: "SP102", severity: "error", title: "Destructive command", remediation: "Replace destructive defaults with scoped, reversible operations and explicit confirmation." },
  { id: "SP103", severity: "critical", title: "Possible environment exfiltration", remediation: "Do not send environment variables or credentials to remote endpoints." },
  { id: "SP104", severity: "warning", title: "User-specific absolute path", remediation: "Use paths relative to the skill or documented environment variables." },
  { id: "SP105", severity: "critical", title: "Symlink escapes skill root", remediation: "Remove external symlinks and bundle the required resource safely." },
  { id: "SP106", severity: "warning", title: "World-writable file", remediation: "Remove world-write permissions from published skill files." },
  { id: "SP200", severity: "error", title: "Script syntax error", remediation: "Fix the script syntax before publishing." },
  { id: "SP201", severity: "info", title: "Script lacks a shebang", remediation: "Add an interpreter shebang when the script is intended to run directly." },
];

export function rule(id: string): RuleDefinition {
  const definition = ruleCatalog.find((item) => item.id === id);
  if (!definition) throw new Error(`Unknown SkillInspect rule: ${id}`);
  return definition;
}
