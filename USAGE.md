# cc-prism CLI Usage Guide

This guide provides command reference and common usage patterns for cc-prism. For a broader introduction, see README.md.

## Common Pitfalls

### Terminal Width/Height Options

**CORRECT:**
```bash
cc-prism cast session.jsonl --cols 120 --rows 50
```

**INCORRECT:**
```bash
cc-prism cast session.jsonl --width 120 --height 50  # Unknown options!
```

The options are `--cols` and `--rows`, not `--width` and `--height`. This is the most common mistake when using cc-prism.

## Command Reference

### cast - Generate Asciicast Files

```bash
cc-prism cast [session] [options]
```

#### Session Selection

```bash
# Use latest session from current project
cc-prism cast --latest -o demo.cast

# Specify session file path
cc-prism cast ~/.claude/projects/-home-user-myapp/abc123.jsonl -o demo.cast
```

#### Clip Extraction Options

```bash
# Extract last N messages
cc-prism cast session.jsonl --last 20

# Extract by UUID range
cc-prism cast session.jsonl --start-uuid msg-abc123 --end-uuid msg-def456

# Extract by timestamp range (ISO 8601 format)
cc-prism cast session.jsonl --start-time "2025-12-04T10:00:00Z" --end-time "2025-12-04T12:00:00Z"

# Start from UUID, take everything after
cc-prism cast session.jsonl --start-uuid msg-abc123

# Take everything before UUID
cc-prism cast session.jsonl --end-uuid msg-def456
```

#### Output Options

```bash
# Write to file
cc-prism cast session.jsonl -o demo.cast
cc-prism cast session.jsonl --output demo.cast

# Write to stdout (default)
cc-prism cast session.jsonl > demo.cast

# Suppress statistics output
cc-prism cast session.jsonl -o demo.cast --quiet
cc-prism cast session.jsonl -o demo.cast -q

# Upload to asciinema.org
cc-prism cast session.jsonl --upload
cc-prism cast session.jsonl -o demo.cast --upload  # Save locally AND upload

# Upload existing .cast file
cc-prism cast demo.cast --upload  # Detects .cast extension and uploads directly
```

#### Terminal Dimensions

```bash
# Set terminal width (default: 100)
cc-prism cast session.jsonl --cols 120

# Set terminal height (default: 40)
cc-prism cast session.jsonl --rows 50

# Both together
cc-prism cast session.jsonl --cols 120 --rows 50
```

#### Theme Options

```bash
# Select theme (default: tokyo-night)
cc-prism cast session.jsonl --theme tokyo-night
cc-prism cast session.jsonl --theme tokyo-storm
cc-prism cast session.jsonl --theme dracula
cc-prism cast session.jsonl --theme nord
cc-prism cast session.jsonl --theme catppuccin-mocha
```

#### Timing Presets

```bash
# Demo preset - normalized pace, brief pauses (default)
cc-prism cast session.jsonl --preset default

# Speedrun preset - faster playback
cc-prism cast session.jsonl --preset speedrun

# Realtime preset - preserve actual session timestamps
cc-prism cast session.jsonl --preset realtime
```

#### Advanced Timing Control

```bash
# Set maximum pause between events (in seconds)
cc-prism cast session.jsonl --max-wait 2.5

# Set pause before assistant responses (in seconds)
cc-prism cast session.jsonl --thinking-pause 1.0

# Enable typing effect for user input
cc-prism cast session.jsonl --typing-effect

# Combine timing options
cc-prism cast session.jsonl --preset default --max-wait 3.0 --thinking-pause 0.5
```

#### Status Spinner

```bash
# Status spinner is enabled by default during thinking pauses
# Disable with --no-status-spinner
cc-prism cast session.jsonl --no-status-spinner

# Customize spinner animation duration (default: 3.0 seconds)
cc-prism cast session.jsonl --spinner-duration 2.0

# Features:
# - Rotating asterisk animation (·✢✳✻✽)
# - Shimmering verb text effect with character-level highlight
# - Alternating verbs during long agentic sessions (throttled to 2s intervals)
# - Shows TodoWrite activeForm when available
# - Falls back to whimsical verbs (Clauding, Pondering, etc.) via hash-based selection
# - Appears during thinking blocks and tool calls, not just user prompts
```

