# opencode-brainstormer

A brainstormer agent for OpenCode that gathers user input through a browser-based UI. Turns rough ideas into fully-formed designs through collaborative dialogue with structured questions.

## What It Does

The brainstormer agent guides you through design exploration:
1. Opens a browser window for interactive input
2. Asks structured questions (single choice, multiple choice, text input, etc.)
3. Presents design alternatives with pros/cons
4. Validates each section incrementally  
5. Produces a design document
6. Hands off to the planner for implementation

Instead of typing answers in the terminal, you respond through a visual UI with buttons, checkboxes, and text fields.

## Install

```bash
bun add opencode-brainstormer
```

Add to your OpenCode config:

```json
{
  "plugins": ["opencode-brainstormer"]
}
```

## Usage

Invoke the brainstormer agent:

```
/brainstormer I want to add a caching layer to the API
```

The agent will:
1. Open a browser window
2. Research your codebase (using background tasks)
3. Ask questions through the browser UI
4. Present 2-3 approaches with trade-offs
5. Walk through the design section by section
6. Write the design to `thoughts/shared/designs/`
7. Offer to spawn the planner for implementation

## Question Types

The browser UI supports various input types:

| Type | Use Case |
|------|----------|
| `pick_one` | Choose ONE option (approach selection) |
| `pick_many` | Select MULTIPLE options (features, constraints) |
| `confirm` | Yes/No decisions (validation, approval) |
| `ask_text` | Free-form text (descriptions, requirements) |
| `show_options` | Options with pros/cons (design alternatives) |
| `review_section` | Validate design sections |
| `show_plan` | Full document review |
| `rank` | Order items by priority |
| `rate` | Score items on a scale |
| `thumbs` | Quick up/down feedback |
| `slider` | Numeric range input |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  opencode-brainstormer plugin                │
├─────────────────────────────────────────────────────────────┤
│  Brainstormer Agent                                          │
│  ├── Design exploration prompt                              │
│  ├── Uses background_task for codebase research            │
│  └── Uses UI tools for user interaction                     │
├─────────────────────────────────────────────────────────────┤
│  UI Tools (internal)                                         │
│  ├── start_session / end_session                            │
│  ├── pick_one, pick_many, confirm, ask_text, ...           │
│  └── get_answer, list_questions, cancel_question            │
├─────────────────────────────────────────────────────────────┤
│  Session Manager → HTTP/WebSocket Server → Browser UI        │
└─────────────────────────────────────────────────────────────┘
```

## Design Output

Designs are written to:
```
thoughts/shared/designs/YYYY-MM-DD-{topic}-design.md
```

With sections:
- Problem Statement
- Constraints
- Approach
- Architecture
- Components
- Data Flow
- Error Handling
- Testing Strategy
- Open Questions

## Development

```bash
bun install
bun test
bun run typecheck
bun run build
```

### Project Structure

```
src/
├── index.ts              # Plugin entry point
├── agents/
│   ├── index.ts          # Agent exports
│   └── brainstormer.ts   # Brainstormer agent config
├── session/
│   ├── manager.ts        # Session lifecycle
│   ├── server.ts         # HTTP/WebSocket server
│   └── browser.ts        # Browser opener
├── tools/
│   ├── session.ts        # start_session, end_session
│   ├── questions.ts      # 16 question type tools
│   └── responses.ts      # get_answer, list_questions
└── ui/
    └── bundle.ts         # Browser UI (inline HTML/JS)
```

## License

MIT
