// src/agents/index.ts
import type { AgentConfig } from "@opencode-ai/sdk";
import { brainstormerAgent } from "./brainstormer";
import { bootstrapperAgent } from "./bootstrapper";

export const agents: Record<string, AgentConfig> = {
  brainstormer: brainstormerAgent,
  bootstrapper: bootstrapperAgent,
};

export { brainstormerAgent, bootstrapperAgent };
