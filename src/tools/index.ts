// src/tools/index.ts
import type { SessionManager } from "../session/manager";
import type { OpencodeClient } from "@opencode-ai/sdk";
import { createSessionTools } from "./session";
import { createQuestionTools } from "./questions";
import { createResponseTools } from "./responses";
import { createPushQuestionTool } from "./push-question";
import { createBranchTools } from "./branch";
import { StateManager } from "../state/manager";

export function createOcttoTools(manager: SessionManager, _client?: OpencodeClient) {
  const stateManager = new StateManager();

  return {
    ...createSessionTools(manager),
    ...createQuestionTools(manager),
    ...createResponseTools(manager),
    ...createPushQuestionTool(manager),
    ...createBranchTools(stateManager, manager),
  };
}
