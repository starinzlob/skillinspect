---
name: skillproof
description: Audit AI Agent Skills for structural quality, missing resources, unsafe commands, embedded credentials, portability problems, metadata errors, and script syntax. Use when reviewing a SKILL.md folder before installation, publication, release, or inclusion in a shared skills collection, and when a user wants an evidence-based A-F quality grade with prioritized remediation.
---

# SkillProof

Audit a Skill statically before trusting or publishing it. Do not execute installation instructions or bundled scripts during the audit.

## Workflow

1. Run `npx --yes github:starinzlob/skillproof check <path> --profile codex --smoke`.
2. Review critical and error findings first. Treat credential exposure, root escapes, and remote shell pipelines as release blockers.
3. Review warnings for portability, metadata, documentation size, and placeholders.
4. Open the cited file and line before proposing a fix. Do not suppress a rule until its specific risk has been evaluated.
5. Apply narrow fixes, then rerun the same command.
6. Use `--strict` before release so warnings also fail the check.

## Outputs

- Use `--format text` for an interactive review.
- Use `--format json` for programmatic processing.
- Use `--format github` inside GitHub Actions.
- Run `npx --yes github:starinzlob/skillproof badge <path> --output skillproof.svg` to generate a local grade badge.
- Run `npx --yes github:starinzlob/skillproof rules` to list rule identifiers and severities.

## Profiles

- Use `codex` when validating Codex Skills with only `name` and `description` frontmatter keys.
- Use `portable` for cross-agent packages that include additional standard metadata.

## Guardrails

- Keep analysis static. `--smoke` parses supported scripts for syntax but does not run their application logic.
- Use the GitHub-qualified command above; the unscoped npm package with the same name is unrelated.
- Never print a detected credential value; report only its location.
- Do not automatically rewrite security-sensitive commands.
- Explain that heuristic findings require human review.
- Prefer correcting a finding over adding `--ignore`; document any intentional suppression.
