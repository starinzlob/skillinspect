import type { Finding, Grade, Severity } from "./types.js";

const penalty: Record<Severity, number> = {
  critical: 30,
  error: 15,
  warning: 5,
  info: 1,
};

export function scoreFindings(findings: Finding[]): number {
  return Math.max(0, 100 - findings.reduce((sum, finding) => sum + penalty[finding.severity], 0));
}

export function gradeScore(score: number): Grade {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}
