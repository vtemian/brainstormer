# Probe Agent Design

## Problem

The current `evaluateBranch()` function in `probe-logic.ts` uses hardcoded rules:
- After 1 answer → ask priority question
- After 2 answers → force "Is the direction clear?" confirm
- After 3+ answers → done

This is too rigid. Agents should ask more questions when they feel there's more to understand.

## Solution

Replace rule-based `evaluateBranch()` with an LLM probe agent that evaluates branch context and decides whether to ask more questions or complete the branch.

## Design Decisions

| Decision | Choice |
|----------|--------|
| Context scope | Full - original request + all branches + all Q&A |
| Question types | Full set (all 14 types) for both probe and bootstrapper |
| Completion criteria | Agent decides with soft guidance (2-4 questions usually enough) |
| Model | Same as bootstrapper (Opus default), configurable via settings |
| Coordination | `processor.ts` invokes probe agent (same pattern as bootstrapper) |

## Probe Agent

**Input:**
- Original user request
- All branches with scopes
- Full Q&A history for each branch
- ID of branch that just received an answer

**Output (JSON):**
```json
// Option 1: Branch complete
{"done": true, "finding": "User wants X with Y consideration"}

// Option 2: Need more info
{"done": false, "question": {"type": "pick_one", "config": {...}}}
```

## Question Types

Full set available to both bootstrapper and probe agent:

| Type | Description |
|------|-------------|
| `pick_one` | Single choice from options |
| `pick_many` | Multiple choice |
| `ask_text` | Free text input |
| `confirm` | Yes/no confirmation |
| `slider` | Numeric range |
| `rank` | Order items by preference |
| `rate` | Rate multiple items (stars) |
| `thumbs` | Thumbs up/down |
| `show_options` | Options with pros/cons |
| `show_diff` | Code diff review |
| `ask_code` | Code input |
| `ask_image` | Image upload |
| `ask_file` | File upload |
| `emoji_react` | Emoji selection |
| `review_section` | Section review |
| `show_plan` | Plan review |

## Implementation Changes

### New File: `src/agents/probe.ts`

Agent config with prompt that:
- Receives full context
- Evaluates current branch state
- Returns done + finding OR follow-up question
- Has soft guidance for 2-4 questions per branch

### Modified: `src/agents/bootstrapper.ts`

Update to include full question type set in the prompt reference.

### Modified: `src/tools/processor.ts`

Replace:
```typescript
const result = evaluateBranch(branch);
```

With:
```typescript
const result = await runProbeAgent(state, branchId);
```

### Modified: `src/tools/probe-logic.ts`

- Keep utility functions: `extractAnswerSummary()`, helper formatters
- Remove: `evaluateBranch()`, `generateContextualFollowUp()`, `generatePriorityOptions()`

## Flow

```
User answers question in browser
         ↓
collectAnswers() receives answer
         ↓
processAnswer() records to state
         ↓
runProbeAgent() ← NEW: LLM evaluates branch
         ↓
    ┌────┴────┐
    ↓         ↓
  done?     more?
    ↓         ↓
completeBranch()  pushQuestion()
```
