import { existsSync, lstatSync, readdirSync } from "node:fs";
import path from "node:path";

const ignoredDirectories = new Set([
  ".git", "node_modules", "dist", "build", "coverage", ".venv", "venv", "vendor",
]);

export interface SkillFile {
  absolute: string;
  relative: string;
  isSymlink: boolean;
  mode: number;
  size: number;
}

export function discoverSkillRoots(target: string): string[] {
  const absolute = path.resolve(target);
  if (!existsSync(absolute)) return [];
  const stat = lstatSync(absolute);
  if (stat.isFile()) return path.basename(absolute) === "SKILL.md" ? [path.dirname(absolute)] : [];
  if (existsSync(path.join(absolute, "SKILL.md"))) return [absolute];

  const roots: string[] = [];
  const visit = (directory: string, depth: number) => {
    if (depth > 8) return;
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (!entry.isDirectory() || ignoredDirectories.has(entry.name)) continue;
      const child = path.join(directory, entry.name);
      if (existsSync(path.join(child, "SKILL.md"))) roots.push(child);
      else visit(child, depth + 1);
    }
  };
  visit(absolute, 0);
  return roots.sort();
}

export function listSkillFiles(root: string): SkillFile[] {
  const files: SkillFile[] = [];
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
      const absolute = path.join(directory, entry.name);
      const stat = lstatSync(absolute);
      const relative = path.relative(root, absolute).split(path.sep).join("/");
      if (stat.isSymbolicLink()) {
        files.push({ absolute, relative, isSymlink: true, mode: stat.mode, size: stat.size });
      } else if (stat.isDirectory()) {
        visit(absolute);
      } else if (stat.isFile()) {
        files.push({ absolute, relative, isSymlink: false, mode: stat.mode, size: stat.size });
      }
    }
  };
  visit(root);
  return files.sort((left, right) => left.relative.localeCompare(right.relative));
}