#### Navigation Markers

```bash
# All markers - user prompts, assistant responses, tool calls (default)
cc-prism cast session.jsonl --markers all

# User prompts only
cc-prism cast session.jsonl --markers user

# Tool calls only
cc-prism cast session.jsonl --markers tools

# No markers
cc-prism cast session.jsonl --markers none
```

#### Content Filtering

```bash
# Exclude agent/sub-assistant messages
cc-prism cast session.jsonl --no-agents

# Set custom title
cc-prism cast session.jsonl --title "My Demo Recording"
```

#### Interactive Mode

```bash
# Launch TUI form to configure all options
cc-prism cast session.jsonl --interactive
cc-prism cast session.jsonl -I
cc-prism cast --latest -I

# Features:
# - Accordion sections: Output, Appearance, Timing, Features
# - Auto-loads cc-prism.profile from current directory
# - Save profile button to persist settings
# - Field validation with inline errors
# - vim-style navigation: j/k move, Enter/Space toggle sections
# - Text/number fields: Enter to edit, Esc to cancel
# - Select fields: h/l or Space to cycle options
# - Checkboxes: Space to toggle
```

#### Complete Example

```bash
cc-prism cast --latest \
  --last 30 \
  --theme tokyo-night \
  --preset default \
  --cols 120 \
  --rows 50 \
  --markers all \
  --title "Authentication Bug Fix Demo" \
  -o auth-fix.cast \
  --upload
```

### list - Browse Session Messages

```bash
cc-prism list <session> [options]
```

#### Basic Usage

```bash
# List all renderable messages
cc-prism list session.jsonl

# Show all messages including non-renderable
cc-prism list session.jsonl --all

# Exclude agent/sub-assistant messages
cc-prism list session.jsonl --no-agents
```

#### Output Format

```
UUID        TIME      TYPE        CONTENT
────────────────────────────────────────────────────────────────────────────────
msg-001..   10:00:00  user        Help me fix the auth bug
msg-002..   10:00:05  assistant   [Read, Grep]
msg-003..   10:00:10  tool-result (success)
msg-004..   10:00:15  assistant   I found the issue in auth.ts
────────────────────────────────────────────────────────────────────────────────
Total: 4 messages | User: 1 | Assistant: 2 | Tools: 1
```

#### Use Cases

```bash
# Find UUID boundaries for clip extraction
cc-prism list session.jsonl | grep "user"

# Preview session structure
cc-prism list session.jsonl | head -20

# Count total messages
cc-prism list session.jsonl --all
```

### pick - Interactive Message Picker

```bash
cc-prism pick [session] [options]
```

Interactive TUI for browsing and selecting message ranges from sessions. Features dual-pane layout with message list and preview pane.

#### Session Selection

```bash
# Use latest session from current project
cc-prism pick --latest

# Specify session file path
cc-prism pick ~/.claude/projects/-home-user-myapp/abc123.jsonl
```

#### Selection Modes

**Visual Mode (Default):**
- Navigate with `j/k` or arrow keys
- Press `space` to confirm range selection
- Selected range shows highlighted in preview

**Cherry-Pick Mode:**
- Press `c` to enter cherry-pick mode
- Press `space` to toggle individual items
- Press `Esc` to return to visual mode

#### Tab Navigation

Switch between views with Tab or number shortcuts:

- `Tab` - Cycle: All → Selected → Preview
- `Shift+Tab` - Reverse cycle: Preview → Selected → All
- `1` - Focus message list (All tab)
- `2` - Focus preview pane
- `3` - Jump to Selected tab

#### Export Preview

Press `Enter` (on main view) to open full-screen export preview:

**Features:**
- Full-width view of all selected messages
- Line numbers with dynamic width
- Colored message type headers `[type timestamp uuid]`
- Word-wrapped content with logical line numbering
- Line cursor (yellow highlight) for current position

