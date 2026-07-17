import { accessSync, constants, readFileSync } from "node:fs";
import path from "node:path";
import type { SkillFile } from "./discovery.js";
import type {
  CapabilityEntry,
  CapabilityManifest,
  CapabilityRisk,
  Location,
  RuntimeCapability,
  SideEffectCapability,
} from "./types.js";

const textExtensions = new Set([
  ".md", ".mdc", ".txt", ".yaml", ".yml", ".json", ".toml", ".sh", ".bash",
  ".zsh", ".py", ".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".html", ".css",
]);

const shellLanguages = new Set(["bash", "sh", "shell", "zsh", "console", "terminal"]);
const shellBuiltins = new Set([
  "alias", "break", "case", "cd", "continue", "do", "done", "echo", "elif", "else",
  "esac", "eval", "exec", "exit", "export", "false", "fi", "for", "function", "if",
  "in", "local", "printf", "pwd", "read", "readonly", "return", "set", "shift", "source",
  "test", "then", "time", "trap", "true", "type", "typeset", "ulimit", "umask", "unalias",
  "unset", "until", "wait", "while",
]);

const commonCommandNames = new Set([
  "agent-browser", "apt", "apt-get", "bash", "brew", "bun", "cargo", "cat", "chmod", "cp",
  "curl", "deno", "docker", "docker-compose", "ffmpeg", "gh", "git", "go", "helm", "jq", "just",
  "kubectl", "make", "mkdir", "mv", "node", "npm", "npx", "osascript", "pip", "pip3", "pnpm",
  "poetry", "python", "python3", "rg", "rm", "ruby", "rustc", "tee", "terraform", "touch", "uv",
  "uvx", "wget", "yarn", "zsh",
]);
const knownCommands = new RegExp(`\\b(${[...commonCommandNames].sort((a, b) => b.length - a.length).map((item) => item.replace(/-/g, "\\-")).join("|")})\\b`, "g");
const environmentPatterns = [
  /\$\{?([A-Z][A-Z0-9_]{2,})\}?/g,
  /\bprocess\.env\.([A-Z][A-Z0-9_]*)\b/g,
  /\bos\.environ(?:\.get\()?\s*[[(]\s*["']([A-Z][A-Z0-9_]*)["']/g,
  /\bgetenv\(\s*["']([A-Z][A-Z0-9_]*)["']/g,
];

function isTextFile(file: SkillFile): boolean {
  if (file.isSymlink || file.size > 1024 * 1024) return false;
  if (path.basename(file.relative) === "SKILL.md") return true;
  return textExtensions.has(path.extname(file.relative).toLowerCase());
}

function addEntry(map: Map<string, Location[]>, name: string, location: Location): void {
  const normalized = name.trim();
  if (!normalized) return;
  const locations = map.get(normalized) ?? [];
  if (locations.length < 5 && !locations.some((item) => item.path === location.path && item.line === location.line)) {
    locations.push(location);
  }
  map.set(normalized, locations);
}

function entries(map: Map<string, Location[]>): CapabilityEntry[] {
  return [...map.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, evidence]) => ({ name, evidence }));
}

function commandFromSegment(segment: string): string | undefined {
  const cleaned = segment
    .trim()
    .replace(/^\$\s+/, "")
    .replace(/^(?:[A-Z][A-Z0-9_]*=(?:"[^"]*"|'[^']*'|\S+)\s+)+/, "")
    .replace(/^(?:sudo|env|command|nohup)\s+/, "");
  const token = cleaned.match(/^([A-Za-z0-9][A-Za-z0-9._/-]*)/)?.[1];
  if (!token) return undefined;
  if (token.includes("/")) {
    if (/\.py$/.test(token)) return "python3";
    if (/\.(?:js|mjs|cjs|ts)$/.test(token)) return "node";
    if (/\.(?:sh|bash|zsh)$/.test(token)) return "bash";
    return undefined;
  }
  if (shellBuiltins.has(token)) return undefined;
  if (/^[A-Z0-9_]+$/.test(token) || token.includes("_") || token === "http" || token === "https" || token === "browser") return undefined;
  if (!commonCommandNames.has(token) && !token.includes("-")) return undefined;
  return token;
}

function addShellCommands(snippet: string, location: Location, map: Map<string, Location[]>): void {
  for (const segment of snippet.split(/(?:&&|\|\||[;|])/)) {
    const command = commandFromSegment(segment);
    if (command) addEntry(map, command, location);
  }
  for (const match of snippet.matchAll(knownCommands)) {
    if (match[1]) addEntry(map, match[1], location);
  }
}

function shellSnippets(lines: string[], relative: string): Array<{ text: string; line: number }> {
  const snippets: Array<{ text: string; line: number }> = [];
  const extension = path.extname(relative).toLowerCase();
  if ([".sh", ".bash", ".zsh"].includes(extension)) {
    return lines.map((text, index) => ({ text, line: index + 1 }));
  }
  if (!relative.endsWith(".md") && !relative.endsWith(".mdc")) return snippets;

  let shellFence = false;
  lines.forEach((text, index) => {
    const fence = text.match(/^\s*```\s*([A-Za-z0-9_-]*)/);
    if (fence) {
      if (shellFence) shellFence = false;
      else shellFence = shellLanguages.has((fence[1] ?? "").toLowerCase());
      return;
    }
    if (shellFence) snippets.push({ text, line: index + 1 });
    for (const inline of text.matchAll(/`([^`\n]+)`/g)) {
      if (inline[1]) snippets.push({ text: inline[1], line: index + 1 });
    }
  });
  return snippets;
}

function literalWriteTarget(line: string): string {
  const shellTarget = line.match(/(?:>>?|\btee\s+(?:-a\s+)?|\b(?:cp|mv|touch|mkdir|chmod|rm)\s+(?:-[A-Za-z]+\s+)*)([~/$.[A-Za-z0-9_][^\s;|]*)/)?.[1];
  if (shellTarget) return shellTarget.replace(/["'`,)]*$/, "");
  const apiTarget = line.match(/(?:writeFile(?:Sync)?|appendFile(?:Sync)?|mkdir(?:Sync)?|unlink(?:Sync)?|rm(?:Sync)?)\s*\(\s*["'`]([^"'`]+)["'`]/)?.[1];
  return apiTarget ?? "dynamic path";
}

function hasFileWrite(line: string): boolean {
  return /(?:^|\s)(?:cp|mv|touch|mkdir|chmod|rm)\s|(?:^|[^>])>>?[^=]|\btee\s|\b(?:writeFile|appendFile|mkdir|unlink|rmdir|rm)(?:Sync)?\s*\(|\bopen\([^\n]*["'][wax][+b]?["']/.test(line);
}

function riskFor(sideEffects: SideEffectCapability[], criticalPattern: boolean): CapabilityRisk {
  if (criticalPattern) return "critical";
  const kinds = new Set(sideEffects.map((item) => item.kind));
  if (["credential-access", "external-write", "file-delete", "financial-transaction"].some((kind) => kinds.has(kind as SideEffectCapability["kind"]))) return "high";
  if (kinds.size > 0) return "medium";
  return "low";
}

function addSideEffect(map: Map<string, { label: string; locations: Location[] }>, kind: SideEffectCapability["kind"], label: string, location: Location): void {
  const current = map.get(kind) ?? { label, locations: [] };
  if (current.locations.length < 5 && !current.locations.some((item) => item.path === location.path && item.line === location.line)) {
    current.locations.push(location);
  }
  map.set(kind, current);
}

export function emptyCapabilityManifest(): CapabilityManifest {
  return { schemaVersion: 1, risk: "low", commands: [], environment: [], networkHosts: [], fileWrites: [], sideEffects: [] };
}

export function inferCapabilities(files: SkillFile[]): CapabilityManifest {
  const commands = new Map<string, Location[]>();
  const environment = new Map<string, Location[]>();
  const networkHosts = new Map<string, Location[]>();
  const fileWrites = new Map<string, Location[]>();
  const sideEffects = new Map<string, { label: string; locations: Location[] }>();
  let criticalPattern = false;

  for (const file of files) {
    if (!isTextFile(file)) continue;
    const content = readFileSync(file.absolute, "utf8");
    const lines = content.split(/\r?\n/);
    const snippets = shellSnippets(lines, file.relative);

    for (const snippet of snippets) {
      const location = { path: file.relative, line: snippet.line };
      addShellCommands(snippet.text, location, commands);
      if (hasFileWrite(snippet.text)) {
        addEntry(fileWrites, literalWriteTarget(snippet.text), location);
        const deleting = /\b(?:rm|unlink|rmdir)(?:Sync)?\b/.test(snippet.text);
        addSideEffect(sideEffects, deleting ? "file-delete" : "file-write", deleting ? "May delete local files" : "May write local files", location);
      }
      if (/\b(?:npm|pnpm|yarn|pip3?|uv)\s+(?:add|install)|\bnpx\s+skills\s+add\b/.test(snippet.text)) {
        addSideEffect(sideEffects, "package-install", "May install packages or Skills", location);
      }
    }

    lines.forEach((line, index) => {
      const location = { path: file.relative, line: index + 1 };
      const behaviorDocument = file.relative === "SKILL.md" || file.relative.startsWith("references/");
      for (const pattern of environmentPatterns) {
        for (const match of line.matchAll(pattern)) {
          if (match[1]) addEntry(environment, match[1], location);
        }
      }
      for (const match of line.matchAll(/`([A-Z][A-Z0-9_]*(?:API_KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|COOKIE)[A-Z0-9_]*)`/g)) {
        if (match[1]) addEntry(environment, match[1], location);
      }
      for (const match of line.matchAll(/https?:\/\/[^\s<>"'`)\]]+/g)) {
        try {
          addEntry(networkHosts, new URL(match[0]).host, location);
        } catch {
          // Ignore malformed URLs; structural checks handle broken references separately.
        }
      }
      const extension = path.extname(file.relative).toLowerCase();
      if (![".md", ".mdc", ".txt", ".yaml", ".yml", ".json", ".toml"].includes(extension) && hasFileWrite(line)) {
        addEntry(fileWrites, literalWriteTarget(line), location);
        addSideEffect(sideEffects, /\b(?:rm|unlink|rmdir)(?:Sync)?\b/.test(line) ? "file-delete" : "file-write", /\b(?:rm|unlink|rmdir)(?:Sync)?\b/.test(line) ? "May delete local files" : "May write local files", location);
      }
      if (behaviorDocument && /\b(?:agent-browser|playwright|puppeteer|browser-use|browser|chrome)\b/i.test(line)) {
        addSideEffect(sideEffects, "browser-control", "May control a web browser", location);
      }
      if (behaviorDocument && /\b(?:send|submit|publish|post|reply|comment|upvote|downvote)\b/i.test(line) && !/\b(?:do not|don't|never|without)\b/i.test(line)) {
        addSideEffect(sideEffects, "external-write", "May create externally visible content or actions", location);
      }
      if (behaviorDocument && /\b(?:purchase|pay|payment|refund|transfer)\b/i.test(line) && !/\b(?:do not|don't|never|without)\b/i.test(line)) {
        addSideEffect(sideEffects, "financial-transaction", "May initiate or change a financial transaction", location);
      }
      if (/\b(?:curl|wget)\b[^|\n]*\|\s*(?:sudo\s+)?(?:ba)?sh\b/i.test(line)) {
        criticalPattern = true;
      }
    });
  }

  const environmentEntries = entries(environment);
  const networkEntries = entries(networkHosts);
  if (networkEntries.length > 0) {
    addSideEffect(sideEffects, "network-access", "May access external network hosts", networkEntries[0]?.evidence[0] ?? { path: "SKILL.md" });
  }
  const credentialEvidence = environmentEntries
    .filter((item) => /(?:API_KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|COOKIE)/.test(item.name))
    .flatMap((item) => item.evidence);
  if (credentialEvidence[0]) {
    addSideEffect(sideEffects, "credential-access", "May read credentials from the environment", credentialEvidence[0]);
  }

  const effectEntries: SideEffectCapability[] = [...sideEffects.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([kind, item]) => ({ kind: kind as SideEffectCapability["kind"], name: item.label, evidence: item.locations }));
  const commandEntries: RuntimeCapability[] = entries(commands).map((item) => ({ ...item, available: null }));

  return {
    schemaVersion: 1,
    risk: riskFor(effectEntries, criticalPattern),
    commands: commandEntries,
    environment: environmentEntries,
    networkHosts: networkEntries,
    fileWrites: entries(fileWrites),
    sideEffects: effectEntries,
  };
}

function executableExists(command: string): boolean {
  const pathValue = process.env.PATH ?? "";
  const extensions = process.platform === "win32" ? (process.env.PATHEXT ?? ".EXE;.CMD;.BAT;.COM").split(";") : [""];
  for (const directory of pathValue.split(path.delimiter)) {
    for (const extension of extensions) {
      try {
        accessSync(path.join(directory, command + extension), constants.X_OK);
        return true;
      } catch {
        // Continue searching PATH.
      }
    }
  }
  return false;
}

export function probeCapabilities(manifest: CapabilityManifest): CapabilityManifest {
  return {
    ...manifest,
    commands: manifest.commands.map((item) => ({ ...item, available: executableExists(item.name) })),
  };
}
