export type Severity = "critical" | "error" | "warning" | "info";
export type Profile = "codex" | "portable";
export type Grade = "A" | "B" | "C" | "D" | "F";

export interface Location {
  path: string;
  line?: number;
}

export interface Finding {
  ruleId: string;
  severity: Severity;
  title: string;
  message: string;
  location: Location;
  remediation?: string;
}

export interface SkillReport {
  root: string;
  name: string;
  profile: Profile;
  score: number;
  grade: Grade;
  filesScanned: number;
  findings: Finding[];
}

export interface WorkspaceReport {
  target: string;
  profile: Profile;
  skills: SkillReport[];
  summary: {
    skills: number;
    findings: number;
    critical: number;
    errors: number;
    warnings: number;
    averageScore: number;
  };
}

export interface CheckOptions {
  profile: Profile;
  smoke: boolean;
  ignoredRules: Set<string>;
}

export interface ParsedSkill {
  data: Record<string, unknown>;
  body: string;
  bodyStartLine: number;
  keys: string[];
  errors: Array<{ message: string; line?: number }>;
}
