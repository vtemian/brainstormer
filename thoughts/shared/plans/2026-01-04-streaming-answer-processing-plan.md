# Streaming Answer Processing Implementation Plan

**Goal:** Spawn probe after EACH answer instead of waiting for all answers, enabling immediate user engagement.

**Architecture:** Modify brainstormer's workflow to process answers one at a time in a loop. Update context format to indicate pending questions. Probe already handles partial context gracefully.

**Design:** Based on design provided in task (no separate design document).

---

## Task 1: Add Pending Question Indicator to Context Builder

**Files:**
- Modify: `src/agents/context.ts:113-129`
- Test: `tests/agents/context.test.ts`

### Step 1: Write the failing test for pending question indicator

Add this test to `tests/agents/context.test.ts`:

```typescript
// tests/agents/context.test.ts
// Add after the existing buildProbeContext tests (around line 132)

describe("buildProbeContext with pending questions", () => {
  it("should show pending questions indicator", () => {
    const qaPairs: QAPair[] = [
      {
        questionNumber: 1,
        questionType: "pick_one",
        questionText: "What's the primary goal?",
        answer: { selected: "speed" },
        config: { options: [{ id: "speed", label: "Fast performance" }] },
      },
    ];
    const pendingQuestions = [
      { questionNumber: 2, questionType: "ask_text" as const, questionText: "Any constraints?" },
      { questionNumber: 3, questionType: "pick_many" as const, questionText: "Which features?" },
    ];

    const result = buildProbeContext("Build a CLI tool", qaPairs, pendingQuestions);

    expect(result).toContain("ORIGINAL REQUEST:");
    expect(result).toContain("Build a CLI tool");
    expect(result).toContain("CONVERSATION:");
    expect(result).toContain("Q1 [pick_one]: What's the primary goal?");
    expect(result).toContain('A1: User selected "Fast performance"');
    expect(result).toContain("PENDING QUESTIONS:");
    expect(result).toContain("Q2 [ask_text]: Any constraints?");
    expect(result).toContain("Q3 [pick_many]: Which features?");
  });

  it("should not show pending section when no pending questions", () => {
    const qaPairs: QAPair[] = [
      {
        questionNumber: 1,
        questionType: "confirm",
        questionText: "Ready?",
        answer: { choice: "yes" },
        config: {},
      },
    ];

    const result = buildProbeContext("Build a CLI tool", qaPairs, []);

    expect(result).toContain("CONVERSATION:");
    expect(result).not.toContain("PENDING QUESTIONS:");
  });

  it("should handle all questions pending (no answers yet)", () => {
    const pendingQuestions = [
      { questionNumber: 1, questionType: "pick_one" as const, questionText: "Goal?" },
      { questionNumber: 2, questionType: "ask_text" as const, questionText: "Constraints?" },
    ];

    const result = buildProbeContext("Build a CLI tool", [], pendingQuestions);

    expect(result).toContain("(No questions answered yet)");
    expect(result).toContain("PENDING QUESTIONS:");
    expect(result).toContain("Q1 [pick_one]: Goal?");
    expect(result).toContain("Q2 [ask_text]: Constraints?");
  });
});
```

### Step 2: Run test to verify it fails

Run: `bun test tests/agents/context.test.ts`

Expected: FAIL with error about `buildProbeContext` not accepting third argument

### Step 3: Add PendingQuestion interface and update buildProbeContext

Edit `src/agents/context.ts`:

