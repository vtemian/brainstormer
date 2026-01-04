# Brainstorm Tool Refactor Implementation Plan

**Goal:** Replace multi-agent orchestration with a single blocking `brainstorm` tool that handles the entire brainstorming flow internally.

**Architecture:** The new `brainstorm` tool receives initial questions from the calling agent, opens a browser session, loops through answers while making internal LLM calls to generate follow-up questions, and returns both raw answers and a synthesized summary.

**Design:** [thoughts/shared/designs/2025-01-04-brainstorm-tool-refactor.md](../designs/2025-01-04-brainstorm-tool-refactor.md)

---

## Task 1: Create Types for Brainstorm Tool

**Files:**
- Create: `src/tools/brainstorm/types.ts`

**Step 1: Write the types file**

```typescript
// src/tools/brainstorm/types.ts
import type { QuestionType, QuestionConfig } from "../../session/types";

/**
 * Input to the brainstorm tool
 */
export interface BrainstormInput {
  /** Background context the calling agent gathered */
  context: string;
  /** User's original request */
  request: string;
  /** Initial questions to display when browser opens */
  initial_questions: Array<{
    type: QuestionType;
    config: QuestionConfig;
  }>;
  /** Optional: Maximum number of follow-up questions (default: 15) */
  max_questions?: number;
  /** Optional: Model to use for internal LLM calls (default: anthropic/claude-sonnet-4) */
  model?: string;
}

/**
 * A single Q&A pair from the brainstorming session
 */
export interface BrainstormAnswer {
  /** The question text */
  question: string;
  /** Question type (pick_one, ask_text, etc.) */
  type: QuestionType;
  /** User's response (varies by type) */
  answer: unknown;
}

/**
 * Output from the brainstorm tool
 */
export interface BrainstormOutput {
  /** All Q&A pairs from the session */
  answers: BrainstormAnswer[];
  /** LLM-synthesized design document */
  summary: string;
}

/**
 * Probe LLM response when more questions needed
 */
export interface ProbeResponseContinue {
  done: false;
  reason: string;
  question: {
    type: QuestionType;
    config: QuestionConfig;
  };
}

/**
 * Probe LLM response when design is complete
 */
export interface ProbeResponseDone {
  done: true;
  reason: string;
}

export type ProbeResponse = ProbeResponseContinue | ProbeResponseDone;

/**
 * Error types for brainstorm tool
 */
export type BrainstormErrorType =
  | "session_closed"
  | "llm_error"
  | "timeout"
  | "invalid_response"
  | "max_questions_reached";

export class BrainstormError extends Error {
  constructor(
    public readonly type: BrainstormErrorType,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "BrainstormError";
  }
}
```

**Step 2: Verify types compile**

Run: `bun run typecheck`
Expected: No errors related to `src/tools/brainstorm/types.ts`

**Step 3: Commit**

```bash
git add src/tools/brainstorm/types.ts
git commit -m "feat(brainstorm): add types for new brainstorm tool"
```

---

## Task 2: Create Probe LLM Helper

**Files:**
- Create: `src/tools/brainstorm/probe.ts`
- Create: `tests/tools/brainstorm/probe.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/tools/brainstorm/probe.test.ts
import { describe, it, expect, mock, beforeEach } from "bun:test";
import { callProbe, buildProbeContext, parseProbeResponse } from "../../../src/tools/brainstorm/probe";
import type { BrainstormAnswer, ProbeResponse } from "../../../src/tools/brainstorm/types";

describe("Probe LLM Helper", () => {
  describe("buildProbeContext", () => {
    it("should format context with request and answers", () => {
      const request = "Add caching to my API";
      const answers: BrainstormAnswer[] = [
        { question: "What's the primary goal?", type: "pick_one", answer: { selected: "speed" } },
        { question: "Any constraints?", type: "ask_text", answer: { text: "Must use Redis" } },
      ];

      const context = buildProbeContext(request, answers);

      expect(context).toContain("ORIGINAL REQUEST:");
      expect(context).toContain("Add caching to my API");
      expect(context).toContain("CONVERSATION:");
      expect(context).toContain("Q1 [pick_one]: What's the primary goal?");
      expect(context).toContain("A1: User selected \"speed\"");
      expect(context).toContain("Q2 [ask_text]: Any constraints?");
      expect(context).toContain("A2: User wrote: \"Must use Redis\"");
    });

    it("should handle empty answers", () => {
      const context = buildProbeContext("Build a feature", []);

      expect(context).toContain("ORIGINAL REQUEST:");
      expect(context).toContain("Build a feature");
      expect(context).toContain("CONVERSATION:");
      expect(context).toContain("(No answers yet)");
    });
  });

  describe("parseProbeResponse", () => {
    it("should parse valid done response", () => {
      const json = '{"done": true, "reason": "Design is complete"}';

      const result = parseProbeResponse(json);

      expect(result.done).toBe(true);
      expect((result as { done: true; reason: string }).reason).toBe("Design is complete");
    });

    it("should parse valid continue response", () => {
      const json = JSON.stringify({
        done: false,
        reason: "Need to understand scale",
        question: {
          type: "pick_one",
          config: {
            question: "Expected traffic?",
            options: [{ id: "low", label: "Low" }, { id: "high", label: "High" }],
          },
        },
      });

      const result = parseProbeResponse(json);

      expect(result.done).toBe(false);
      expect((result as { done: false; question: { type: string } }).question.type).toBe("pick_one");
    });

    it("should throw on invalid JSON", () => {
      expect(() => parseProbeResponse("not json")).toThrow("invalid_response");
    });

    it("should throw on missing done field", () => {
      expect(() => parseProbeResponse('{"reason": "test"}')).toThrow("invalid_response");
    });

    it("should throw on missing question when done is false", () => {
      expect(() => parseProbeResponse('{"done": false, "reason": "test"}')).toThrow("invalid_response");
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/tools/brainstorm/probe.test.ts`
Expected: FAIL with "Cannot find module" or similar

