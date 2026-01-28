// src/hooks/fragment-injector.ts
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import * as v from "valibot";

import { AGENTS } from "@/agents";

type FragmentsRecord = Record<string, string[]> | undefined;

const VALID_AGENT_NAMES = Object.values(AGENTS);

const ProjectFragmentsSchema = v.record(v.string(), v.array(v.string()));

/**
 * Format fragments array as an XML block to prepend to agent prompts.
 */
export function formatFragmentsBlock(fragments: string[] | undefined): string {
  if (!fragments || fragments.length === 0) {
    return "";
  }

  const bulletPoints = fragments.map((f) => `- ${f}`).join("\n");
  return `<user-instructions>\n${bulletPoints}\n</user-instructions>\n\n`;
}

/**
 * Merge global and project fragments.
 * Global fragments come first, project fragments append.
 */
export function mergeFragments(global: FragmentsRecord, project: FragmentsRecord): Record<string, string[]> {
  const result: Record<string, string[]> = {};

  if (global) {
    for (const [agent, frags] of Object.entries(global)) {
      result[agent] = [...frags];
    }
  }

  if (project) {
    for (const [agent, frags] of Object.entries(project)) {
      if (result[agent]) {
        result[agent].push(...frags);
      } else {
        result[agent] = [...frags];
      }
    }
  }

  return result;
}

/**
 * Load project-level fragments from .octto/fragments.json
 */
export async function loadProjectFragments(projectDir: string): Promise<Record<string, string[]> | undefined> {
  const fragmentsPath = join(projectDir, ".octto", "fragments.json");

  try {
    const content = await readFile(fragmentsPath, "utf-8");
    const parsed = JSON.parse(content);

    const result = v.safeParse(ProjectFragmentsSchema, parsed);
    if (!result.success) {
      console.warn(`[octto] Invalid fragments.json schema in ${fragmentsPath}`);
      return undefined;
    }

    return result.output;
  } catch {
    return undefined;
  }
}

/**
 * Calculate Levenshtein distance between two strings.
 * Used for suggesting similar agent names for typos.
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1, // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Warn about unknown agent names in fragments config.
 * Suggests similar valid agent names for likely typos.
 */
export function warnUnknownAgents(fragments: Record<string, string[]> | undefined): void {
  if (!fragments) return;

  for (const agentName of Object.keys(fragments)) {
    if (VALID_AGENT_NAMES.includes(agentName as AGENTS)) {
      continue;
    }

    // Find closest valid agent name
    let closest: string | undefined;
    let minDistance = Infinity;

    for (const validName of VALID_AGENT_NAMES) {
      const distance = levenshteinDistance(agentName, validName);
      if (distance < minDistance && distance <= 3) {
        minDistance = distance;
        closest = validName;
      }
    }

    let message = `[octto] Unknown agent "${agentName}" in fragments config.`;
    if (closest) {
      message += ` Did you mean "${closest}"?`;
    }
    message += ` Valid agents: ${VALID_AGENT_NAMES.join(", ")}`;

    console.warn(message);
  }
}

export interface FragmentInjectorContext {
  projectDir: string;
}

/**
 * Create a fragment injector that can modify agent system prompts.
 * Returns merged fragments from global config and project config.
 */
export async function createFragmentInjector(
  ctx: FragmentInjectorContext,
  globalFragments: FragmentsRecord,
): Promise<Record<string, string[]>> {
  const projectFragments = await loadProjectFragments(ctx.projectDir);
  const merged = mergeFragments(globalFragments, projectFragments);

  // Warn about unknown agents in both global and project fragments
  warnUnknownAgents(globalFragments);
  warnUnknownAgents(projectFragments);

  return merged;
}

/**
 * Get the system prompt prefix for a specific agent.
 */
export function getAgentSystemPromptPrefix(fragments: Record<string, string[]>, agentName: string): string {
  return formatFragmentsBlock(fragments[agentName]);
}
