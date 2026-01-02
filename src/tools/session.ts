// src/tools/session.ts
import { tool } from "@opencode-ai/plugin/tool";
import type { SessionManager } from "../session/manager";

export function createSessionTools(manager: SessionManager) {
  const start_session = tool({
    description: `Start an interactive brainstormer session.
Opens a browser window for the user to answer questions.
Returns session_id and URL. Use question tools to push questions.`,
    args: {
      title: tool.schema.string().optional().describe("Session title (shown in browser)"),
    },
    execute: async (args) => {
      try {
        const result = await manager.startSession({ title: args.title });
        return `## Session Started

| Field | Value |
|-------|-------|
| Session ID | ${result.session_id} |
| URL | ${result.url} |

Browser opened. Use question tools (pick_one, confirm, etc.) to push questions.
Use get_answer to retrieve responses.`;
      } catch (error) {
        return `Failed to start session: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });

  const end_session = tool({
    description: `End an interactive brainstormer session.
Closes the browser window and cleans up resources.`,
    args: {
      session_id: tool.schema.string().describe("Session ID to end"),
    },
    execute: async (args) => {
      const result = await manager.endSession(args.session_id);
      if (result.ok) {
        return `Session ${args.session_id} ended successfully.`;
      }
      return `Failed to end session ${args.session_id}. It may not exist.`;
    },
  });

  return { start_session, end_session };
}