**Step 3: Write the probe helper implementation**

```typescript
// src/tools/brainstorm/probe.ts
import type { BrainstormAnswer, ProbeResponse } from "./types";
import { BrainstormError } from "./types";

/**
 * System prompt for the probe LLM
 */
export const PROBE_SYSTEM_PROMPT = `<purpose>
Analyze the conversation so far and decide:
1. Is the design sufficiently explored? (done: true)
2. If not, what's the ONE most important question to ask next?
</purpose>

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
</question-types>

<principles>
  <principle>Each question builds on previous answers - go deeper, not wider</principle>
  <principle>Don't repeat questions already asked</principle>
  <principle>Set done: true after 8-12 questions typically</principle>
  <principle>Use show_options when presenting architectural choices with tradeoffs</principle>
  <principle>Return ONLY valid JSON - no markdown code blocks</principle>
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
</never-do>`;

/**
 * Format an answer for display in the probe context
 */
function formatAnswer(answer: BrainstormAnswer): string {
  const { type, answer: response } = answer;

  if (response === null || response === undefined) {
    return "No response";
  }

  switch (type) {
    case "pick_one": {
      const r = response as { selected?: string; other?: string };
      if (r.other) return `User selected "other": "${r.other}"`;
      return `User selected "${r.selected}"`;
    }
    case "pick_many": {
      const r = response as { selected?: string[]; other?: string[] };
      const selections = r.selected?.join('", "') || "";
      const others = r.other?.length ? ` (other: "${r.other.join('", "')}")` : "";
      return `User selected: "${selections}"${others}`;
    }
    case "confirm": {
      const r = response as { choice?: "yes" | "no" | "cancel" };
      return `User said ${r.choice}`;
    }
    case "ask_text": {
      const r = response as { text?: string };
      return `User wrote: "${r.text}"`;
    }
    case "show_options": {
      const r = response as { selected?: string; feedback?: string };
      const feedback = r.feedback ? ` (feedback: "${r.feedback}")` : "";
      return `User chose "${r.selected}"${feedback}`;
    }
    case "thumbs": {
      const r = response as { choice?: "up" | "down" };
      return `User gave thumbs ${r.choice}`;
    }
    case "slider": {
      const r = response as { value?: number };
      return `User set value to ${r.value}`;
    }
    case "rank": {
      const r = response as { ranking?: string[] };
      return `User ranked: ${r.ranking?.join(" > ")}`;
    }
    case "rate": {
      const r = response as { ratings?: Record<string, number> };
      const ratings = Object.entries(r.ratings || {})
        .map(([k, v]) => `${k}: ${v}`)
        .join(", ");
      return `User rated: ${ratings}`;
    }
    default:
      return `Response: ${JSON.stringify(response)}`;
  }
}

/**
 * Build the context string for the probe LLM
 */
export function buildProbeContext(request: string, answers: BrainstormAnswer[]): string {
  let context = `ORIGINAL REQUEST:\n${request}\n\nCONVERSATION:\n`;

  if (answers.length === 0) {
    context += "(No answers yet)\n";
  } else {
    for (let i = 0; i < answers.length; i++) {
      const a = answers[i];
      context += `Q${i + 1} [${a.type}]: ${a.question}\n`;
      context += `A${i + 1}: ${formatAnswer(a)}\n\n`;
    }
  }

  return context;
}

/**
 * Parse and validate the probe LLM response
 */
export function parseProbeResponse(text: string): ProbeResponse {
  // Strip markdown code blocks if present
  let cleaned = text.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }
  cleaned = cleaned.trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    throw new BrainstormError("invalid_response", `Failed to parse probe response as JSON: ${text}`, e);
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new BrainstormError("invalid_response", "Probe response is not an object");
  }

  const obj = parsed as Record<string, unknown>;

  if (typeof obj.done !== "boolean") {
    throw new BrainstormError("invalid_response", "Probe response missing 'done' boolean field");
  }

  if (obj.done === true) {
    return {
      done: true,
      reason: typeof obj.reason === "string" ? obj.reason : "Design complete",
    };
  }

  // done === false, need question
  if (!obj.question || typeof obj.question !== "object") {
    throw new BrainstormError("invalid_response", "Probe response with done=false must include 'question' object");
  }

  const question = obj.question as Record<string, unknown>;
  if (typeof question.type !== "string" || typeof question.config !== "object") {
    throw new BrainstormError("invalid_response", "Probe question must have 'type' string and 'config' object");
  }

  return {
    done: false,
    reason: typeof obj.reason === "string" ? obj.reason : "",
    question: {
      type: question.type as import("../../session/types").QuestionType,
      config: question.config as import("../../session/types").QuestionConfig,
    },
  };
}

/**
 * Call the probe LLM to decide next action
 *
 * @param client - OpenCode SDK client
 * @param sessionId - OpenCode session ID for the LLM call
 * @param request - Original user request
 * @param answers - Answers collected so far
 * @param model - Model to use (default: anthropic/claude-sonnet-4)
 */
export async function callProbe(
  client: import("@opencode-ai/sdk").OpencodeClient,
  sessionId: string,
  request: string,
  answers: BrainstormAnswer[],
  model?: string,
): Promise<ProbeResponse> {
  const context = buildProbeContext(request, answers);

  // Parse model string into provider/model
  const modelParts = (model || "anthropic/claude-sonnet-4").split("/");
  const providerID = modelParts[0];
  const modelID = modelParts.slice(1).join("/");

  try {
    const response = await client.session.prompt({
      path: { id: sessionId },
      body: {
        model: { providerID, modelID },
        system: PROBE_SYSTEM_PROMPT,
        tools: {}, // No tools for probe
        parts: [{ type: "text", text: context }],
      },
    });

    if (!response.data) {
      throw new BrainstormError("llm_error", "No response from probe LLM");
    }

    // Extract text from response parts
    const textParts = response.data.parts.filter((p): p is import("@opencode-ai/sdk").TextPart => p.type === "text");
    const text = textParts.map((p) => p.text).join("");

    if (!text) {
      throw new BrainstormError("llm_error", "Empty response from probe LLM");
    }

    return parseProbeResponse(text);
  } catch (e) {
    if (e instanceof BrainstormError) throw e;
    throw new BrainstormError("llm_error", `Probe LLM call failed: ${e}`, e);
  }
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/tools/brainstorm/probe.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/tools/brainstorm/probe.ts tests/tools/brainstorm/probe.test.ts
git commit -m "feat(brainstorm): add probe LLM helper with context building and response parsing"
```

