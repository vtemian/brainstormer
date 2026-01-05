// src/tools/index.ts
import type { SessionManager } from "../session/manager";
import type { OpencodeClient } from "@opencode-ai/sdk";
import { createSessionTools } from "./session";
import { createQuestionTools } from "./questions";
import { createResponseTools } from "./responses";
import { createPushQuestionTool } from "./push-question";

export function createBrainstormerTools(manager: SessionManager, _client?: OpencodeClient) {
  // Note: client param kept for backward compatibility but brainstorm tool removed
  // The all-in-one brainstorm tool caused deadlocks because session.prompt()
  // cannot be called from within a tool. Use individual tools + agent orchestration instead.
  return {
    ...createSessionTools(manager),
    ...createQuestionTools(manager),
    ...createResponseTools(manager),
    ...createPushQuestionTool(manager),
  };
}
