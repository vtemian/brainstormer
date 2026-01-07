// src/tools/brainstorm.ts
import { tool } from "@opencode-ai/plugin/tool";

import type { QuestionConfig, QuestionType, SessionStore } from "@/session";
import type { BrainstormState, StateStore } from "@/state";
import { createStateStore } from "@/state";

import { formatBranchStatus, formatFindings, formatFindingsList, formatQASummary } from "./formatters";
import { processAnswer } from "./processor";
import type { OcttoTools } from "./types";

function generateId(prefix: string): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = `${prefix}_`;
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// --- Extracted helper functions ---

interface CollectionResult {
  iterations: number;
  state: BrainstormState | null;
  allComplete: boolean;
}

async function collectAnswers(
  stateStore: StateStore,
  sessions: SessionStore,
  sessionId: string,
  browserSessionId: string,
  maxIterations = 50,
): Promise<CollectionResult> {
  const pendingProcessing: Promise<void>[] = [];
  let iterations = 0;

  async function isComplete(): Promise<boolean> {
    const state = await stateStore.getSession(sessionId);
    if (!state) return true;
    return Object.values(state.branches).every((b) => b.status === "done");
  }

  while (iterations < maxIterations) {
    iterations++;

    if (await isComplete()) break;

    const answerResult = await sessions.getNextAnswer({
      session_id: browserSessionId,
      block: true,
      timeout: 300000,
    });

    if (!answerResult.completed) {
      if (answerResult.status === "none_pending") {
        await Promise.all(pendingProcessing);
        pendingProcessing.length = 0;
        continue;
      }
      if (answerResult.status === "timeout") break;
      continue;
    }

    const { question_id, response } = answerResult;
    if (!question_id || response === undefined) continue;

    const processing = processAnswer(stateStore, sessions, sessionId, browserSessionId, question_id, response).catch(
      (error) => {
        console.error(`[octto] Error processing answer ${question_id}:`, error);
      },
    );
    pendingProcessing.push(processing);
  }

  await Promise.all(pendingProcessing);

  const state = await stateStore.getSession(sessionId);
  const allComplete = state ? Object.values(state.branches).every((b) => b.status === "done") : false;

  return { iterations, state, allComplete };
}

interface ReviewSection {
  id: string;
  title: string;
  content: string;
}

function buildReviewSections(state: BrainstormState): ReviewSection[] {
  return [
    {
      id: "summary",
      title: "Original Request",
      content: state.request,
    },
    ...state.branch_order.map((id) => {
      const b = state.branches[id];
      const qaSummary = formatQASummary(b);
      return {
        id,
        title: b.scope,
        content: `**Finding:** ${b.finding || "No finding"}\n\n**Discussion:**\n${qaSummary || "(no questions answered)"}`,
      };
    }),
  ];
}