---

## Task 3: Create Summary LLM Helper

**Files:**
- Create: `src/tools/brainstorm/summarize.ts`
- Create: `tests/tools/brainstorm/summarize.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/tools/brainstorm/summarize.test.ts
import { describe, it, expect } from "bun:test";
import { buildSummaryContext, SUMMARY_SYSTEM_PROMPT } from "../../../src/tools/brainstorm/summarize";
import type { BrainstormAnswer } from "../../../src/tools/brainstorm/types";

describe("Summary LLM Helper", () => {
  describe("buildSummaryContext", () => {
    it("should format context with all information", () => {
      const request = "Add caching to my API";
      const context = "The API is built with Express and handles 1000 req/s";
      const answers: BrainstormAnswer[] = [
        { question: "What's the primary goal?", type: "pick_one", answer: { selected: "speed" } },
        { question: "Any constraints?", type: "ask_text", answer: { text: "Must use Redis" } },
      ];

      const result = buildSummaryContext(request, context, answers);

      expect(result).toContain("USER REQUEST:");
      expect(result).toContain("Add caching to my API");
      expect(result).toContain("CONTEXT:");
      expect(result).toContain("Express");
      expect(result).toContain("BRAINSTORMING SESSION:");
      expect(result).toContain("What's the primary goal?");
      expect(result).toContain("speed");
    });
  });

  describe("SUMMARY_SYSTEM_PROMPT", () => {
    it("should include design document structure", () => {
      expect(SUMMARY_SYSTEM_PROMPT).toContain("Problem Statement");
      expect(SUMMARY_SYSTEM_PROMPT).toContain("Requirements");
      expect(SUMMARY_SYSTEM_PROMPT).toContain("Architecture");
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/tools/brainstorm/summarize.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Write the summarize helper implementation**

```typescript
// src/tools/brainstorm/summarize.ts
import type { BrainstormAnswer } from "./types";
import { BrainstormError } from "./types";

/**
 * System prompt for the summary LLM
 */
export const SUMMARY_SYSTEM_PROMPT = `<purpose>
Synthesize the brainstorming session into a structured design document.
Extract key decisions, requirements, and constraints from the Q&A.
</purpose>

<output-format>
Generate a markdown design document with these sections:

## Problem Statement
What problem are we solving? What's the user's goal?

## Requirements
- Functional requirements (what it must do)
- Non-functional requirements (performance, scale, etc.)

## Constraints
- Technical constraints
- Business constraints
- Timeline constraints

## Proposed Approach
High-level solution approach based on user's choices.

## Architecture Overview
Key components and how they interact.

## Key Decisions
Decisions made during brainstorming with rationale.

## Open Questions
Any remaining uncertainties or areas needing more exploration.
</output-format>

<principles>
- Be concise but comprehensive
- Focus on decisions made, not questions asked
- Include rationale from user's answers
- Highlight tradeoffs that were discussed
- Flag any inconsistencies or gaps
</principles>`;

