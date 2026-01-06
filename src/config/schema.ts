import { AGENTS } from "@agents";
import * as v from "valibot";

export const AgentOverrideSchema = v.object({
  model: v.optional(v.string()),
  temperature: v.optional(v.pipe(v.number(), v.minValue(0), v.maxValue(2))),
  maxTokens: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1))),
});

export const OcttoConfigSchema = v.object({
  agents: v.optional(v.record(v.enum(AGENTS), AgentOverrideSchema)),
});

export type AgentOverride = v.InferOutput<typeof AgentOverrideSchema>;
export type OcttoConfig = v.InferOutput<typeof OcttoConfigSchema>;