**Navigation:**
- `j/k` - Scroll line by line
- `Ctrl+D/U` - Page down/up
- `g` - Jump to first line
- `G` - Jump to last line
- `y` - Copy preview content to clipboard
- `Enter` - Open export dialog
- `Esc` - Return to dual-pane view

#### Export Dialog

After pressing `Enter` in export preview, choose export format:

**Single Range Dialog:**
- `.cast` - Generate asciicast file
- `.jsonl` - Export raw JSONL messages
- `Both` - Export both .cast and .jsonl
- `Copy command` - Copy cc-prism cast command to clipboard
- `Copy UUIDs` - Copy start/end UUID pair
- `y` - Copy command at any time (quick access)
- `Advanced options` - Export .jsonl and launch interactive cast form

**Multiple Ranges Dialog:**
- Choose mode: `Single (Concatenated)` or `Multiple ranges`
- Choose format: `.jsonl`, `.cast`, or `both`
- `Confirm` - Proceed to filename input
- `Copy commands` - Copy all cc-prism commands (multiple mode only)
- `Advanced options` - Export .jsonl and launch interactive form

**Filename Input:**
- Auto-suggested filename: `{startUuid}-{endUuid}-{timestamp}`
- Leave empty to use suggestion
- Extension added automatically
- `Enter` to confirm, `Esc` to cancel

#### Search

```bash
# Press / to enter search mode
# Type fuzzy search query
# Press n/N to jump between matches
# Press Esc to exit search
```

Uses Fuse.js for fuzzy matching across message content.

#### Keyboard Reference

**Main View:**

| Key | Action |
|-----|--------|
| `j/k` or `↑↓` | Navigate messages |
| `Space` | Start/confirm selection (visual) / Toggle item (cherry-pick) |
| `c` | Enter cherry-pick mode |
| `/` | Search mode |
| `n/N` | Next/previous match |
| `Tab` | Cycle tabs: All → Selected → Preview |
| `Shift+Tab` | Reverse cycle tabs |
| `1` / `2` | Jump to All / Preview tab |
| `Enter` | Open export preview |
| `u` | Undo last change |
| `Ctrl+R` | Redo |
| `Esc` | Exit current mode |
| `q` | Quit |
| `Ctrl+C` | Quit without output |

**Export Preview:**

| Key | Action |
|-----|--------|
| `j/k` or `↑↓` | Scroll line by line |
| `Ctrl+D/U` | Page down/up |
| `g` / `G` | Jump to start/end |
| `y` | Copy content to clipboard |
| `Enter` | Open export dialog |
| `Esc` | Return to main view |

**Export Dialog:**

| Key | Action |
|-----|--------|
| `j/k` or `↑↓` | Navigate options |
| `Space` / `Enter` | Select option |
| `y` | Copy command (quick access) |
| `Esc` | Cancel and return |

#### Options

```bash
# Exclude agent/sub-assistant messages
cc-prism pick session.jsonl --no-agents
```

#### Example Workflow

```bash
# 1. Open picker with latest session
cc-prism pick --latest

# 2. Navigate to interesting message range
# Use j/k to scroll, / to search, Tab to switch views

# 3. Select range
# Press space to start selection, navigate to end, press space again
# Or press c for cherry-pick mode and space to toggle individual messages

# 4. Preview selection
# Press Enter to open full-screen export preview
# Navigate with j/k, g/G to jump, y to copy content

# 5. Export files
# Press Enter in export preview to open dialog
# Choose format (.cast, .jsonl, or both)
# Enter filename or use auto-suggestion
# Files are written to current directory

# 6. Advanced workflow (optional)
# In single range dialog, select .cast format
# Choose "Advanced options" to launch interactive form
# Configure all cast options with full TUI
```

### sessions - Discover Project Sessions

```bash
cc-prism sessions
```

Lists available session files for the current project.

#### Output Format

```
Sessions for /home/user/myproject
/home/user/.claude/projects/-home-user-myproject

abc12345  2h ago      45.2 KB
def67890  1d ago      128.5 KB
ghi23456  3d ago      89.1 KB

Use: cc-prism cast --latest
```