/**
 * Format an answer for the summary context
 */
function formatAnswerForSummary(answer: BrainstormAnswer): string {
  const { type, answer: response } = answer;

  if (response === null || response === undefined) {
    return "No response";
  }

  switch (type) {
    case "pick_one": {
      const r = response as { selected?: string; other?: string };
      return r.other ? `"${r.other}" (custom)` : `"${r.selected}"`;
    }
    case "pick_many": {
      const r = response as { selected?: string[]; other?: string[] };
      const items = [...(r.selected || []), ...(r.other || [])];
      return items.map((s) => `"${s}"`).join(", ");
    }
    case "confirm": {
      const r = response as { choice?: "yes" | "no" | "cancel" };
      return r.choice === "yes" ? "Yes" : r.choice === "no" ? "No" : "Cancelled";
    }
    case "ask_text": {
      const r = response as { text?: string };
      return `"${r.text}"`;
    }
    case "show_options": {
      const r = response as { selected?: string; feedback?: string };
      return r.feedback ? `"${r.selected}" - ${r.feedback}` : `"${r.selected}"`;
    }
    case "thumbs": {
      const r = response as { choice?: "up" | "down" };
      return r.choice === "up" ? "Positive" : "Negative";
    }
    case "slider": {
      const r = response as { value?: number };
      return String(r.value);
    }
    default:
      return JSON.stringify(response);
  }
}

/**
 * Build the context string for the summary LLM
 */
export function buildSummaryContext(request: string, context: string, answers: BrainstormAnswer[]): string {
  let result = `USER REQUEST:\n${request}\n\n`;

  if (context) {
    result += `CONTEXT:\n${context}\n\n`;
  }

  result += "BRAINSTORMING SESSION:\n";
  for (const a of answers) {
    result += `Q: ${a.question}\n`;
    result += `A: ${formatAnswerForSummary(a)}\n\n`;
  }

  return result;
}

/**
 * Call the summary LLM to generate a design document
 *
 * @param client - OpenCode SDK client
 * @param sessionId - OpenCode session ID for the LLM call
 * @param request - Original user request
 * @param context - Background context
 * @param answers - All answers from the session
 * @param model - Model to use (default: anthropic/claude-sonnet-4)
 */
