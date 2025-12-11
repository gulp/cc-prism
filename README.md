# cc-prism

<img src="assets/cc-prism.png" alt="Retro terminal with light beam" width="400">

*Your Claude Code sessions, refracted into shareable terminal recordings.*

One command. Instant asciinema upload. Share the conversation that built your feature.

> Built with Claude. 185 tests pass, don't blame me if it's wrong — I'm trusting their word.

---

## Why

Born from building [onceuponaclaude.com](https://onceuponaclaude.com) — I needed to share Claude Code sessions without resorting to screenshots or unstyled paste dumps.

cc-prism renders sessions with Claude Code's ink aesthetics: the thinking blocks, tool calls, spinners, and all. The output plays back in asciinema like you're watching the real thing.

**Use it to:**
- Share the conversation that shipped your feature
- Create demos of AI-assisted workflows
- Document how you solved that gnarly bug

**Prerequisites:** [asciinema CLI](https://docs.asciinema.org/manual/cli/installation/) for playback and upload

## Quick Start

```bash
# No install needed — run directly with npx
npx cc-prism cast --latest --upload

# That's it! Share the URL anywhere.
```

## Installation

For frequent use, install globally:

```bash
npm install -g cc-prism
# or
bun install -g cc-prism
```

Then run without npx:
```bash
cc-prism cast --latest --upload
```

For more control:
```bash
# Extract specific messages, customize theme
cc-prism cast ~/.claude/projects/-home-user-myapp/session.jsonl \
  --last 20 --theme dracula -o demo.cast

# Interactive picker to select message ranges
cc-prism pick --latest
```

## Features

### Session Parsing
- Parse all 6 Claude Code JSONL message types
- Recursive loading of agent/sub-assistant conversations
- Preserve conversation structure and message relationships

### Clip Extraction
- Extract by UUID range: `--start-uuid <uuid> --end-uuid <uuid>`
- Extract by timestamp: `--start-time <iso8601> --end-time <iso8601>`
- Extract last N messages: `--last <n>`

### Theming
Five built-in themes matching popular terminal color schemes:
- `tokyo-night` (default) - Dark Tokyo Night palette
- `tokyo-storm` - Tokyo Storm variant
- `dracula` - Dracula color scheme
- `nord` - Nord Arctic theme
- `catppuccin-mocha` - Catppuccin Mocha

### Timing Presets
- `demo` (default) - Normalized pace, brief pauses, smooth flow
- `walkthrough` - Slower typing effect, educational pace
- `real` - Preserve actual timestamps from session

### Status Spinner
Enabled by default (use `--no-status-spinner` to disable):
- Rotating asterisk animation (·✢✳✻✽)
- Shimmering verb text effect with character-level highlight sliding
- Alternating verbs during long agentic sessions (throttled to 2s intervals)
- Displays TodoWrite activeForm when available
- Falls back to whimsical verbs (Clauding, Pondering, Reticulating, etc.) selected via hash-based pseudo-random distribution
- Appears during thinking blocks and tool calls, not just user prompts

### Navigation Markers
Enable chapter navigation in the asciinema player:
- `all` (default) - User prompts, assistant responses, tool calls
- `user` - User prompts only
- `tools` - Tool calls only
- `none` - No markers

### CLI Commands

**cast** - Generate asciicast files
```bash
cc-prism cast [session] [options]
cc-prism cast [session] --interactive  # Launch TUI form
```

**list** - Browse session messages
```bash
cc-prism list <session>
```

**pick** - Interactive message picker
```bash
cc-prism pick [session] [--latest]
```
Features:
- Dual-pane layout with message list and preview
- Tab cycling (All → Selected → Preview) with number shortcuts
- Visual selection mode and cherry-pick mode
- Fuzzy search with n/N navigation
- Export preview with full-screen content view
- Export dialog with format selection (.cast, .jsonl, or both)
- Single vs multiple range export modes
- Copy commands and UUIDs to clipboard
- Advanced options integration with interactive cast form

**sessions** - Discover project sessions
```bash
cc-prism sessions
```

### Interactive Mode

Launch a TUI form to configure all cast options:
```bash
cc-prism cast session.jsonl --interactive
cc-prism cast --latest -I
```

Features:
- Accordion sections for grouped options (Output, Appearance, Timing, Features)
- Profile system: auto-loads/saves `cc-prism.profile` in current directory
- Field validation with inline error messages
- vim-style navigation (j/k, g/G, Enter, Space)

See `QUICKSTART.md` and `USAGE.md` for detailed examples.

## Architecture

The codebase follows a clear pipeline architecture:

```
JSONL → Parser → Clip Extractor → ANSI Renderer → asciicast Generator → .cast file
```

**Modules:**
- `src/parser/` - JSONL parsing and clip extraction
- `src/renderer/` - ANSI rendering with theme support, markdown parsing, diff visualization, todo list rendering, fixed-position input UI, and status spinner animation
- `src/generator/` - asciicast generation with timing/markers
- `src/cli.ts` - CLI commands (cast, list, sessions)

See source code for detailed implementation.

## Development

```bash
npm install       # Install dependencies
npm run build     # Build with tsup
npm test          # Run vitest tests (185 passing)
npm run dev       # Watch mode
npm run typecheck # TypeScript validation
```

**Tech stack:**
- TypeScript with strict mode
- tsup for fast ESM bundling
- vitest for testing
- commander for CLI parsing
- chalk for terminal output

## How It Works

Claude Code stores conversations in `~/.claude/projects/` as JSONL files. Each line is a JSON object representing a message. Messages form a tree structure via parent UUID references.

cc-prism:
1. Parses JSONL and reconstructs the message tree
2. Loads agent conversations from separate files
3. Extracts the requested clip range
4. Renders each message as ANSI-styled terminal output
5. Generates asciicast v3 with timing and markers
6. Optionally uploads to asciinema.org

## Example Output

See the demo recording: https://asciinema.org/a/d6M4PZFGDK43oLrmYXnwCrvDB

## Showcase

See live demos at [onceuponaclaude.com](https://onceuponaclaude.com)

## License

MIT
