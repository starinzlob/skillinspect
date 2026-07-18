# SkillInspect

面向 AI Agent Skills 的静态质量、安全性和可移植性检查工具。<br>
Static quality, safety, and portability checks for AI Agent Skills.

[中文](#中文) · [English](#english)

## 中文

SkillInspect 检查包含 `SKILL.md` 的目录，但不会执行其中的安装指令或应用代码。它会生成可追溯的问题报告、A–F 等级、GitHub 注释，以及可选的徽章。

### 快速开始

```bash
npx --yes skillinspect check ./skills/my-skill
npx --yes skillinspect manifest ./skills/my-skill --probe
npx --yes skillinspect check . --smoke --strict
npx --yes skillinspect check . --format github
```

使用 `--profile codex` 严格检查 Codex 元数据；使用 `--profile portable` 检查带有额外标准 frontmatter 字段的跨 Agent 包。

### 检查内容

- 必需且有效的 YAML frontmatter；
- 小写连字符命名和文件夹名称一致性；
- 是否有信息充分的描述，以及未清理的占位符；
- 缺失或越出 Skill 根目录的 Markdown 资源；
- 格式错误的 `agents/openai.yaml` 元数据；
- 疑似凭据的内容，但不会输出检测到的具体值；
- 把远程响应直接传给 shell 的命令；
- 破坏性命令和可能的环境数据外传；
- 用户专属绝对路径、逃逸符号链接和所有人可写文件；
- 通过可选的 `--smoke` 解析器检查 Bash、Node.js 和 Python 语法。

### 能力清单

在运行任何捆绑代码之前，`skillinspect manifest` 会静态推断一个 Skill 可能需要或改变什么：

- 运行时命令，以及通过 `--probe` 检查它们是否存在于本机；
- 环境变量和凭据名称，但绝不读取或输出其值；
- 外部网络主机；
- 本地文件写入和删除；
- 浏览器控制、软件包安装、外部发布和财务副作用。

每一项推断出的能力都包含来源证据。清单可以输出为便于阅读的文本或 JSON，让安装器、注册表和 Agent 运行时在执行前要求用户做出知情授权。

### 评分

每个 Skill 的初始分数为 100：

| 严重程度 | 扣分 |
| --- | ---: |
| Critical | 30 |
| Error | 15 |
| Warning | 5 |
| Info | 1 |

等级划分为 A（90+）、B（80+）、C（70+）、D（60+）和 F（低于 60）。分数只用于确定修复优先级，不代表安全保证。

### 命令

```bash
npx --yes skillinspect check [path] [--profile codex|portable]
npx --yes skillinspect manifest [path] [--probe] [--format text|json]
npx --yes skillinspect badge [path] [--output skillinspect.svg]
npx --yes skillinspect rules
```

其他选项：

- `--smoke`：解析支持的脚本，但不运行其中的应用逻辑；
- `--strict`：发现 warning 时也返回失败退出码；
- `--probe`：检查推断出的运行时命令是否存在，不执行 Skill 代码；
- `--ignore SP123`：忽略已经审查过的规则 ID，可重复使用。

如果一个目录中包含多个嵌套的 `SKILL.md`，SkillInspect 会报告所有发现的 Skill 和汇总分数。

### GitHub Actions

把 [`examples/github-workflow.yml`](examples/github-workflow.yml) 复制到 `.github/workflows/skillinspect.yml`。该工作流会直接安装这个 GitHub 仓库，并输出 GitHub 原生文件注释。

CLI 已发布为无 scope 的 npm 包 [`skillinspect`](https://www.npmjs.com/package/skillinspect)。如需测试尚未发布的提交，请显式使用 `npx --yes github:starinzlob/skillinspect`。

### Agent Skill

仓库在 [`skills/skillinspect`](skills/skillinspect) 中提供了一个可安装的 Skill。它会指导 Agent 优先处理发布阻断项、隐藏凭据值，并避免执行不可信的 Skill 代码。

### 开发

```bash
npm install
npm test
```

需要 Node.js 20 或更高版本。

### 许可

MIT

---

## English

SkillInspect inspects a `SKILL.md` folder without executing its installation instructions or application code. It produces traceable findings, an A-F grade, GitHub annotations, and an optional badge.

### Quick start

```bash
npx --yes skillinspect check ./skills/my-skill
npx --yes skillinspect manifest ./skills/my-skill --probe
npx --yes skillinspect check . --smoke --strict
npx --yes skillinspect check . --format github
```

Use `--profile codex` for strict Codex metadata or `--profile portable` for cross-agent packages with additional standard frontmatter fields.

### What it checks

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

### Capability manifest

`skillinspect manifest` statically infers what a Skill may need or change before any bundled code runs:

- runtime commands and whether they exist locally with `--probe`;
- environment variables and credential names, never their values;
- external network hosts;
- local file writes and deletes;
- browser control, package installation, external publishing, and financial side effects.

Every inferred capability includes source evidence. The manifest is available as human-readable text or JSON so installers, registries, and Agent runtimes can require informed approval before execution.

### Scoring

Every skill starts at 100:

| Severity | Penalty |
| --- | ---: |
| Critical | 30 |
| Error | 15 |
| Warning | 5 |
| Info | 1 |

Grades are A (90+), B (80+), C (70+), D (60+), and F (below 60). Scores are a prioritization aid, not a security guarantee.

### Commands

```bash
npx --yes skillinspect check [path] [--profile codex|portable]
npx --yes skillinspect manifest [path] [--probe] [--format text|json]
npx --yes skillinspect badge [path] [--output skillinspect.svg]
npx --yes skillinspect rules
```

Additional options:

- `--smoke`: parse supported scripts without running their application logic;
- `--strict`: return a failing exit code for warnings;
- `--probe`: check inferred runtime commands against the current machine without running Skill code;
- `--ignore SP123`: suppress a reviewed rule ID, repeatable.

If a directory contains multiple nested `SKILL.md` files, SkillInspect reports every discovered Skill and an aggregate score.

### GitHub Actions

Copy [`examples/github-workflow.yml`](examples/github-workflow.yml) into `.github/workflows/skillinspect.yml`. It installs this GitHub repository directly and emits native file annotations.

The CLI is published as the unscoped npm package [`skillinspect`](https://www.npmjs.com/package/skillinspect). To test an unreleased commit, use `npx --yes github:starinzlob/skillinspect` explicitly.

### Agent Skill

An installable Skill is included at [`skills/skillinspect`](skills/skillinspect). It instructs an agent to prioritize release blockers, keep credential values redacted, and avoid executing untrusted Skill code.

### Development

```bash
npm install
npm test
```

Requires Node.js 20 or newer.

### License

MIT
