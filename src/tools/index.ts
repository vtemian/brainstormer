// src/tools/index.ts

import type { OpencodeClient } from "@opencode-ai/sdk";
import type { SessionManager } from "@session";
import { StateManager } from "@state";
import { createBranchTools } from "./branch";
import { createPushQuestionTool } from "./push-question";
import { createQuestionTools } from "./questions";
import { createResponseTools } from "./responses";
import { createSessionTools } from "./session";

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
