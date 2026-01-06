// src/tools/formatters.ts

import type { BrainstormState, Branch } from "@/state";

export function formatBranchFinding(branch: Branch): string {
  return `### ${branch.id}\n**Scope:** ${branch.scope}\n**Finding:** ${branch.finding || "(no finding)"}`;
}

export function formatBranchStatus(branch: Branch): string {
  const status = branch.status === "done" ? "DONE" : "EXPLORING";
  return `### ${branch.id} [${status}]\n**Scope:** ${branch.scope}\n**Finding:** ${branch.finding || "(pending)"}`;
}

export function formatFindings(state: BrainstormState): string {
  return state.branch_order.map((id) => formatBranchFinding(state.branches[id])).join("\n\n");
}

export function formatFindingsList(state: BrainstormState): string {
  return state.branch_order
    .map((id) => {
      const b = state.branches[id];
      return `- **${b.scope}:** ${b.finding || "(no finding)"}`;
    })
    .join("\n");
}

export function formatQASummary(branch: Branch): string {
  return branch.questions
    .filter((q) => q.answer !== undefined)
    .map((q) => {
      const ans = q.answer as Record<string, unknown>;
      const text = ans.selected || ans.choice || ans.text || JSON.stringify(ans);
      return `- **${q.text}**\n  → ${text}`;
    })
    .join("\n");
}