export async function callSummarize(
  client: import("@opencode-ai/sdk").OpencodeClient,
  sessionId: string,
  request: string,
  context: string,
  answers: BrainstormAnswer[],
  model?: string,
): Promise<string> {
  const summaryContext = buildSummaryContext(request, context, answers);

  // Parse model string into provider/model
  const modelParts = (model || "anthropic/claude-sonnet-4").split("/");
  const providerID = modelParts[0];
  const modelID = modelParts.slice(1).join("/");

  try {
    const response = await client.session.prompt({
      path: { id: sessionId },
      body: {
        model: { providerID, modelID },
        system: SUMMARY_SYSTEM_PROMPT,
        tools: {}, // No tools for summary
        parts: [{ type: "text", text: summaryContext }],
      },
    });

    if (!response.data) {
      throw new BrainstormError("llm_error", "No response from summary LLM");
    }

    // Extract text from response parts
    const textParts = response.data.parts.filter((p): p is import("@opencode-ai/sdk").TextPart => p.type === "text");
    const text = textParts.map((p) => p.text).join("");

    if (!text) {
      throw new BrainstormError("llm_error", "Empty response from summary LLM");
    }

    return text;
  } catch (e) {
    if (e instanceof BrainstormError) throw e;
    throw new BrainstormError("llm_error", `Summary LLM call failed: ${e}`, e);
  }
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/tools/brainstorm/summarize.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/tools/brainstorm/summarize.ts tests/tools/brainstorm/summarize.test.ts
git commit -m "feat(brainstorm): add summary LLM helper for design document generation"
```

---

## Task 4: Create Brainstorm Orchestrator

**Files:**
- Create: `src/tools/brainstorm/orchestrator.ts`
- Create: `tests/tools/brainstorm/orchestrator.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/tools/brainstorm/orchestrator.test.ts
import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import { BrainstormOrchestrator } from "../../../src/tools/brainstorm/orchestrator";
import { SessionManager } from "../../../src/session/manager";
import type { BrainstormInput } from "../../../src/tools/brainstorm/types";

describe("BrainstormOrchestrator", () => {
  let sessionManager: SessionManager;

  beforeEach(() => {
    sessionManager = new SessionManager({ skipBrowser: true });
  });

  afterEach(async () => {
    await sessionManager.cleanup();
  });

  describe("constructor", () => {
    it("should create orchestrator with required dependencies", () => {
      const mockClient = {} as any;
      const orchestrator = new BrainstormOrchestrator(sessionManager, mockClient, "test-session");

      expect(orchestrator).toBeDefined();
    });
  });

  describe("extractQuestionText", () => {
    it("should extract question text from config", () => {
      const orchestrator = new BrainstormOrchestrator(
        sessionManager,
        {} as any,
        "test-session",
      );

      const config = { question: "What is your goal?" };
      expect(orchestrator.extractQuestionText(config)).toBe("What is your goal?");
    });

    it("should return empty string for missing question", () => {
      const orchestrator = new BrainstormOrchestrator(
        sessionManager,
        {} as any,
        "test-session",
      );

      expect(orchestrator.extractQuestionText({})).toBe("");
    });
  });

  describe("run", () => {
    it("should fail with empty initial questions", async () => {
      const mockClient = {} as any;
      const orchestrator = new BrainstormOrchestrator(sessionManager, mockClient, "test-session");

      const input: BrainstormInput = {
        context: "Test context",
        request: "Test request",
        initial_questions: [],
      };

      await expect(orchestrator.run(input)).rejects.toThrow("At least one initial question is required");
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/tools/brainstorm/orchestrator.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Write the orchestrator implementation**

```typescript
// src/tools/brainstorm/orchestrator.ts
import type { OpencodeClient } from "@opencode-ai/sdk";
import type { SessionManager } from "../../session/manager";
import type { QuestionConfig } from "../../session/types";
import type { BrainstormInput, BrainstormOutput, BrainstormAnswer } from "./types";
import { BrainstormError } from "./types";
import { callProbe } from "./probe";
import { callSummarize } from "./summarize";

const DEFAULT_MAX_QUESTIONS = 15;
const DEFAULT_MODEL = "anthropic/claude-sonnet-4";

export class BrainstormOrchestrator {
  private sessionManager: SessionManager;
  private client: OpencodeClient;
  private opencodeSessionId: string;

  constructor(sessionManager: SessionManager, client: OpencodeClient, opencodeSessionId: string) {
    this.sessionManager = sessionManager;
    this.client = client;
    this.opencodeSessionId = opencodeSessionId;
  }

  /**
   * Extract question text from a question config
   */
  extractQuestionText(config: QuestionConfig | Record<string, unknown>): string {
    if (typeof config === "object" && config !== null && "question" in config) {
      return String((config as { question: unknown }).question);
    }
    return "";
  }

  /**
   * Run the complete brainstorming flow
   */
  async run(input: BrainstormInput): Promise<BrainstormOutput> {
    const { context, request, initial_questions, max_questions, model } = input;
    const maxQ = max_questions ?? DEFAULT_MAX_QUESTIONS;
    const llmModel = model ?? DEFAULT_MODEL;

    // Validate input
    if (!initial_questions || initial_questions.length === 0) {
      throw new BrainstormError("invalid_response", "At least one initial question is required");
    }

    // Start browser session with initial questions
    const sessionResult = await this.sessionManager.startSession({
      title: "Brainstorming Session",
      questions: initial_questions,
    });

    const brainstormSessionId = sessionResult.session_id;
    const answers: BrainstormAnswer[] = [];

    // Track question texts for answer collection
    const questionTexts = new Map<string, { text: string; type: string }>();
    for (let i = 0; i < initial_questions.length; i++) {
      const qId = sessionResult.question_ids?.[i];
      if (qId) {
        questionTexts.set(qId, {
          text: this.extractQuestionText(initial_questions[i].config),
          type: initial_questions[i].type,
        });
      }
    }

    try {
      // Main answer loop
      let questionCount = initial_questions.length;
      let done = false;

      while (!done && questionCount <= maxQ) {
        // Wait for next answer
        const answerResult = await this.sessionManager.getNextAnswer({
          session_id: brainstormSessionId,
          block: true,
          timeout: 300000, // 5 minutes
        });

        // Handle timeout or no pending questions
        if (!answerResult.completed) {
          if (answerResult.status === "timeout") {
            throw new BrainstormError("timeout", "Timed out waiting for user response");
          }
          if (answerResult.status === "none_pending") {
            // All questions answered, check if we should continue
            break;
          }
          continue;
        }

        // Record the answer
        const qInfo = questionTexts.get(answerResult.question_id!);
        if (qInfo) {
          answers.push({
            question: qInfo.text,
            type: answerResult.question_type as import("../../session/types").QuestionType,
            answer: answerResult.response,
          });
        }

        // Check if we've hit max questions
        if (questionCount >= maxQ) {
          done = true;
          break;
        }

        // Call probe to decide next action
        const probeResult = await callProbe(
          this.client,
          this.opencodeSessionId,
          request,
          answers,
          llmModel,
        );

        if (probeResult.done) {
          done = true;
        } else {
          // Push the new question
          const pushResult = this.sessionManager.pushQuestion(
            brainstormSessionId,
            probeResult.question.type,
            probeResult.question.config,
          );

          questionTexts.set(pushResult.question_id, {
            text: this.extractQuestionText(probeResult.question.config),
            type: probeResult.question.type,
          });

          questionCount++;
        }
      }

      // End the browser session
      await this.sessionManager.endSession(brainstormSessionId);

      // Generate summary
      const summary = await callSummarize(
        this.client,
        this.opencodeSessionId,
        request,
        context,
        answers,
        llmModel,
      );

      return { answers, summary };
    } catch (e) {
      // Clean up session on error
      await this.sessionManager.endSession(brainstormSessionId).catch(() => {});

      if (e instanceof BrainstormError) throw e;
      throw new BrainstormError("llm_error", `Brainstorming failed: ${e}`, e);
    }
  }
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/tools/brainstorm/orchestrator.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/tools/brainstorm/orchestrator.ts tests/tools/brainstorm/orchestrator.test.ts
git commit -m "feat(brainstorm): add orchestrator for managing brainstorming flow"
```

---

## Task 5: Create the Brainstorm Tool

**Files:**
- Create: `src/tools/brainstorm/index.ts`
- Create: `tests/tools/brainstorm/tool.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/tools/brainstorm/tool.test.ts
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { SessionManager } from "../../../src/session/manager";
import { createBrainstormTool } from "../../../src/tools/brainstorm";

describe("Brainstorm Tool", () => {
  let sessionManager: SessionManager;

  beforeEach(() => {
    sessionManager = new SessionManager({ skipBrowser: true });
  });

  afterEach(async () => {
    await sessionManager.cleanup();
  });

  describe("createBrainstormTool", () => {
    it("should create a tool with correct description", () => {
      const mockClient = {} as any;
      const tool = createBrainstormTool(sessionManager, mockClient);

      expect(tool.description).toContain("brainstorming session");
    });

    it("should have required args", () => {
      const mockClient = {} as any;
      const tool = createBrainstormTool(sessionManager, mockClient);

      expect(tool.args).toHaveProperty("context");
      expect(tool.args).toHaveProperty("request");
      expect(tool.args).toHaveProperty("initial_questions");
    });
  });

  describe("execute", () => {
    it("should fail without initial questions", async () => {
      const mockClient = {} as any;
      const tool = createBrainstormTool(sessionManager, mockClient);

      const result = await tool.execute(
        {
          context: "Test",
          request: "Test",
          initial_questions: [],
        },
        { sessionID: "test", messageID: "test", agent: "test", abort: new AbortController().signal },
      );

      expect(result).toContain("ERROR");
      expect(result).toContain("At least one initial question");
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/tools/brainstorm/tool.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Write the brainstorm tool implementation**

```typescript
// src/tools/brainstorm/index.ts
import { tool } from "@opencode-ai/plugin/tool";
import type { OpencodeClient } from "@opencode-ai/sdk";
import type { SessionManager } from "../../session/manager";
import { BrainstormOrchestrator } from "./orchestrator";
import { BrainstormError } from "./types";

export { BrainstormOrchestrator } from "./orchestrator";
export * from "./types";
export * from "./probe";
export * from "./summarize";

export function createBrainstormTool(sessionManager: SessionManager, client: OpencodeClient) {
  return tool({
    description: `Run an interactive brainstorming session with the user.

Opens a browser window with questions, collects answers, generates follow-up questions
using an internal LLM, and returns a synthesized design document.

This is a BLOCKING tool - it runs until the brainstorming session is complete.

The calling agent should:
1. Gather context about the user's request
2. Generate 2-3 initial questions
3. Call this tool with context, request, and initial questions
4. Receive back all answers and a design summary`,
    args: {
      context: tool.schema.string().describe("Background context gathered by the calling agent"),
      request: tool.schema.string().describe("User's original request"),
      initial_questions: tool.schema
        .array(
          tool.schema.object({
            type: tool.schema
              .enum([
                "pick_one",
                "pick_many",
                "confirm",
                "ask_text",
                "show_options",
                "thumbs",
                "slider",
                "rank",
                "rate",
              ])
              .describe("Question type"),
            config: tool.schema.object({}).passthrough().describe("Question config (varies by type)"),
          }),
        )
        .describe("Initial questions to display (2-3 recommended)"),
      max_questions: tool.schema
        .number()
        .optional()
        .describe("Maximum total questions including follow-ups (default: 15)"),
      model: tool.schema
        .string()
        .optional()
        .describe("Model for internal LLM calls (default: anthropic/claude-sonnet-4)"),
    },
    execute: async (args, ctx) => {
      // Validate initial questions
      if (!args.initial_questions || args.initial_questions.length === 0) {
        return `## ERROR: initial_questions is required

The brainstorm tool needs at least one initial question to start the session.

Example:
\`\`\`
brainstorm(
  context="User wants to add caching to their Express API",
  request="Add caching to my API",
  initial_questions=[
    {type: "pick_one", config: {question: "What's the primary goal?", options: [{id: "speed", label: "Speed"}, {id: "cost", label: "Cost reduction"}]}},
    {type: "ask_text", config: {question: "Any constraints?", placeholder: "e.g., must use Redis..."}}
  ]
)
\`\`\``;
      }

      try {
        const orchestrator = new BrainstormOrchestrator(sessionManager, client, ctx.sessionID);

        const result = await orchestrator.run({
          context: args.context,
          request: args.request,
          initial_questions: args.initial_questions.map((q) => ({
            type: q.type as import("../../session/types").QuestionType,
            config: q.config as import("../../session/types").QuestionConfig,
          })),
          max_questions: args.max_questions,
          model: args.model,
        });

        // Format output
        let output = `## Brainstorming Complete

### Answers Collected (${result.answers.length})

`;

        for (let i = 0; i < result.answers.length; i++) {
          const a = result.answers[i];
          output += `**Q${i + 1}** [${a.type}]: ${a.question}\n`;
          output += `**A${i + 1}**: \`\`\`json\n${JSON.stringify(a.answer, null, 2)}\n\`\`\`\n\n`;
        }

        output += `---

### Design Summary

${result.summary}`;

        return output;
      } catch (e) {
        if (e instanceof BrainstormError) {
          return `## Brainstorming Error

**Type:** ${e.type}
**Message:** ${e.message}

${e.type === "session_closed" ? "The user closed the browser window before completing the session." : ""}
${e.type === "timeout" ? "The session timed out waiting for user input." : ""}
${e.type === "llm_error" ? "There was an error communicating with the LLM." : ""}`;
        }

        return `## Brainstorming Error

**Message:** ${e instanceof Error ? e.message : String(e)}`;
      }
    },
  });
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/tools/brainstorm/tool.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/tools/brainstorm/index.ts tests/tools/brainstorm/tool.test.ts
git commit -m "feat(brainstorm): add main brainstorm tool with full orchestration"
```

---

## Task 6: Integrate Brainstorm Tool into Plugin

**Files:**
- Modify: `src/tools/index.ts`
- Modify: `src/index.ts`

**Step 1: Update tools/index.ts to export brainstorm tool**

```typescript
// src/tools/index.ts
import type { SessionManager } from "../session/manager";
import type { OpencodeClient } from "@opencode-ai/sdk";
import { createSessionTools } from "./session";
import { createQuestionTools } from "./questions";
import { createResponseTools } from "./responses";
import { createBrainstormTool } from "./brainstorm";

export function createBrainstormerTools(manager: SessionManager, client?: OpencodeClient) {
  const baseTools = {
    ...createSessionTools(manager),
    ...createQuestionTools(manager),
    ...createResponseTools(manager),
  };

  // Only add brainstorm tool if client is provided
  if (client) {
    return {
      ...baseTools,
      brainstorm: createBrainstormTool(manager, client),
    };
  }

  return baseTools;
}
```

**Step 2: Update src/index.ts to pass client to tools**

```typescript
// src/index.ts
import type { Plugin } from "@opencode-ai/plugin";
import { SessionManager } from "./session/manager";
import { createBrainstormerTools } from "./tools";
import { agents } from "./agents";

const BrainstormerPlugin: Plugin = async (ctx) => {
  // Create session manager
  const sessionManager = new SessionManager();

  // Track which brainstormer sessions belong to which OpenCode sessions
  const sessionsByOpenCodeSession = new Map<string, Set<string>>();

  // Create all tools with session tracking (pass client for brainstorm tool)
  const baseTools = createBrainstormerTools(sessionManager, ctx.client);

  // Wrap start_session to track ownership, but use original execute for enforcement
  const originalStartSession = baseTools.start_session;
  const wrappedStartSession = {
    ...originalStartSession,
    execute: async (args: any, toolCtx: any) => {
      // Call original execute (which has enforcement)
      const result = await originalStartSession.execute(args, toolCtx);

      // If successful, track the session
      const sessionIdMatch = result.match(/ses_[a-z0-9]+/);
      if (sessionIdMatch) {
        const openCodeSessionId = toolCtx?.sessionID;
        if (openCodeSessionId) {
          if (!sessionsByOpenCodeSession.has(openCodeSessionId)) {
            sessionsByOpenCodeSession.set(openCodeSessionId, new Set());
          }
          sessionsByOpenCodeSession.get(openCodeSessionId)!.add(sessionIdMatch[0]);
        }
      }

      return result;
    },
  };

  return {
    tool: {
      ...baseTools,
      start_session: wrappedStartSession,
    },

    config: async (config) => {
      // Add brainstormer agent (kept for backward compatibility)
      config.agent = {
        ...config.agent,
        ...agents,
      };
    },

    event: async ({ event }) => {
      // Cleanup sessions when OpenCode session is deleted
      if (event.type === "session.deleted") {
        const props = event.properties as { info?: { id?: string } } | undefined;
        const openCodeSessionId = props?.info?.id;

        if (openCodeSessionId) {
          const brainstormerSessions = sessionsByOpenCodeSession.get(openCodeSessionId);
          if (brainstormerSessions) {
            for (const sessionId of brainstormerSessions) {
              await sessionManager.endSession(sessionId);
            }
            sessionsByOpenCodeSession.delete(openCodeSessionId);
          }
        }
      }
    },
  };
};

export default BrainstormerPlugin;

// Re-export types for consumers
export type * from "./types";
export type * from "./tools/brainstorm/types";
```

**Step 3: Verify compilation**

Run: `bun run typecheck`
Expected: No errors

**Step 4: Run all tests**

Run: `bun test`
Expected: All tests pass

**Step 5: Commit**

```bash
git add src/tools/index.ts src/index.ts
git commit -m "feat(brainstorm): integrate brainstorm tool into plugin exports"
```

---

## Task 7: Add Integration Test

**Files:**
- Create: `tests/integration/brainstorm.test.ts`

**Step 1: Write integration test**

```typescript
// tests/integration/brainstorm.test.ts
import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import { SessionManager } from "../../src/session/manager";
import { BrainstormOrchestrator } from "../../src/tools/brainstorm";
import type { BrainstormInput } from "../../src/tools/brainstorm/types";

describe("Brainstorm Integration", () => {
  let sessionManager: SessionManager;

  beforeEach(() => {
    sessionManager = new SessionManager({ skipBrowser: true });
  });

  afterEach(async () => {
    await sessionManager.cleanup();
  });

  describe("BrainstormOrchestrator with mocked LLM", () => {
    it("should complete a full brainstorming flow", async () => {
      // Create mock client that returns "done" after first probe call
      let probeCallCount = 0;
      const mockClient = {
        session: {
          prompt: mock(async () => {
            probeCallCount++;
            if (probeCallCount === 1) {
              // First call is probe - return done
              return {
                data: {
                  parts: [
                    {
                      type: "text",
                      text: JSON.stringify({ done: true, reason: "Design complete" }),
                    },
                  ],
                },
              };
            }
            // Second call is summary
            return {
              data: {
                parts: [
                  {
                    type: "text",
                    text: "## Problem Statement\nTest problem\n\n## Requirements\n- Test requirement",
                  },
                ],
              },
            };
          }),
        },
      } as any;

      const orchestrator = new BrainstormOrchestrator(sessionManager, mockClient, "test-session");

      const input: BrainstormInput = {
        context: "Test context",
        request: "Build a test feature",
        initial_questions: [
          {
            type: "confirm",
            config: { question: "Ready to start?" },
          },
        ],
      };

      // Start the orchestrator in background
      const resultPromise = orchestrator.run(input);

      // Simulate user answering the question
      // Wait a bit for session to be created
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Find the session and simulate an answer
      const questions = sessionManager.listQuestions();
      expect(questions.questions.length).toBe(1);

      const questionId = questions.questions[0].id;
      const sessionId = questionId.replace(/q_/, "ses_").slice(0, 12); // Approximate session ID

      // Simulate WebSocket message
      const sessions = sessionManager["sessions"];
      for (const [sid, session] of sessions) {
        for (const [qid, question] of session.questions) {
          if (question.status === "pending") {
            // Simulate answer
            sessionManager.handleWsMessage(sid, {
              type: "response",
              id: qid,
              answer: { choice: "yes" },
            });
          }
        }
      }

      // Wait for result
      const result = await resultPromise;

      expect(result.answers.length).toBe(1);
      expect(result.answers[0].question).toBe("Ready to start?");
      expect(result.summary).toContain("Problem Statement");
    });
  });
});
```

**Step 2: Run integration test**

Run: `bun test tests/integration/brainstorm.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add tests/integration/brainstorm.test.ts
git commit -m "test(brainstorm): add integration test for full brainstorming flow"
```

---

## Task 8: Update Documentation (Optional - if requested)

**Files:**
- Modify: `README.md` (if exists)

This task would add documentation for the new `brainstorm` tool, explaining:
- How to use it
- Input/output format
- Example usage
- Migration from old multi-agent approach

---

## Summary

This implementation plan creates a new `brainstorm` tool that:

1. **Types** (`src/tools/brainstorm/types.ts`): Defines input/output interfaces and error types
2. **Probe Helper** (`src/tools/brainstorm/probe.ts`): Handles LLM calls to decide next question
3. **Summarize Helper** (`src/tools/brainstorm/summarize.ts`): Generates design document from Q&A
4. **Orchestrator** (`src/tools/brainstorm/orchestrator.ts`): Manages the full brainstorming flow
5. **Tool** (`src/tools/brainstorm/index.ts`): Exposes the tool to OpenCode agents
6. **Integration** (`src/index.ts`, `src/tools/index.ts`): Wires everything together

The existing tools (`start_session`, `pick_one`, etc.) are preserved for backward compatibility, but the new `brainstorm` tool provides a simpler, more reliable interface for brainstorming sessions.

**Key Design Decisions:**
- Uses `client.session.prompt` for internal LLM calls
- Blocking tool that handles all async complexity internally
- Calling agent generates initial questions (not the tool)
- Maximum 15 questions by default (configurable)
- Default model: `anthropic/claude-sonnet-4` (configurable)
