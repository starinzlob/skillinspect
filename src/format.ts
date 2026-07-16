import path from "node:path";
import type { Finding, SkillReport, WorkspaceReport } from "./types.js";

const severityIcon = {
  critical: "✖",
  error: "✖",
  warning: "⚠",
  info: "•",
} as const;

function displayPath(report: SkillReport, finding: Finding): string {
  return path.join(report.root, finding.location.path);
}

export function formatText(report: WorkspaceReport): string {
  const lines: string[] = [];
  for (const skill of report.skills) {
    lines.push(`${skill.name}: ${skill.grade} (${skill.score}/100) — ${skill.filesScanned} file(s)`);
    if (skill.findings.length === 0) {
      lines.push("  ✓ No findings");
      continue;
    }
    for (const item of skill.findings) {
      const line = item.location.line ? `:${item.location.line}` : "";
      lines.push(`  ${severityIcon[item.severity]} ${item.ruleId} ${item.title}`);
      lines.push(`    ${item.message}`);
      lines.push(`    ${displayPath(skill, item)}${line}`);
    }
  }
  lines.push("");
  lines.push(`Scanned ${report.summary.skills} skill(s): ${report.summary.critical} critical, ${report.summary.errors} error, ${report.summary.warnings} warning. Average score ${report.summary.averageScore}/100.`);
  return lines.join("\n");
}

function escapeCommand(value: string): string {
  return value.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
}

export function formatGithub(report: WorkspaceReport): string {
  const lines = report.skills.flatMap((skill) => skill.findings.map((item) => {
    const level = item.severity === "warning" || item.severity === "info" ? "warning" : "error";
    const file = escapeCommand(path.relative(process.cwd(), displayPath(skill, item)));
    const line = item.location.line ? `,line=${item.location.line}` : "";
    return `::${level} file=${file}${line},title=${item.ruleId} ${escapeCommand(item.title)}::${escapeCommand(item.message)}`;
  }));
  return lines.length ? lines.join("\n") : "SkillProof found no issues.";
}

export function badgeSvg(label: string, grade: string, score: number): string {
  const color = score >= 90 ? "4c1" : score >= 80 ? "97ca00" : score >= 70 ? "dfb317" : score >= 60 ? "fe7d37" : "e05d44";
  const left = 78;
  const right = 70;
  const safeLabel = label.replace(/[<>&"']/g, "");
  const value = `${grade} ${score}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${left + right}" height="20" role="img" aria-label="${safeLabel}: ${value}">
  <linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>
  <clipPath id="r"><rect width="${left + right}" height="20" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#r)"><path fill="#555" d="M0 0h${left}v20H0z"/><path fill="#${color}" d="M${left} 0h${right}v20H${left}z"/><path fill="url(#s)" d="M0 0h${left + right}v20H0z"/></g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11"><text x="${left / 2}" y="15" fill="#010101" fill-opacity=".3">${safeLabel}</text><text x="${left / 2}" y="14">${safeLabel}</text><text x="${left + right / 2}" y="15" fill="#010101" fill-opacity=".3">${value}</text><text x="${left + right / 2}" y="14">${value}</text></g>
</svg>\n`;
}
