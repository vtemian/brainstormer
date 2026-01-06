// src/state/types.ts
import type { QuestionConfig, QuestionType } from "@session";

export type BranchStatus = "exploring" | "done";

export interface BranchQuestion {
  id: string;
  type: QuestionType;
  text: string;
  config: QuestionConfig;
  answer?: unknown;
  answeredAt?: number;
}

export interface Branch {
  id: string;
  scope: string;
  status: BranchStatus;
  questions: BranchQuestion[];
  finding: string | null;
}

export interface BrainstormState {
  session_id: string;
  browser_session_id: string | null;
  request: string;
  created_at: number;
  updated_at: number;
  branches: Record<string, Branch>;
  branch_order: string[];
}

export interface CreateBranchInput {
  id: string;
  scope: string;
}

export interface BranchProbeResult {
  done: boolean;
  reason: string;
  finding?: string;
  question?: {
    type: QuestionType;
    config: QuestionConfig;
  };
}