```typescript
// src/agents/context.ts

import type { QuestionType } from "../session/types";

export interface QAPair {
  questionNumber: number;
  questionType: QuestionType;
  questionText: string;
  answer: unknown;
  config: unknown;
}

export interface PendingQuestion {
  questionNumber: number;
  questionType: QuestionType;
  questionText: string;
}

/**
 * Formats a single answer based on question type.
 * Maps response objects to human-readable summaries.
 */
export function formatAnswer(questionType: QuestionType, answer: unknown, config: unknown): string {
  if (!answer || typeof answer !== "object") {
    return "User did not respond";
  }

  const ans = answer as Record<string, unknown>;
  const cfg = config as Record<string, unknown>;

  switch (questionType) {
    case "pick_one": {
      const selected = ans.selected as string | undefined;
      if (!selected) return "User did not select";
      const options = (cfg.options as Array<{ id: string; label: string }>) || [];
      const option = options.find((o) => o.id === selected);
      return `User selected "${option?.label || selected}"`;
    }

    case "pick_many": {
      const selected = ans.selected as string[] | undefined;
      if (!selected || selected.length === 0) return "User selected nothing";
      const options = (cfg.options as Array<{ id: string; label: string }>) || [];
      const labels = selected.map((id) => {
        const opt = options.find((o) => o.id === id);
        return opt?.label || id;
      });
      return `User selected: ${labels.map((l) => `"${l}"`).join(", ")}`;
    }

    case "confirm": {
      const choice = ans.choice as string | undefined;
      if (choice === "yes") return "User said yes";
      if (choice === "no") return "User said no";
      if (choice === "cancel") return "User cancelled";
      return "User did not respond";
    }

    case "ask_text": {
      const text = ans.text as string | undefined;
      if (!text) return "User provided no text";
      return `User wrote: "${text}"`;
    }

    case "show_options": {
      const selected = ans.selected as string | undefined;
      const feedback = ans.feedback as string | undefined;
      if (!selected) return "User did not select";
      const options = (cfg.options as Array<{ id: string; label: string }>) || [];
      const option = options.find((o) => o.id === selected);
      let result = `User chose "${option?.label || selected}"`;
      if (feedback) result += ` with feedback: "${feedback}"`;
      return result;
    }

    case "thumbs": {
      const choice = ans.choice as string | undefined;
      if (choice === "up") return "User gave thumbs up";
      if (choice === "down") return "User gave thumbs down";
      return "User did not respond";
    }

    case "slider": {
      const value = ans.value as number | undefined;
      if (value === undefined) return "User did not set value";
      return `User set value to ${value}`;
    }

    case "rank": {
      const ranking = ans.ranking as string[] | undefined;
      if (!ranking || ranking.length === 0) return "User did not rank";
      const options = (cfg.options as Array<{ id: string; label: string }>) || [];
      const ranked = ranking.map((id, i) => {
        const opt = options.find((o) => o.id === id);
        return `${i + 1}. ${opt?.label || id}`;
      });
      return `User ranked: ${ranked.join(", ")}`;
    }

    case "rate": {
      const ratings = ans.ratings as Record<string, number> | undefined;
      if (!ratings) return "User did not rate";
      const options = (cfg.options as Array<{ id: string; label: string }>) || [];
      const rated = Object.entries(ratings).map(([id, rating]) => {
        const opt = options.find((o) => o.id === id);
        return `${opt?.label || id}: ${rating}`;
      });
      return `User rated: ${rated.join(", ")}`;
    }

    default:
      return `User responded: ${JSON.stringify(answer)}`;
  }
}

/**
 * Builds the full context string for the probe agent.
 * Includes answered questions and optionally pending questions.
 */
export function buildProbeContext(
  originalRequest: string,
  qaPairs: QAPair[],
  pendingQuestions: PendingQuestion[] = [],
): string {
  let context = `ORIGINAL REQUEST:\n${originalRequest}\n\n`;

  if (qaPairs.length === 0) {
    context += "CONVERSATION:\n(No questions answered yet)\n";
  } else {
    context += "CONVERSATION:\n";
    for (const qa of qaPairs) {
      const formattedAnswer = formatAnswer(qa.questionType, qa.answer, qa.config);
      context += `Q${qa.questionNumber} [${qa.questionType}]: ${qa.questionText}\n`;
      context += `A${qa.questionNumber}: ${formattedAnswer}\n\n`;
    }
  }

  if (pendingQuestions.length > 0) {
    context += "\nPENDING QUESTIONS:\n";
    for (const pq of pendingQuestions) {
      context += `Q${pq.questionNumber} [${pq.questionType}]: ${pq.questionText}\n`;
    }
  }

  return context.trim();
}
```

### Step 4: Run test to verify it passes

Run: `bun test tests/agents/context.test.ts`

Expected: PASS - all tests including new pending question tests

### Step 5: Commit

```bash
git add src/agents/context.ts tests/agents/context.test.ts
git commit -m "feat(context): add pending questions indicator to probe context"
```

