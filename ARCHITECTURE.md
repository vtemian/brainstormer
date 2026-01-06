# Architecture

## Overview

Octto is an OpenCode plugin that enables interactive design exploration through a browser-based UI. It turns rough ideas into design documents by asking structured questions via a visual interface rather than terminal text.

## Tech Stack

| Category | Technology |
|----------|------------|
| Runtime | Bun |
| Language | TypeScript (ES2022, ESM) |
| Framework | OpenCode Plugin SDK (`@opencode-ai/plugin`) |
| Server | Bun's built-in HTTP/WebSocket server |
| UI | Vanilla HTML/CSS/JS (bundled inline) |
| Linting/Formatting | Biome |
| Testing | Bun's built-in test runner |

## Directory Structure

```
src/
├── index.ts              # Plugin entry point, exports Plugin interface
├── types.ts              # Shared type definitions (configs, responses)
├── agents/               # AI agent definitions
│   ├── index.ts          # Agent registry export
│   ├── octto.ts          # Orchestrator agent (coordinates flow)
│   ├── bootstrapper.ts   # Generates initial questions (fast)
│   ├── probe.ts          # Generates follow-up questions (thoughtful)
│   └── context.ts        # Q&A context builder for probe
├── session/              # Session lifecycle management
│   ├── types.ts          # Session/Question types, WebSocket messages
│   ├── manager.ts        # SessionManager class (core state)
│   ├── server.ts         # HTTP/WebSocket server creation
│   └── browser.ts        # Cross-platform browser opener
├── tools/                # MCP tools exposed to agents
│   ├── index.ts          # Tool factory combining all tools
│   ├── session.ts        # start_session, end_session
│   ├── questions.ts      # Question type tools (pick_one, ask_text, etc.)
│   └── responses.ts      # get_answer, get_next_answer, list_questions
└── ui/
    └── bundle.ts         # Self-contained HTML/CSS/JS for browser UI

tests/
├── session/              # Unit tests for session management
├── tools/                # Unit tests for tools
├── agents/               # Unit tests for agent helpers
└── integration/          # End-to-end flow tests
```

## Core Components

### Plugin Entry (`src/index.ts`)

- Implements OpenCode's `Plugin` interface
- Creates `SessionManager` singleton
- Wraps tools to track session ownership per OpenCode session
- Handles `session.deleted` events to cleanup octto sessions

### Multi-Agent Architecture

The plugin uses three specialized agents:

| Agent | Role | Model | Mode |
|-------|------|-------|------|
| **octto** | Orchestrator - coordinates flow, manages session | claude-opus-4-5 | primary |
| **bootstrapper** | Generates 2-3 fast initial questions | claude-opus-4-5 | subagent |
| **probe** | Generates thoughtful follow-ups based on context | claude-opus-4-5 | subagent |

**Flow:**
```
User Request
     │
     ▼
octto (orchestrator)
     │
     ├──► bootstrapper → [q1, q2, q3]
     │                        │
     │                   start_session
     │
     └──► LOOP:
              get_next_answer
                   │
                   ▼
              probe (with full Q&A context)
                   │
                   ▼
              {done?, question}
                   │
              push question (repeat until done)
                   │
              end_session → write design doc
```

### SessionManager (`src/session/manager.ts`)

Central state manager for all octto sessions:

- **Sessions**: `Map<sessionId, Session>` - active sessions with their servers
- **Questions**: Each session has `Map<questionId, Question>` - question queue
- **Waiters**: Promise-based blocking for `getAnswer` and `getNextAnswer`

Key methods:
- `startSession()` - Creates server, opens browser, returns session_id
- `endSession()` - Sends end message, stops server, cleans up
- `pushQuestion()` - Adds question to session, sends via WebSocket
- `getAnswer()` - Get specific question's answer (blocking or non-blocking)
- `getNextAnswer()` - Get any answered question (user-order, not push-order)
- `handleWsMessage()` - Process responses from browser

### HTTP/WebSocket Server (`src/session/server.ts`)

Each session gets its own server on a random port:

- `GET /` - Serves bundled HTML UI
- `GET /ws` - WebSocket upgrade for real-time communication

WebSocket messages:
- Server → Client: `question`, `cancel`, `end`
- Client → Server: `response`, `connected`

### Browser UI (`src/ui/bundle.ts`)

Self-contained HTML with inline CSS and JavaScript:

- Connects to WebSocket on load
- Renders question queue (one active, rest collapsed)
- Supports 15 question types with appropriate UI components
- Shows answered questions in read-only collapsed state
- "Thinking..." indicator when waiting for next question

## Data Flow

### Question Lifecycle

```
1. Agent calls tool (e.g., pick_one)
2. Tool calls manager.pushQuestion()
3. Manager creates Question object (status: pending)
4. If WebSocket connected: send to browser
5. User answers in browser
6. Browser sends response via WebSocket
7. Manager updates Question (status: answered)
8. Manager notifies waiters (getAnswer/getNextAnswer)
9. Agent receives answer
```

### Context Building for Probe

The `context.ts` module formats Q&A history for the probe agent:

```
ORIGINAL REQUEST:
{user's idea}

CONVERSATION:
Q1 [pick_one]: What's the primary goal?
A1: User selected "simplicity"

Q2 [ask_text]: Any constraints?
A2: User wrote: "Must work with existing Redis setup"

PENDING QUESTIONS:
Q3 [pick_many]: Which features are essential?
```

## Question Types

| Type | Purpose | Response Shape |
|------|---------|----------------|
| `pick_one` | Single selection | `{ selected: string }` |
| `pick_many` | Multiple selection | `{ selected: string[] }` |
| `confirm` | Yes/No decision | `{ choice: "yes" \| "no" \| "cancel" }` |
| `ask_text` | Free-form text | `{ text: string }` |
| `ask_code` | Code with syntax highlighting | `{ code: string, language?: string }` |
| `ask_image` | Image upload | `{ images: [{filename, mimeType, data}] }` |
| `ask_file` | File upload | `{ files: [{filename, mimeType, data}] }` |
| `show_options` | Options with pros/cons | `{ selected: string, feedback?: string }` |
| `show_diff` | Before/after comparison | `{ decision: "approve" \| "reject" \| "edit" }` |
| `show_plan` | Document review | `{ decision, annotations, feedback }` |
| `review_section` | Section review | `{ decision, feedback }` |
| `rank` | Drag-to-order | `{ ranking: [{id, rank}] }` |
| `rate` | Numeric rating | `{ ratings: Record<string, number> }` |
| `thumbs` | Quick up/down | `{ choice: "up" \| "down" }` |
| `slider` | Numeric range | `{ value: number }` |
| `emoji_react` | Emoji selection | `{ emoji: string }` |

## Configuration

### Environment

No environment variables required. The plugin auto-selects available ports.

### Build Configuration

- **tsconfig.json**: ES2022 target, bundler module resolution, strict mode
- **biome.json**: 2-space indent, 120 line width, double quotes, recommended rules

## Build & Deploy

```bash
# Install dependencies
bun install

# Run tests
bun test

# Type check
bun run typecheck

# Build for distribution
bun run build

# Format code
bun run format

# Lint
bun run lint
```

Output: `dist/` directory with ESM bundle and TypeScript declarations.

## Design Output

Brainstorming sessions produce design documents at:
```
thoughts/shared/designs/YYYY-MM-DD-{topic}-design.md
```

## External Integrations

| Integration | Purpose |
|-------------|---------|
| OpenCode Plugin SDK | Plugin interface, tool definitions, agent config |
| System browser | Opens UI via platform-specific commands (open/xdg-open/start) |
