# cc-prism Quickstart

Convert Claude Code sessions to shareable asciicast recordings.

## Installation

```bash
npm install
npm run build
```

## Basic Usage

### Generate a Cast File

```bash
# From a session file
cc-prism cast ~/.claude/projects/-home-user-myproject/abc123.jsonl -o demo.cast

# Output to stdout
cc-prism cast session.jsonl > demo.cast
```

### List Messages (Find Clip Boundaries)

```bash
cc-prism list session.jsonl
```

Output:
```
UUID        TIME      TYPE        CONTENT
────────────────────────────────────────────────────────────────────────────────
msg-001..   10:00:00  user        Help me fix the auth bug
msg-002..   10:00:05  assistant   [Read, Grep]
msg-003..   10:00:10  tool-result (success)
...
```

### Interactive Picker (TUI)

```bash
# Browse and select message ranges interactively
cc-prism pick session.jsonl

# Use latest session from current project
cc-prism pick --latest
```

### Interactive Cast Options Form

```bash
# Launch TUI form to configure all cast options
cc-prism cast session.jsonl --interactive
cc-prism cast --latest -I
```

**Features:**
- Accordion sections: Output, Appearance, Timing, Features
- Profile system: auto-loads/saves `cc-prism.profile` in current directory
- Field validation with inline error messages
- vim-style navigation (j/k, g/G, Enter, Space)

**Controls:**
- `j/k` or `↑↓` - Navigate fields
- `Enter` or `Space` - Expand/collapse sections, edit fields, toggle checkboxes
- `h/l` - Cycle select field options
- `Esc` - Cancel text edit
- `Tab` - Next field
- `g/G` - Jump to first/last field

### Interactive Picker Controls

**Main View:**
- `↑↓` or `jk` - Navigate messages
- `Space` - Start/confirm selection (visual) or toggle item (cherry-pick)
- `c` - Cherry-pick mode (toggle individual items)
- `/` - Fuzzy search
- `n/N` - Next/prev match
- `Tab` - Cycle tabs: All → Selected → Preview
- `1` / `2` - Jump to All / Preview tab
- `Enter` - Open export preview
- `u/Ctrl+R` - Undo/redo
- `q` - Quit
- `Esc` - Exit modes

**Export Preview:**
Press `Enter` from main view to open full-screen export preview:
- Line numbers with dynamic width
- Colored message type headers `[type timestamp uuid]`
- Word-wrapped content with logical line numbering
- Navigation: `j/k` scroll, `Ctrl+D/U` page, `g/G` jump to start/end
- `y` - Copy preview content to clipboard
- `Enter` - Open export dialog
- `Esc` - Return to dual-pane view

**Export Dialog:**
Press `Enter` in export preview to access format selection:
- `.cast` - Generate asciicast file
- `.jsonl` - Export raw JSONL messages
- `Both` - Export both .cast and .jsonl
- `Copy command` - Copy cc-prism cast command
- `Copy UUIDs` - Copy start/end UUID pair
- `Advanced options` - Export .jsonl and launch interactive form
- Auto-suggested filenames: `{startUuid}-{endUuid}-{timestamp}`

### Extract Clips

```bash
# Last 10 messages
cc-prism cast session.jsonl --last 10 -o clip.cast

# By UUID range
cc-prism cast session.jsonl --start-uuid msg-003 --end-uuid msg-010 -o clip.cast

# By time range
cc-prism cast session.jsonl --start-time "2025-12-04T10:00:00Z" -o clip.cast
```

## Playback

### Local Playback

```bash
# Install asciinema player
pip install asciinema

# Play recording
asciinema play demo.cast
```

### Upload to asciinema.org

```bash
# Generate and upload
cc-prism cast session.jsonl --upload

# Or upload existing file
asciinema upload demo.cast
```

### Embed in Web Page

```html
<script src="https://asciinema.org/a/YOUR_ID.js" async></script>
```

## Themes

```bash
cc-prism cast session.jsonl --theme tokyo-night -o demo.cast   # default
cc-prism cast session.jsonl --theme dracula -o demo.cast
cc-prism cast session.jsonl --theme nord -o demo.cast
cc-prism cast session.jsonl --theme catppuccin-mocha -o demo.cast
```

