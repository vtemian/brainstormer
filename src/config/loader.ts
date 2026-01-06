import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { AGENTS } from "@agents";
import type { AgentConfig } from "@opencode-ai/sdk";
import * as v from "valibot";
import { type OcttoConfig, OcttoConfigSchema } from "./schema";

export type { AgentOverride, OcttoConfig } from "./schema";

/**
 * Load user configuration from ~/.config/opencode/octto.json
 * Returns null if file doesn't exist or is invalid.
 */
export async function loadConfig(configDir?: string): Promise<OcttoConfig | null> {
  const baseDir = configDir ?? join(homedir(), ".config", "opencode");
  const configPath = join(baseDir, "octto.json");

  try {
    const content = await readFile(configPath, "utf-8");
    const parsed = JSON.parse(content);
    const result = v.safeParse(OcttoConfigSchema, parsed);

    if (!result.success) {
      return null;
    }

    return result.output;
  } catch {
    return null;
  }
}

/**
 * Merge plugin default agents with user overrides.
 * User overrides take precedence for safe properties only.
 */
export function mergeAgentConfigs(
  pluginAgents: Record<AGENTS, AgentConfig>,
  userConfig: OcttoConfig | null,
): Record<AGENTS, AgentConfig> {
  if (!userConfig?.agents) {
    return pluginAgents;
  }

  const merged = {} as Record<AGENTS, AgentConfig>;

  for (const [name, agent] of Object.entries(pluginAgents)) {
    const agentName = name as AGENTS;
    const overrides = userConfig.agents[agentName];
    if (overrides) {
      merged[agentName] = {
        ...agent,
        ...(overrides.model && { model: overrides.model }),
        ...(overrides.temperature !== undefined && {
          temperature: overrides.temperature,
        }),
        ...(overrides.maxTokens !== undefined && {
          maxTokens: overrides.maxTokens,
        }),
      };
    } else {
      merged[agentName] = agent;
    }
  }

  return merged;
}