---

## Task 2: Update Brainstormer Workflow Prompt

**Files:**
- Modify: `src/agents/brainstormer.ts:21-35` (workflow section)
- Modify: `src/agents/brainstormer.ts:57-72` (context-format section)

### Step 1: Update the workflow section

Edit `src/agents/brainstormer.ts` lines 21-35, replacing the workflow:

**Old (lines 21-35):**
```typescript
<workflow>
1. User gives request
2. IMMEDIATELY spawn bootstrapper with the request
3. Parse bootstrapper's JSON array of questions
4. Call start_session with those questions
5. Enter answer loop:
   a. get_next_answer(block=true)
   b. Add Q&A to context
   c. Spawn probe with full context
   d. Parse probe's JSON response
   e. If done: false, push probe's question
   f. If done: true, exit loop
6. Call end_session
7. Write design document
</workflow>
```

**New:**
```typescript
<workflow>
1. User gives request
2. IMMEDIATELY spawn bootstrapper with the request
3. Parse bootstrapper's JSON array of questions
4. Call start_session with those questions
5. Track: answered_questions = [], pending_questions = [all initial questions]
6. Enter streaming answer loop:
   a. get_next_answer(block=true) - wait for ONE answer
   b. Move answered question from pending to answered list
   c. Build context with answered Q&As AND pending questions
   d. Spawn probe with partial context
   e. Parse probe's JSON response
   f. If done: false, add probe's question to pending list, push to session
   g. If done: true, exit loop
   h. Repeat from (a)
7. Call end_session
8. Write design document
</workflow>
```

### Step 2: Update the context-format section

Edit `src/agents/brainstormer.ts` lines 57-72, replacing the context-format:

**Old (lines 57-72):**
```typescript
<context-format>
Build this context string for probe:

ORIGINAL REQUEST:
{user's original request}

CONVERSATION:
Q1 [pick_one]: What's the primary goal?
A1: User selected "simplicity"

Q2 [ask_text]: Any constraints?
A2: User wrote: "Must work on macOS and Linux"

Q3 [pick_many]: Which features are essential?
A3: User selected: "sync", "backup"
</context-format>
```

**New:**
```typescript
<context-format>
Build this context string for probe (include pending questions):

ORIGINAL REQUEST:
{user's original request}

CONVERSATION:
Q1 [pick_one]: What's the primary goal?
A1: User selected "simplicity"

PENDING QUESTIONS:
Q2 [ask_text]: Any constraints?
Q3 [pick_many]: Which features are essential?

Note: Probe sees partial context and can engage immediately.
After each answer, rebuild context with updated answered/pending lists.
</context-format>
```

### Step 3: Apply the edits to brainstormer.ts

The full updated prompt section (lines 9-179) should be:

```typescript
  prompt: `<purpose>
Orchestrate brainstorming sessions. You coordinate subagents and manage the session.
You do NOT generate questions yourself - subagents do that.
</purpose>

<critical-rules>
  <rule priority="HIGHEST">IMMEDIATELY spawn bootstrapper on user request - no thinking first</rule>
  <rule priority="HIGH">Parse JSON from subagents - they return structured data</rule>
  <rule priority="HIGH">Build context string after each answer for probe</rule>
  <rule>Call end_session when probe returns done: true</rule>
</critical-rules>

<workflow>
1. User gives request
2. IMMEDIATELY spawn bootstrapper with the request
3. Parse bootstrapper's JSON array of questions
4. Call start_session with those questions
5. Track: answered_questions = [], pending_questions = [all initial questions]
6. Enter streaming answer loop:
   a. get_next_answer(block=true) - wait for ONE answer
   b. Move answered question from pending to answered list
   c. Build context with answered Q&As AND pending questions
   d. Spawn probe with partial context
   e. Parse probe's JSON response
   f. If done: false, add probe's question to pending list, push to session
   g. If done: true, exit loop
   h. Repeat from (a)
7. Call end_session
8. Write design document
</workflow>

<spawning-subagents>
Use background_task to spawn subagents:

Bootstrapper (for initial questions):
background_task(
  agent="bootstrapper",
  description="Generate initial questions",
  prompt="Generate 2-3 initial questions for: {user's request}"
)