## Timing Presets

```bash
# Demo: normalized pace, brief pauses (default)
cc-prism cast session.jsonl --preset demo

# Walkthrough: slower, typing effect
cc-prism cast session.jsonl --preset walkthrough

# Real: preserve actual timestamps
cc-prism cast session.jsonl --preset real
```

## Input Animation

Add `--input-animation` to emulate Claude Code's UI with fixed input area:

```bash
# Enable Claude Code style input UI
cc-prism cast session.jsonl --input-animation -o demo.cast
```

Features:
- Fixed-position input area at bottom with horizontal lines and arrow prompt
- Burst typing animation (words appear as chunks with exponential decay)
- Scroll region for output above input area
- Cursor automatically repositions after all output

## Status Spinner

Add `--status-spinner` to show animated processing indicator during thinking pauses:

```bash
# Enable status spinner
cc-prism cast session.jsonl --status-spinner -o demo.cast

# Combine with input animation for full Claude Code UI emulation
cc-prism cast session.jsonl --input-animation --status-spinner -o demo.cast

# Customize animation duration (default: 3.0 seconds)
cc-prism cast session.jsonl --status-spinner --spinner-duration 2.0 -o demo.cast
```

Features:
- Rotating asterisk animation (·✢✳✻✽)
- Shimmering verb text effect with character-level highlight
- Alternating verbs during long agentic sessions (throttled to 2s intervals)
- Shows TodoWrite activeForm when available
- Falls back to whimsical verbs (Clauding, Pondering, Reticulating, etc.) via hash-based selection
- Appears during thinking blocks and tool calls, not just user prompts

## Markers

Markers enable chapter navigation in the player.

```bash
--markers all    # User prompts, assistant responses, tool calls (default)
--markers user   # User prompts only
--markers tools  # Tool calls only
--markers none   # No markers
```

## Full Options

```
cc-prism cast <session> [options]

Clip Selection:
  --start-uuid <uuid>        Start from message UUID
  --end-uuid <uuid>          End at message UUID
  --last <n>                 Last N messages
  --start-time <timestamp>   Start from time (ISO 8601)
  --end-time <timestamp>     End at time

Output:
  -o, --output <file>        Output file (default: stdout)
  --upload                   Upload to asciinema.org
  -q, --quiet                Suppress stats

Theme & Timing:
  --theme <name>             Theme preset
  --preset <name>            Timing preset (demo|walkthrough|real)
  --input-animation          Enable Claude Code style input UI
  --status-spinner           Enable status spinner during thinking pauses
  --spinner-duration <n>     Spinner animation duration in seconds (default: 3.0)
  --cols <n>                 Terminal width (default: 100)
  --rows <n>                 Terminal height (default: 40)

Markers:
  --markers <mode>           all|user|tools|none (default: all)

Content:
  --no-agents                Exclude agent/sub-assistant messages
  --title <title>            Custom recording title

Interactive:
  -I, --interactive          Launch TUI form for option configuration
```

## Finding Session Files

Claude Code sessions are stored in `~/.claude/projects/`:

```bash
# List recent sessions
ls -lt ~/.claude/projects/*/

# Session files are named with UUIDs
# Example: ~/.claude/projects/-home-user-myproject/5bfa6718-abc123.jsonl
```

## Example Workflow

```bash
# 1. Find your session
ls ~/.claude/projects/-home-gulp-projects-myapp/

# 2. Preview messages (non-interactive)
cc-prism list ~/.claude/projects/-home-gulp-projects-myapp/abc123.jsonl

# 2b. Or use interactive picker with export dialog
cc-prism pick --latest
# Select messages → Enter for export preview → Enter for export dialog
# Choose format (.cast, .jsonl, or both) → Enter filename → files created

# 2c. Or use advanced options flow
cc-prism pick --latest
# Select messages → Enter → Enter → select .cast → Advanced options
# Opens interactive form with full cast configuration

# 3. Or extract with CLI directly
cc-prism cast ~/.claude/projects/-home-gulp-projects-myapp/abc123.jsonl \
  --last 20 \
  --theme tokyo-night \
  --preset demo \
  -o myapp-demo.cast

# 4. Upload and share
asciinema upload myapp-demo.cast
```
