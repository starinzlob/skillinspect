import path from "node:path";
import { analyzeSkill } from "./analyzer.js";
import { discoverSkillRoots } from "./discovery.js";
import type { CheckOptions, WorkspaceReport } from "./types.js";

export function analyzeTarget(targetInput: string, options: CheckOptions): WorkspaceReport {
  const target = path.resolve(targetInput);
  const roots = discoverSkillRoots(target);
  if (roots.length === 0) {
    throw new Error(`No SKILL.md files found under ${target}.`);
  }
  const skills = roots.map((root) => analyzeSkill(root, options));
  const findings = skills.flatMap((skill) => skill.findings);
  const count = (severity: string) => findings.filter((item) => item.severity === severity).length;
  return {
    target,
    profile: options.profile,
    skills,
    summary: {
      skills: skills.length,
      findings: findings.length,
      critical: count("critical"),
      errors: count("error"),
      warnings: count("warning"),
      averageScore: Math.round(skills.reduce((sum, skill) => sum + skill.score, 0) / skills.length),
    },
  };
}
