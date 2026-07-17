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

export type CapabilityRisk = "low" | "medium" | "high" | "critical";

export interface CapabilityEntry {
  name: string;
  evidence: Location[];
}

export interface RuntimeCapability extends CapabilityEntry {
  available: boolean | null;
}

export interface SideEffectCapability extends CapabilityEntry {
  kind: "browser-control" | "credential-access" | "external-write" | "file-delete" | "file-write" | "financial-transaction" | "network-access" | "package-install";
}

export interface CapabilityManifest {
  schemaVersion: 1;
  risk: CapabilityRisk;
  commands: RuntimeCapability[];
  environment: CapabilityEntry[];
  networkHosts: CapabilityEntry[];
  fileWrites: CapabilityEntry[];
  sideEffects: SideEffectCapability[];
}

export interface SkillReport {
  root: string;
  name: string;
  profile: Profile;
  score: number;
  grade: Grade;
  filesScanned: number;
  findings: Finding[];
  capabilities: CapabilityManifest;
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
