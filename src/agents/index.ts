// src/agents/index.ts
import type { AgentConfig } from "@opencode-ai/sdk";
import { brainstormerAgent } from "./brainstormer";
import { bootstrapperAgent } from "./bootstrapper";
import { probeAgent } from "./probe";

export const agents: Record<string, AgentConfig> = {
  brainstormer: brainstormerAgent,
  bootstrapper: bootstrapperAgent,
  probe: probeAgent,
};

export { brainstormerAgent, bootstrapperAgent, probeAgent };