interface ReviewResult {
  approved: boolean;
  feedback: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function waitForReviewApproval(sessions: SessionStore, browserSessionId: string): Promise<ReviewResult> {
  const result = await sessions.getNextAnswer({
    session_id: browserSessionId,
    block: true,
    timeout: 600000,
  });

  if (!result.completed || !result.response || !isRecord(result.response)) {
    return { approved: false, feedback: "" };
  }

  const response = result.response;
  const approved = response.approved === true || response.choice === "yes";

  let feedback = "";
  if (isRecord(response.annotations)) {
    feedback = Object.entries(response.annotations)
      .map(([section, note]) => `[${section}] ${note}`)
      .join("\n");
  } else if (response.feedback || response.text) {
    feedback = String(response.feedback || response.text);
  }

  return { approved, feedback };
}

// --- Format functions ---

function formatInProgressResult(state: BrainstormState, iterations: number): string {
  const findings = state.branch_order.map((id) => formatBranchStatus(state.branches[id])).join("\n\n");

  return `## Brainstorm In Progress

**Request:** ${state.request}
**Iterations:** ${iterations}

${findings}

Some branches still exploring. Call await_brainstorm_complete again to continue.`;
}

function formatSkippedReviewResult(state: BrainstormState): string {
  return `## Brainstorm Complete (Review Skipped)

**Request:** ${state.request}
**Branches:** ${state.branch_order.length}
**Note:** Browser session ended before review.

${formatFindings(state)}

Write the design document to docs/plans/.`;
}

function formatCompletionResult(
  state: BrainstormState,
  iterations: number,
  approved: boolean,
  feedback: string,
): string {
  return `## Brainstorm Complete

**Request:** ${state.request}
**Branches:** ${state.branch_order.length}
**Iterations:** ${iterations}
**Review Status:** ${approved ? "APPROVED" : "CHANGES REQUESTED"}
${feedback ? `**Feedback:** ${feedback}` : ""}

${formatFindings(state)}

${approved ? "Design approved. Write the design document to docs/plans/." : "Changes requested. Review feedback and discuss with user before proceeding."}`;
}

// --- Tool definitions ---

export function createBrainstormTools(sessions: SessionStore): OcttoTools {
  const stateStore = createStateStore();
  const create_brainstorm = tool({
    description: "Create a new brainstorm session with exploration branches",
    args: {
      request: tool.schema.string().describe("The original user request"),
      branches: tool.schema
        .array(
          tool.schema.object({
            id: tool.schema.string(),
            scope: tool.schema.string(),
            initial_question: tool.schema.object({
              type: tool.schema.string(),
              config: tool.schema.looseObject({}),
            }),
          }),
        )
        .describe("Branches to explore"),
    },
    execute: async (args) => {
      const sessionId = generateId("ses");

      await stateStore.createSession(
        sessionId,
        args.request,
        args.branches.map((b) => ({ id: b.id, scope: b.scope })),
      );

      const initialQuestions = args.branches.map((b) => ({
        type: b.initial_question.type as QuestionType,
        config: {
          ...b.initial_question.config,
          context: `[${b.scope}] ${(b.initial_question.config as Record<string, unknown>).context || ""}`.trim(),
        } as unknown as QuestionConfig,
      }));

      const browserSession = await sessions.startSession({
        title: "Brainstorming Session",
        questions: initialQuestions,
      });

      await stateStore.setBrowserSessionId(sessionId, browserSession.session_id);

      for (let i = 0; i < args.branches.length; i++) {
        const branch = args.branches[i];
        const questionId = browserSession.question_ids?.[i];
        if (questionId) {
          const questionText =
            typeof branch.initial_question.config === "object" && "question" in branch.initial_question.config
              ? String(branch.initial_question.config.question)
              : "Question";

          await stateStore.addQuestionToBranch(sessionId, branch.id, {
            id: questionId,
            type: branch.initial_question.type as QuestionType,
            text: questionText,
            config: branch.initial_question.config as unknown as QuestionConfig,
          });
        }
      }

      const branchList = args.branches.map((b) => `- ${b.id}: ${b.scope}`).join("\n");
      return `## Brainstorm Session Created

**Session ID:** ${sessionId}
**Browser Session:** ${browserSession.session_id}
**URL:** ${browserSession.url}

**Branches:**
${branchList}

Call get_next_answer(session_id="${browserSession.session_id}", block=true) to collect answers.`;
    },
  });

  const get_session_summary = tool({
    description: "Get summary of all branches and their findings",
    args: {
      session_id: tool.schema.string().describe("Brainstorm session ID"),
    },
    execute: async (args) => {
      const state = await stateStore.getSession(args.session_id);
      if (!state) return `Error: Session not found: ${args.session_id}`;

      const branchSummaries = state.branch_order.map((id) => formatBranchStatus(state.branches[id])).join("\n\n");
      const allDone = Object.values(state.branches).every((b) => b.status === "done");

      return `## Session Summary

**Request:** ${state.request}
**Status:** ${allDone ? "COMPLETE" : "IN PROGRESS"}

${branchSummaries}`;
    },
  });

  const end_brainstorm = tool({
    description: "End a brainstorm session and get final summary",
    args: {
      session_id: tool.schema.string().describe("Brainstorm session ID"),
    },
    execute: async (args) => {
      const state = await stateStore.getSession(args.session_id);
      if (!state) return `Error: Session not found: ${args.session_id}`;

      if (state.browser_session_id) {
        await sessions.endSession(state.browser_session_id);
      }

      const findings = formatFindingsList(state);
      await stateStore.deleteSession(args.session_id);

      return `## Brainstorm Complete

**Request:** ${state.request}

### Findings

${findings}

Write the design document based on these findings.`;
    },
  });

  const await_brainstorm_complete = tool({
    description: `Wait for brainstorm session to complete. Processes answers asynchronously as they arrive.
Returns when all branches are done with their findings.
This is the recommended way to run a brainstorm - just create_brainstorm then await_brainstorm_complete.`,
    args: {
      session_id: tool.schema.string().describe("Brainstorm session ID (state session)"),
      browser_session_id: tool.schema.string().describe("Browser session ID (for collecting answers)"),
    },
    execute: async (args) => {
      const { iterations, state, allComplete } = await collectAnswers(
        stateStore,
        sessions,
        args.session_id,
        args.browser_session_id,
      );

      if (!state) return "Error: Session lost";
      if (!allComplete) return formatInProgressResult(state, iterations);

      const sections = buildReviewSections(state);

      try {
        sessions.pushQuestion(args.browser_session_id, "show_plan", {
          question: "Review Design Plan",
          sections,
        } as QuestionConfig);
      } catch {
        return formatSkippedReviewResult(state);
      }

      const { approved, feedback } = await waitForReviewApproval(sessions, args.browser_session_id);
      return formatCompletionResult(state, iterations, approved, feedback);
    },
  });

  return {
    create_brainstorm,
    get_session_summary,
    end_brainstorm,
    await_brainstorm_complete,
  };
}
