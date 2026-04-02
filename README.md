# OpenClaude

Use Claude Code with **any LLM** — not just Claude.

OpenClaude is a fork of the [Claude Code source leak](https://gitlawb.com/node/repos/z6MkgKkb/instructkr-claude-code) (exposed via npm source maps on March 31, 2026). We added an OpenAI-compatible provider shim so you can plug in GPT-4o, DeepSeek, Gemini, Llama, Mistral, or any model that speaks the OpenAI chat completions API. It now also supports the ChatGPT Codex backend for `codexplan` and `codexspark`, and local inference via [Atomic Chat](https://atomic.chat/) on Apple Silicon.

All of Claude Code's tools work — bash, file read/write/edit, grep, glob, agents, tasks, MCP — just powered by whatever model you choose.

---

## Start Here

If you are new to terminals or just want the easiest path, start with the beginner guides:

- [Non-Technical Setup](docs/non-technical-setup.md)
- [Windows Quick Start](docs/quick-start-windows.md)
- [macOS / Linux Quick Start](docs/quick-start-mac-linux.md)

If you want source builds, Bun workflows, profile launchers, or full provider examples, use:

- [Advanced Setup](docs/advanced-setup.md)

---

## Windows Installer

For Windows users, we provide standalone installers with a built-in Ollama launcher and Explorer context menu integration.

### Download

Download the latest installer from the `releases/` folder:
- **Latest**: [OpenClaude-v0.1.10-Setup.exe](releases/OpenClaude-v0.1.10-Setup.exe) (57.3 MB)

### Features

- **Ollama Launcher**: Automatically detects Ollama, lists available models, and configures environment variables
- **Explorer Context Menu**: Right-click any folder → "Open folder with OpenClaude"
- **Skip Permissions Mode**: Optional context menu for trusted directories (bypasses permission prompts)
- **Standalone Executables**: No dependencies required (Node.js, Bun, or other tools not needed)
- **Optional PATH Integration**: Add OpenClaude to system PATH during installation

### First Run

1. Install OpenClaude using the setup wizard
2. Right-click any folder and select "Open folder with OpenClaude"
3. The launcher will:
   - Check if Ollama is running at `http://localhost:11434`
   - List all available Ollama models grouped by family
   - Let you select a model (saved for future use)
   - Launch OpenClaude with the selected model

### Launcher Configuration

The launcher saves your model selection to `~/.openclaude/config.json`. To change models later, the launcher will prompt you on next launch.

### Context Menu Options

Two context menu options are installed:

1. **"Open folder with OpenClaude"**: Normal mode with permission prompts
2. **"Open folder with OpenClaude (Skip Permissions)"**: Bypasses all permission prompts (use only in trusted directories)

Both options work on:
- Folder right-click
- Folder background (empty space) right-click

### Installer Versions

| Version | Features | Notes |
|---------|----------|-------|
| v0.1.10 | Launcher arg forwarding | **Latest** - Launcher correctly passes `--dangerously-skip-permissions` |
| v0.1.9 | Version increment | Same features as v0.1.8 |
| v0.1.8 | PowerShell launch fix | Fixed skip permissions to keep terminal open |
| v0.1.7 | Skip permissions option | Added second context menu (had terminal closing bug) |
| v0.1.6 | Context menu integration | First version with Explorer integration |
| v0.1.1 | First working installer | Basic installer with executables |
| v0.1.0 | Initial build | First compiled version |

### Manual Build

To build the installer yourself:

```powershell
# Build source
bun run build

# Compile executables
bun run compile

# Create installer (requires Inno Setup)
bun run installer
```

Requires:
- Bun 1.3.11+
- Inno Setup 6.4+ (for installer creation)

---

## Beginner Install

For most users, install the npm package:

```bash
npm install -g @gitlawb/openclaude
```

The package name is `@gitlawb/openclaude`, but the command you run is:

```bash
openclaude
```

If you install via npm and later see `ripgrep not found`, install ripgrep system-wide and confirm `rg --version` works in the same terminal before starting OpenClaude.

---

## Fastest Setup

### Windows PowerShell

```powershell
npm install -g @gitlawb/openclaude

$env:CLAUDE_CODE_USE_OPENAI="1"
$env:OPENAI_API_KEY="sk-your-key-here"
$env:OPENAI_MODEL="gpt-4o"

openclaude
```

### macOS / Linux

```bash
npm install -g @gitlawb/openclaude

export CLAUDE_CODE_USE_OPENAI=1
export OPENAI_API_KEY=sk-your-key-here
export OPENAI_MODEL=gpt-4o

openclaude
```

That is enough to start with OpenAI.

---

## Choose Your Guide

### Beginner

- Want the easiest setup with copy-paste steps: [Non-Technical Setup](docs/non-technical-setup.md)
- On Windows: [Windows Quick Start](docs/quick-start-windows.md)
- On macOS or Linux: [macOS / Linux Quick Start](docs/quick-start-mac-linux.md)

### Advanced

- Want source builds, Bun, local profiles, runtime checks, or more provider choices: [Advanced Setup](docs/advanced-setup.md)

---

## Common Beginner Choices

### OpenAI

Best default if you already have an OpenAI API key.

### Ollama

Best if you want to run models locally on your own machine.

### Codex

Best if you already use the Codex CLI or ChatGPT Codex backend.

### Atomic Chat

Best if you want local inference on Apple Silicon with Atomic Chat. See [Advanced Setup](docs/advanced-setup.md).

---

## What Works

- **All tools**: Bash, FileRead, FileWrite, FileEdit, Glob, Grep, WebFetch, WebSearch, Agent, MCP, LSP, NotebookEdit, Tasks
- **Streaming**: Real-time token streaming
- **Tool calling**: Multi-step tool chains (the model calls tools, gets results, continues)
- **Images**: Base64 and URL images passed to vision models
- **Slash commands**: /commit, /review, /compact, /diff, /doctor, etc.
- **Sub-agents**: AgentTool spawns sub-agents using the same provider
- **Memory**: Persistent memory system

## What's Different

- **No thinking mode**: Anthropic's extended thinking is disabled (OpenAI models use different reasoning)
- **No prompt caching**: Anthropic-specific cache headers are skipped
- **No beta features**: Anthropic-specific beta headers are ignored
- **Token limits**: Defaults to 32K max output — some models may cap lower, which is handled gracefully

---

## How It Works

The shim (`src/services/api/openaiShim.ts`) sits between Claude Code and the LLM API:

```
Claude Code Tool System
        |
        v
  Anthropic SDK interface (duck-typed)
        |
        v
  openaiShim.ts  <-- translates formats
        |
        v
  OpenAI Chat Completions API
        |
        v
  Any compatible model
```

It translates:
- Anthropic message blocks → OpenAI messages
- Anthropic tool_use/tool_result → OpenAI function calls
- OpenAI SSE streaming → Anthropic stream events
- Anthropic system prompt arrays → OpenAI system messages

The rest of Claude Code doesn't know it's talking to a different model.

---

## Model Quality Notes

Not all models are equal at agentic tool use. Here's a rough guide:

| Model | Tool Calling | Code Quality | Speed |
|-------|-------------|-------------|-------|
| GPT-4o | Excellent | Excellent | Fast |
| DeepSeek-V3 | Great | Great | Fast |
| Gemini 2.0 Flash | Great | Good | Very Fast |
| Llama 3.3 70B | Good | Good | Medium |
| Mistral Large | Good | Good | Fast |
| GPT-4o-mini | Good | Good | Very Fast |
| Qwen 2.5 72B | Good | Good | Medium |
| Smaller models (<7B) | Limited | Limited | Very Fast |

For best results, use models with strong function/tool calling support.

---

## Files Changed from Original

```
src/services/api/openaiShim.ts   — NEW: OpenAI-compatible API shim (724 lines)
src/services/api/client.ts       — Routes to shim when CLAUDE_CODE_USE_OPENAI=1
src/utils/model/providers.ts     — Added 'openai' provider type
src/utils/model/configs.ts       — Added openai model mappings
src/utils/model/model.ts         — Respects OPENAI_MODEL for defaults
src/utils/auth.ts                — Recognizes OpenAI as valid 3P provider
```

6 files changed. 786 lines added. Zero dependencies added.

---

## Origin

This is a fork of [instructkr/claude-code](https://gitlawb.com/node/repos/z6MkgKkb/instructkr-claude-code), which mirrored the Claude Code source snapshot that became publicly accessible through an npm source map exposure on March 31, 2026.

The original Claude Code source is the property of Anthropic. This repository is not affiliated with or endorsed by Anthropic.

---

## License

This repository is provided for educational and research purposes. The original source code is subject to Anthropic's terms. The OpenAI shim additions are public domain.
