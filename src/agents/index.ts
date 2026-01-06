// src/agents/index.ts
import type { AgentConfig } from "@opencode-ai/sdk";
import { agent as bootstrapper } from "./bootstrapper";
import { agent as octto } from "./octto";

export enum AGENTS {
  octto = "octto",
  bootstrapper = "bootstrapper",
}

export const agents: Record<AGENTS, AgentConfig> = {
  [AGENTS.octto]: octto,
  [AGENTS.bootstrapper]: bootstrapper,
};

export { octto, bootstrapper };