## Common Workflows

### Quick Demo Recording

```bash
# Generate and upload in one command
cc-prism cast --latest --last 20 --upload
```

### Create Polished Demo

```bash
# 1. Find your session
cc-prism sessions

# 2. Preview messages to find interesting range
cc-prism list ~/.claude/projects/-home-user-myapp/abc123.jsonl

# 3. Extract and customize
cc-prism cast ~/.claude/projects/-home-user-myapp/abc123.jsonl \
  --start-uuid msg-abc123 \
  --end-uuid msg-def456 \
  --theme dracula \
  --preset default \
  --cols 120 \
  --title "Feature Implementation Demo" \
  -o demo.cast

# 4. Review locally
asciinema play demo.cast

# 5. Upload when ready
asciinema upload demo.cast
```

### Extract Last Conversation

```bash
# Get just the last exchange
cc-prism cast --latest --last 5 -o last-exchange.cast
```

### Create Educational Walkthrough

```bash
cc-prism cast session.jsonl \
  --preset realtime \
  --theme nord \
  --cols 100 \
  --title "Step-by-Step: Debug Process" \
  -o walkthrough.cast
```

## Option Quick Reference

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--latest` | flag | - | Use most recent session from current project |
| `--start-uuid <uuid>` | string | - | Start from message UUID |
| `--end-uuid <uuid>` | string | - | End at message UUID |
| `--last <n>` | number | - | Extract last N messages |
| `--start-time <iso>` | string | - | Start from timestamp (ISO 8601) |
| `--end-time <iso>` | string | - | End at timestamp (ISO 8601) |
| `-o, --output <file>` | string | stdout | Output file path |
| `--theme <name>` | string | tokyo-night | Theme preset |
| `--preset <name>` | string | default | Timing preset (speedrun\|default\|realtime) |
| `--max-wait <sec>` | number | - | Maximum pause between events |
| `--thinking-pause <sec>` | number | - | Pause before assistant response |
| `--typing-effect` | flag | false | Enable typing effect |
| `--no-status-spinner` | flag | false | Disable status spinner (enabled by default) |
| `--spinner-duration <sec>` | number | 3.0 | Duration of spinner animation |
| `--cols <n>` | number | 100 | Terminal width |
| `--rows <n>` | number | 40 | Terminal height |
| `--markers <mode>` | string | all | Marker mode (all\|user\|tools\|none) |
| `--title <title>` | string | auto | Recording title |
| `--upload` | flag | false | Upload to asciinema.org |
| `--no-agents` | flag | false | Exclude agent/sub-assistant messages |
| `-q, --quiet` | flag | false | Suppress stats output |
| `-I, --interactive` | flag | false | Launch interactive options form |

## Profile System

cc-prism supports saving default cast options to a profile file:

```bash
# Profile file: cc-prism.profile (current directory)
# JSON format with snake_case keys matching CLI options

# When using --interactive mode:
# - Profile auto-loads if present
# - "Save profile" button persists current settings
# - Profile only affects interactive mode, not direct CLI flags

# Example profile:
{
  "theme": "dracula",
  "cols": 120,
  "rows": 50,
  "preset": "default",
  "no_status_spinner": false,
  "markers": "all"
}
```

## Getting Help

```bash
# Show help for all commands
cc-prism --help

# Show help for specific command
cc-prism cast --help
cc-prism list --help
cc-prism sessions --help

# Show version
cc-prism --version
```

## Finding Session Files

Claude Code stores sessions in `~/.claude/projects/`:

```bash
# List projects
ls ~/.claude/projects/

# List sessions for a project (replace slashes with dashes in path)
ls -lt ~/.claude/projects/-home-user-myproject/

# Session files are named with UUIDs
# Example: 5bfa6718-abc123.jsonl
```

Project path encoding:
- `/home/user/myproject` becomes `-home-user-myproject`
- Each slash is replaced with a dash
- The leading slash becomes a leading dash
