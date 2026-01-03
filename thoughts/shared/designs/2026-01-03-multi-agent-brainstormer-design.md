---
date: 2026-01-03
topic: "Multi-Agent Brainstormer Architecture"
status: validated
---

## Problem Statement

The current single-agent brainstormer has slow perceived startup time. The agent thinks for 5-10 seconds before opening the browser with questions. Users wait with no feedback.

We want to split the brainstormer into multiple agents to:
1. Get the browser open faster (boot phase)
2. Generate follow-up questions progressively based on answers
3. Make behavior more deterministic by giving each agent a single responsibility

## Constraints

- Must use existing OpenCode plugin infrastructure
- Subagents are stateless - context must be passed via prompt
- All agents use `anthropic/claude-opus-4-5` model
- No unit tests for agent prompts - behavior is non-deterministic

## Approach

Split into three agents:

| Agent | Mode | Responsibility |
|-------|------|----------------|
| **brainstormer** | primary | Orchestrator - coordinates flow, no creative decisions |
| **bootstrapper** | subagent | Fast initial questions (2-3) |
| **probe** | subagent | Thoughtful follow-ups (1 at a time) |

The orchestrator pattern makes behavior deterministic - creative work is isolated in focused subagents.

## Architecture

```
User Request
     │
     ▼
┌─────────────┐
│ brainstormer│ (orchestrator)
│ - spawns subagents
│ - manages session
│ - accumulates context
└─────────────┘
     │
     ├──► bootstrapper (fast)
     │         │
     │         ▼
     │    [q1, q2, q3]
     │         │
     │    start_session
     │
     └──► LOOP:
              get_next_answer
                   │
                   ▼
              ┌─────────┐
              │  probe  │ ← full context
              └─────────┘
                   │
                   ▼
              {done?, question}
                   │
              push question
              (repeat until done)
                   │
              end_session
```

## Components

### brainstormer (orchestrator)

| Setting | Value |
|---------|-------|
| Model | `anthropic/claude-opus-4-5` |
| Temperature | `0.7` |
| Mode | `primary` |

**Behaviors:**
- Immediately spawns bootstrapper on user request
- Parses JSON responses from subagents
- Builds context string after each answer (Q1: ... A1: ...)
- Passes full accumulated context to probe each time
- Calls end_session when probe returns `done: true`
- Writes design document at the end

**Does NOT:**
- Generate questions itself
- Make creative decisions
- Decide when design is complete (probe decides)

### bootstrapper (subagent)

| Setting | Value |
|---------|-------|
| Model | `anthropic/claude-opus-4-5` |
| Temperature | `0.5` |
| Mode | `subagent` |

**Input:** User's original request
**Output:** JSON array of 2-3 question objects

**Principles:**
- Speed over perfection
- Generic questions are fine - just conversation starters
- Use simple types (pick_one, ask_text)

### probe (subagent)

| Setting | Value |
|---------|-------|
| Model | `anthropic/claude-opus-4-5` |
| Temperature | `0.6` |
| Mode | `subagent` |

**Input:** Original request + all Q&A history
**Output:** JSON with `{done: boolean, question?: object, reason: string}`

**Principles:**
- Each question builds on previous answers
- Go deeper, not wider
- Set `done: true` after 8-12 questions typically
- Don't repeat questions already asked

## Data Flow

### Context Format

brainstormer passes this to probe:

```
ORIGINAL REQUEST:
{user's idea/request}

CONVERSATION:
Q1 [pick_one]: What's the primary goal?
A1: User selected "simplicity"

Q2 [ask_text]: Any constraints?
A2: User wrote: "Must work on macOS and Linux"

Q3 [pick_many]: Which features are essential?
A3: User selected: "sync", "backup"
```

### Answer Parsing

| Question Type | Context Summary |
|---------------|-----------------|
| pick_one | "User selected '{label}'" |
| pick_many | "User selected: {labels joined}" |
| confirm | "User said {yes/no}" |
| ask_text | "User wrote: {text}" |
| show_options | "User chose '{label}'" + feedback |
| thumbs | "User gave thumbs {up/down}" |
| slider | "User set value to {value}" |
| rank | "User ranked: 1. {first}, 2. {second}, ..." |
| rate | "User rated: {item}: {rating}, ..." |

## Error Handling

| Error | Handling |
|-------|----------|
| bootstrapper returns invalid JSON | Retry once, then fall back to 2 generic questions |
| probe returns invalid JSON | Retry once with same context |
| probe keeps returning questions | Instruction to finish within 8-12 questions |
| User closes browser | Session ends, report incomplete |
| Subagent times out | Continue with what we have |

No complex retry logic. Fail gracefully.

## Testing Strategy

Manual testing only (agent behavior is non-deterministic):

| Test | Expected |
|------|----------|
| Start with simple request | Browser opens within 3-5 seconds |
| Answer first question | New question appears while answering others |
| Check probe's questions | Each builds on previous answers |
| Complete ~8-10 questions | probe returns `done: true`, session ends |
| Review design doc | Captures key decisions from Q&A |

## Open Questions

None - design is validated and ready for implementation.
