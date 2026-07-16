# SkillProof

Static quality, safety, and portability checks for AI Agent Skills.

SkillProof inspects a `SKILL.md` folder without executing its installation instructions or application code. It produces traceable findings, an A-F grade, GitHub annotations, and an optional badge.

## Quick start

```bash
npx --yes github:starinzlob/skillproof check ./skills/my-skill
npx --yes github:starinzlob/skillproof check . --smoke --strict
npx --yes github:starinzlob/skillproof check . --format github
```

Use `--profile codex` for strict Codex metadata or `--profile portable` for cross-agent packages with additional standard frontmatter fields.

## What it checks

- required and valid YAML frontmatter;
- lowercase hyphenated names and folder-name consistency;
- useful descriptions and unresolved placeholders;
- missing or root-escaping Markdown resources;
- malformed `agents/openai.yaml` metadata;
- credential-like values without printing the detected value;
- remote responses piped directly to a shell;
- destructive commands and possible environment exfiltration;
- user-specific absolute paths, escaping symlinks, and world-writable files;
- Bash, Node.js, and Python syntax with the opt-in `--smoke` parser.

## Scoring

Every skill starts at 100:

| Severity | Penalty |
| --- | ---: |
| Critical | 30 |
| Error | 15 |
| Warning | 5 |
| Info | 1 |

Grades are A (90+), B (80+), C (70+), D (60+), and F (below 60). Scores are a prioritization aid, not a security guarantee.

## Commands

```bash
npx --yes github:starinzlob/skillproof check [path] [--profile codex|portable]
npx --yes github:starinzlob/skillproof badge [path] [--output skillproof.svg]
npx --yes github:starinzlob/skillproof rules
```

Additional options:

- `--smoke`: parse supported scripts without running their application logic;
- `--strict`: return a failing exit code for warnings;
- `--ignore SP123`: suppress a reviewed rule ID, repeatable.

If a directory contains multiple nested `SKILL.md` files, SkillProof reports every discovered Skill and an aggregate score.

## GitHub Actions

Copy [`examples/github-workflow.yml`](examples/github-workflow.yml) into `.github/workflows/skillproof.yml`. It installs this GitHub repository directly and emits native file annotations.

Use the GitHub-qualified command shown above. The unscoped `skillproof` name on npm belongs to an unrelated package.

## Agent Skill

An installable Skill is included at [`skills/skillproof`](skills/skillproof). It instructs an agent to prioritize release blockers, keep credential values redacted, and avoid executing untrusted Skill code.

## Development

```bash
npm install
npm test
```

Requires Node.js 20 or newer.

## License

MIT