Probe (for follow-ups):
background_task(
  agent="probe", 
  description="Generate follow-up question",
  prompt="{full context string with pending questions}"
)

Then use background_output(task_id, block=true) to get the result.
</spawning-subagents>

<context-format>
Build this context string for probe (include pending questions):

ORIGINAL REQUEST:
{user's original request}

CONVERSATION:
Q1 [pick_one]: What's the primary goal?
A1: User selected "simplicity"

PENDING QUESTIONS:
Q2 [ask_text]: Any constraints?
Q3 [pick_many]: Which features are essential?

Note: Probe sees partial context and can engage immediately.
After each answer, rebuild context with updated answered/pending lists.
</context-format>

<answer-formatting>
Format answers based on question type:
- pick_one: User selected "{label}"
- pick_many: User selected: "{label1}", "{label2}"
- confirm: User said yes/no
- ask_text: User wrote: "{text}"
- show_options: User chose "{label}" [+ feedback if any]
- thumbs: User gave thumbs up/down
- slider: User set value to {value}
- rank: User ranked: 1. {first}, 2. {second}, ...
- rate: User rated: {item}: {rating}, ...
</answer-formatting>

<parsing-subagent-responses>
Bootstrapper returns JSON array:
[
  {"type": "pick_one", "config": {...}},
  {"type": "ask_text", "config": {...}}
]

Probe returns JSON object:
{"done": false, "reason": "...", "question": {"type": "...", "config": {...}}}
or
{"done": true, "reason": "..."}

Parse these with JSON.parse(). If parsing fails, retry once.
</parsing-subagent-responses>

<error-handling>
- If bootstrapper returns invalid JSON: retry once, then use 2 generic questions
- If probe returns invalid JSON: retry once with same context
- If probe keeps returning questions past 15: force done
- If user closes browser: end session, report incomplete
</error-handling>

<fallback-questions>
If bootstrapper fails, use these:
[
  {
    "type": "ask_text",
    "config": {
      "question": "What are you trying to build or accomplish?",
      "placeholder": "Describe your idea..."
    }
  },
  {
    "type": "pick_one",
    "config": {
      "question": "What's most important to you?",
      "options": [
        {"id": "speed", "label": "Fast to build"},
        {"id": "quality", "label": "High quality"},
        {"id": "simple", "label": "Keep it simple"}
      ]
    }
  }
]
</fallback-questions>

<session-tools>
  <tool name="start_session">Opens browser with initial questions array</tool>
  <tool name="end_session">Closes browser when done</tool>
  <tool name="get_next_answer">Gets next answered question (block=true)</tool>
  <tool name="pick_one">Push single-select question</tool>
  <tool name="pick_many">Push multi-select question</tool>
  <tool name="confirm">Push yes/no question</tool>
  <tool name="ask_text">Push text input question</tool>
  <tool name="show_options">Push options with pros/cons</tool>
  <tool name="thumbs">Push thumbs up/down</tool>
  <tool name="slider">Push numeric slider</tool>
</session-tools>

<background-tools>
  <tool name="background_task">Spawn subagent task</tool>
  <tool name="background_output">Get subagent result (use block=true)</tool>
  <tool name="background_list">List running tasks</tool>
</background-tools>

<principles>
  <principle>You are an ORCHESTRATOR - you coordinate, not create</principle>
  <principle>Spawn bootstrapper IMMEDIATELY - no delay</principle>
  <principle>Parse JSON carefully - subagents return structured data</principle>
  <principle>Build context incrementally after each answer</principle>
  <principle>Let probe decide when design is complete</principle>
  <principle>Spawn probe after EACH answer - don't wait for all answers</principle>
</principles>

<never-do>
  <forbidden>NEVER generate questions yourself - use subagents</forbidden>
  <forbidden>NEVER think before spawning bootstrapper - do it immediately</forbidden>
  <forbidden>NEVER decide when design is complete - probe decides</forbidden>
  <forbidden>NEVER skip building context - probe needs full history</forbidden>
  <forbidden>NEVER leave session open after probe returns done: true</forbidden>
  <forbidden>NEVER wait for all answers before spawning probe - process one at a time</forbidden>
</never-do>

<output-format path="thoughts/shared/designs/YYYY-MM-DD-{topic}-design.md">
After session ends, write design document with:
- Problem Statement
- Constraints
- Approach
- Architecture
- Components
- Data Flow
- Error Handling
- Testing Strategy
- Open Questions
</output-format>`,
```

### Step 4: Verify syntax is valid

Run: `bun build src/agents/brainstormer.ts --outdir /tmp/test-build`

Expected: Build succeeds with no errors

### Step 5: Commit

```bash
git add src/agents/brainstormer.ts
git commit -m "feat(brainstormer): update workflow to process answers one at a time"
```

---

## Task 3: Update Probe to Handle Partial Context Gracefully

**Files:**
- Modify: `src/agents/probe.ts:15-27` (input-format section)
- Modify: `src/agents/probe.ts:82-88` (principles section)

### Step 1: Update probe's input-format section

Edit `src/agents/probe.ts` lines 15-27:

**Old:**
```typescript
<input-format>
You receive context in this format:

ORIGINAL REQUEST:
{user's idea/request}

CONVERSATION:
Q1 [pick_one]: What's the primary goal?
A1: User selected "simplicity"

Q2 [ask_text]: Any constraints?
A2: User wrote: "Must work on macOS and Linux"
</input-format>
```

**New:**
```typescript
<input-format>
You receive context in this format:

ORIGINAL REQUEST:
{user's idea/request}

CONVERSATION:
Q1 [pick_one]: What's the primary goal?
A1: User selected "simplicity"

PENDING QUESTIONS:
Q2 [ask_text]: Any constraints?
Q3 [pick_many]: Which features are essential?

Note: You may receive partial context (some questions still pending).
This is normal - engage immediately with available information.
Don't wait for all answers - provide value with what you have.
</input-format>
```

### Step 2: Update probe's principles section

Edit `src/agents/probe.ts` lines 82-88:

**Old:**
```typescript
<principles>
  <principle>Each question builds on previous answers - go deeper, not wider</principle>
  <principle>Don't repeat questions already asked</principle>
  <principle>Set done: true after 8-12 questions typically</principle>
  <principle>Use show_options when presenting architectural choices with tradeoffs</principle>
  <principle>Return ONLY valid JSON - no markdown code blocks</principle>
</principles>
```

**New:**
```typescript
<principles>
  <principle>Each question builds on previous answers - go deeper, not wider</principle>
  <principle>Don't repeat questions already asked (check PENDING QUESTIONS too)</principle>
  <principle>Set done: true after 8-12 questions typically</principle>
  <principle>Use show_options when presenting architectural choices with tradeoffs</principle>
  <principle>Return ONLY valid JSON - no markdown code blocks</principle>
  <principle>Engage with partial context - don't say "waiting for more answers"</principle>
  <principle>If pending questions will provide needed info, you can set done: false with no new question</principle>
</principles>
```

### Step 3: Apply the full updated probe.ts

```typescript
// src/agents/probe.ts
import type { AgentConfig } from "@opencode-ai/sdk";

export const probeAgent: AgentConfig = {
  description: "Generates thoughtful follow-up questions based on conversation context",
  mode: "subagent",
  model: "anthropic/claude-opus-4-5",
  temperature: 0.6,
  prompt: `<purpose>
Analyze the conversation so far and decide:
1. Is the design sufficiently explored? (done: true)
2. If not, what's the ONE most important question to ask next?
</purpose>

<input-format>
You receive context in this format:

ORIGINAL REQUEST:
{user's idea/request}

CONVERSATION:
Q1 [pick_one]: What's the primary goal?
A1: User selected "simplicity"

PENDING QUESTIONS:
Q2 [ask_text]: Any constraints?
Q3 [pick_many]: Which features are essential?

Note: You may receive partial context (some questions still pending).
This is normal - engage immediately with available information.
Don't wait for all answers - provide value with what you have.
</input-format>

<output-format>
Return ONLY a JSON object. No markdown, no explanation.

If design is complete:
{
  "done": true,
  "reason": "Brief explanation of why design is complete"
}

If more questions needed:
{
  "done": false,
  "reason": "Brief explanation of what we need to learn",
  "question": {
    "type": "pick_one",
    "config": {
      "question": "...",
      "options": [...]
    }
  }
}
</output-format>

<question-types>
  <type name="pick_one">
    config: { question: string, options: [{id, label, description?}], recommended?: string }
  </type>
  <type name="pick_many">
    config: { question: string, options: [{id, label, description?}], recommended?: string[], min?: number, max?: number }
  </type>
  <type name="confirm">
    config: { question: string, context?: string }
  </type>
  <type name="ask_text">
    config: { question: string, placeholder?: string, multiline?: boolean }
  </type>
  <type name="show_options">
    config: { question: string, options: [{id, label, pros?: string[], cons?: string[]}], recommended?: string, allowFeedback?: boolean }
  </type>
  <type name="thumbs">
    config: { question: string, context?: string }
  </type>
  <type name="slider">
    config: { question: string, min: number, max: number, defaultValue?: number }
  </type>
  <type name="rank">
    config: { question: string, options: [{id, label}] }
  </type>
  <type name="rate">
    config: { question: string, options: [{id, label}], min?: number, max?: number }
  </type>
</question-types>

<principles>
  <principle>Each question builds on previous answers - go deeper, not wider</principle>
  <principle>Don't repeat questions already asked (check PENDING QUESTIONS too)</principle>
  <principle>Set done: true after 8-12 questions typically</principle>
  <principle>Use show_options when presenting architectural choices with tradeoffs</principle>
  <principle>Return ONLY valid JSON - no markdown code blocks</principle>
  <principle>Engage with partial context - don't say "waiting for more answers"</principle>
  <principle>If pending questions will provide needed info, you can set done: false with no new question</principle>
</principles>

<completion-criteria>
Set done: true when:
- Core problem is well understood
- Key constraints are identified
- Main architectural decisions are made
- User has validated the approach
- ~8-12 questions have been asked
</completion-criteria>

<never-do>
  <forbidden>Never return more than 1 question at a time</forbidden>
  <forbidden>Never wrap output in markdown code blocks</forbidden>
  <forbidden>Never include explanatory text outside the JSON</forbidden>
  <forbidden>Never ask the same question twice</forbidden>
  <forbidden>Never continue past 15 questions - set done: true</forbidden>
</never-do>`,
};
```

### Step 4: Verify syntax is valid

Run: `bun build src/agents/probe.ts --outdir /tmp/test-build`

Expected: Build succeeds with no errors

### Step 5: Commit

```bash
git add src/agents/probe.ts
git commit -m "feat(probe): update to handle partial context with pending questions"
```

---

## Task 4: Add Integration Test for Streaming Answer Flow

**Files:**
- Create: `tests/integration/streaming-answers.test.ts`

### Step 1: Write the integration test

Create `tests/integration/streaming-answers.test.ts`:

```typescript
// tests/integration/streaming-answers.test.ts
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { SessionManager } from "../../src/session/manager";
import { buildProbeContext, type QAPair, type PendingQuestion } from "../../src/agents/context";

describe("Streaming Answer Processing", () => {
  let manager: SessionManager;

  beforeEach(() => {
    manager = new SessionManager({ skipBrowser: true });
  });

  afterEach(async () => {
    await manager.cleanup();
  });

  describe("Context building with partial answers", () => {
    it("should build context after first answer with pending questions", () => {
      const originalRequest = "Build a task manager CLI";

      // Simulate: 3 initial questions, user answered Q1 only
      const answeredQAs: QAPair[] = [
        {
          questionNumber: 1,
          questionType: "pick_one",
          questionText: "What's the primary goal?",
          answer: { selected: "simple" },
          config: {
            options: [
              { id: "speed", label: "Fast performance" },
              { id: "simple", label: "Simplicity" },
            ],
          },
        },
      ];

      const pendingQuestions: PendingQuestion[] = [
        { questionNumber: 2, questionType: "ask_text", questionText: "Any constraints?" },
        { questionNumber: 3, questionType: "pick_many", questionText: "Which features?" },
      ];

      const context = buildProbeContext(originalRequest, answeredQAs, pendingQuestions);

      // Verify context structure
      expect(context).toContain("ORIGINAL REQUEST:");
      expect(context).toContain("Build a task manager CLI");
      expect(context).toContain("CONVERSATION:");
      expect(context).toContain("Q1 [pick_one]: What's the primary goal?");
      expect(context).toContain('A1: User selected "Simplicity"');
      expect(context).toContain("PENDING QUESTIONS:");
      expect(context).toContain("Q2 [ask_text]: Any constraints?");
      expect(context).toContain("Q3 [pick_many]: Which features?");
    });

    it("should update context as more answers come in", () => {
      const originalRequest = "Build a task manager CLI";

      // Round 1: Q1 answered, Q2 and Q3 pending
      let answeredQAs: QAPair[] = [
        {
          questionNumber: 1,
          questionType: "pick_one",
          questionText: "What's the primary goal?",
          answer: { selected: "simple" },
          config: { options: [{ id: "simple", label: "Simplicity" }] },
        },
      ];
      let pendingQuestions: PendingQuestion[] = [
        { questionNumber: 2, questionType: "ask_text", questionText: "Any constraints?" },
        { questionNumber: 3, questionType: "pick_many", questionText: "Which features?" },
      ];

      let context = buildProbeContext(originalRequest, answeredQAs, pendingQuestions);
      expect(context).toContain("Q1 [pick_one]");
      expect(context).toContain("PENDING QUESTIONS:");
      expect(context).toContain("Q2 [ask_text]");

      // Round 2: Q1 and Q2 answered, Q3 pending
      answeredQAs = [
        ...answeredQAs,
        {
          questionNumber: 2,
          questionType: "ask_text",
          questionText: "Any constraints?",
          answer: { text: "Must work offline" },
          config: {},
        },
      ];
      pendingQuestions = [{ questionNumber: 3, questionType: "pick_many", questionText: "Which features?" }];

      context = buildProbeContext(originalRequest, answeredQAs, pendingQuestions);
      expect(context).toContain("Q1 [pick_one]");
      expect(context).toContain("Q2 [ask_text]");
      expect(context).toContain('A2: User wrote: "Must work offline"');
      expect(context).toContain("PENDING QUESTIONS:");
      expect(context).toContain("Q3 [pick_many]");
      expect(context).not.toContain("Q2 [ask_text]: Any constraints?\n\nPENDING"); // Q2 should be in answered, not pending

      // Round 3: All answered, no pending
      answeredQAs = [
        ...answeredQAs,
        {
          questionNumber: 3,
          questionType: "pick_many",
          questionText: "Which features?",
          answer: { selected: ["tags", "due"] },
          config: {
            options: [
              { id: "tags", label: "Tags" },
              { id: "due", label: "Due dates" },
            ],
          },
        },
      ];
      pendingQuestions = [];

      context = buildProbeContext(originalRequest, answeredQAs, pendingQuestions);
      expect(context).toContain("Q3 [pick_many]");
      expect(context).toContain('A3: User selected: "Tags", "Due dates"');
      expect(context).not.toContain("PENDING QUESTIONS:");
    });
  });

  describe("Session flow with streaming answers", () => {
    it("should allow probe to be spawned after each answer", async () => {
      const { session_id } = await manager.startSession({ title: "Streaming Test" });

      // Push 3 initial questions (simulating bootstrapper output)
      const q1 = manager.pushQuestion(session_id, "pick_one", {
        question: "What's the primary goal?",
        options: [
          { id: "speed", label: "Fast" },
          { id: "simple", label: "Simple" },
        ],
      });
      const q2 = manager.pushQuestion(session_id, "ask_text", {
        question: "Any constraints?",
      });
      const q3 = manager.pushQuestion(session_id, "pick_many", {
        question: "Which features?",
        options: [
          { id: "tags", label: "Tags" },
          { id: "due", label: "Due dates" },
        ],
      });

      // User answers Q1 first
      manager.handleWsMessage(session_id, {
        type: "response",
        id: q1.question_id,
        answer: { selected: "simple" },
      });

      // get_next_answer should return Q1 immediately
      const r1 = await manager.getNextAnswer({ session_id, block: false });
      expect(r1.completed).toBe(true);
      expect(r1.question_id).toBe(q1.question_id);
      expect(r1.response).toEqual({ selected: "simple" });

      // At this point, brainstormer would spawn probe with partial context
      // Q2 and Q3 are still pending

      // User answers Q3 (out of order)
      manager.handleWsMessage(session_id, {
        type: "response",
        id: q3.question_id,
        answer: { selected: ["tags"] },
      });

      // get_next_answer should return Q3
      const r3 = await manager.getNextAnswer({ session_id, block: false });
      expect(r3.completed).toBe(true);
      expect(r3.question_id).toBe(q3.question_id);

      // Q2 still pending
      const r2check = await manager.getNextAnswer({ session_id, block: false });
      expect(r2check.completed).toBe(false);
      expect(r2check.status).toBe("pending");
    });

    it("should handle probe adding new question while others pending", async () => {
      const { session_id } = await manager.startSession({ title: "Dynamic Questions" });

      // Initial questions
      const q1 = manager.pushQuestion(session_id, "confirm", { question: "Ready?" });
      const q2 = manager.pushQuestion(session_id, "ask_text", { question: "Details?" });

      // Answer Q1
      manager.handleWsMessage(session_id, {
        type: "response",
        id: q1.question_id,
        answer: { choice: "yes" },
      });

      await manager.getNextAnswer({ session_id, block: false });

      // Probe adds a new question (Q3) while Q2 still pending
      const q3 = manager.pushQuestion(session_id, "pick_one", {
        question: "Follow-up from probe?",
        options: [{ id: "a", label: "Option A" }],
      });

      // List should show Q2 (pending) and Q3 (pending)
      const list = manager.listQuestions(session_id);
      const pendingQuestions = list.questions.filter((q) => q.status === "pending");
      expect(pendingQuestions.length).toBe(2);

      // User can answer either Q2 or Q3 next
      manager.handleWsMessage(session_id, {
        type: "response",
        id: q3.question_id,
        answer: { selected: "a" },
      });

      const r3 = await manager.getNextAnswer({ session_id, block: false });
      expect(r3.completed).toBe(true);
      expect(r3.question_id).toBe(q3.question_id);
    });
  });
});
```

### Step 2: Run test to verify it passes

Run: `bun test tests/integration/streaming-answers.test.ts`

Expected: PASS - all streaming answer tests pass

### Step 3: Commit

```bash
git add tests/integration/streaming-answers.test.ts
git commit -m "test(integration): add streaming answer processing tests"
```

---

## Task 5: Update Existing Tests for New Context Signature

**Files:**
- Modify: `tests/integration/multi-agent.test.ts`

### Step 1: Check if existing tests need updates

The existing `buildProbeContext` calls in `tests/integration/multi-agent.test.ts` use the old 2-argument signature. Since we made the third argument optional with a default of `[]`, these tests should still pass.

Run: `bun test tests/integration/multi-agent.test.ts`

Expected: PASS - existing tests should work with optional third argument

### Step 2: Verify all tests pass

Run: `bun test`

Expected: All tests pass

### Step 3: Commit (if any changes needed)

```bash
git add -A
git commit -m "test: ensure all tests pass with updated context signature"
```

---

## Task 6: Run Full Test Suite and Verify

**Files:**
- None (verification only)

### Step 1: Run all tests

Run: `bun test`

Expected: All tests pass

### Step 2: Run type check

Run: `bun run typecheck` (or `tsc --noEmit`)

Expected: No type errors

### Step 3: Final commit if needed

```bash
git status
# If any uncommitted changes:
git add -A
git commit -m "chore: final cleanup for streaming answer processing"
```

---

## Summary of Changes

| File | Change |
|------|--------|
| `src/agents/context.ts` | Added `PendingQuestion` interface, updated `buildProbeContext` to accept optional pending questions |
| `src/agents/brainstormer.ts` | Updated workflow to process answers one at a time, updated context-format to show pending questions |
| `src/agents/probe.ts` | Updated input-format and principles to handle partial context gracefully |
| `tests/agents/context.test.ts` | Added tests for pending question indicator |
| `tests/integration/streaming-answers.test.ts` | New integration tests for streaming answer flow |

## Verification Checklist

- [ ] Probe is spawned after first answer (not waiting for all)
- [ ] Context includes pending question indicators
- [ ] Probe handles partial context without "waiting for more" responses
- [ ] Full flow still works end-to-end
- [ ] All existing tests pass
- [ ] New tests cover streaming behavior
