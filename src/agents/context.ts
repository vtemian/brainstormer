// src/agents/context.ts

import type { QuestionType } from "../session/types";

export interface QAPair {
  questionNumber: number;
  questionType: QuestionType;
  questionText: string;
  answer: unknown;
  config: unknown;
}

export interface PendingQuestion {
  questionNumber: number;
  questionType: QuestionType;
  questionText: string;
}

/**
 * Formats a single answer based on question type.
 * Maps response objects to human-readable summaries.
 */
export function formatAnswer(questionType: QuestionType, answer: unknown, config: unknown): string {
  if (!answer || typeof answer !== "object") {
    return "User did not respond";
  }

  const ans = answer as Record<string, unknown>;
  const cfg = config as Record<string, unknown>;

  switch (questionType) {
    case "pick_one": {
      const selected = ans.selected as string | undefined;
      if (!selected) return "User did not select";
      const options = (cfg.options as Array<{ id: string; label: string }>) || [];
      const option = options.find((o) => o.id === selected);
      return `User selected "${option?.label || selected}"`;
    }

    case "pick_many": {
      const selected = ans.selected as string[] | undefined;
      if (!selected || selected.length === 0) return "User selected nothing";
      const options = (cfg.options as Array<{ id: string; label: string }>) || [];
      const labels = selected.map((id) => {
        const opt = options.find((o) => o.id === id);
        return opt?.label || id;
      });
      return `User selected: ${labels.map((l) => `"${l}"`).join(", ")}`;
    }

    case "confirm": {
      const choice = ans.choice as string | undefined;
      if (choice === "yes") return "User said yes";
      if (choice === "no") return "User said no";
      if (choice === "cancel") return "User cancelled";
      return "User did not respond";
    }

    case "ask_text": {
      const text = ans.text as string | undefined;
      if (!text) return "User provided no text";
      return `User wrote: "${text}"`;
    }

    case "show_options": {
      const selected = ans.selected as string | undefined;
      const feedback = ans.feedback as string | undefined;
      if (!selected) return "User did not select";
      const options = (cfg.options as Array<{ id: string; label: string }>) || [];
      const option = options.find((o) => o.id === selected);
      let result = `User chose "${option?.label || selected}"`;
      if (feedback) result += ` with feedback: "${feedback}"`;
      return result;
    }

    case "thumbs": {
      const choice = ans.choice as string | undefined;
      if (choice === "up") return "User gave thumbs up";
      if (choice === "down") return "User gave thumbs down";
      return "User did not respond";
    }

    case "slider": {
      const value = ans.value as number | undefined;
      if (value === undefined) return "User did not set value";
      return `User set value to ${value}`;
    }

    case "rank": {
      const ranking = ans.ranking as string[] | undefined;
      if (!ranking || ranking.length === 0) return "User did not rank";
      const options = (cfg.options as Array<{ id: string; label: string }>) || [];
      const ranked = ranking.map((id, i) => {
        const opt = options.find((o) => o.id === id);
        return `${i + 1}. ${opt?.label || id}`;
      });
      return `User ranked: ${ranked.join(", ")}`;
    }

    case "rate": {
      const ratings = ans.ratings as Record<string, number> | undefined;
      if (!ratings) return "User did not rate";
      const options = (cfg.options as Array<{ id: string; label: string }>) || [];
      const rated = Object.entries(ratings).map(([id, rating]) => {
        const opt = options.find((o) => o.id === id);
        return `${opt?.label || id}: ${rating}`;
      });
      return `User rated: ${rated.join(", ")}`;
    }

    default:
      return `User responded: ${JSON.stringify(answer)}`;
  }
}

/**
 * Builds the full context string for the probe agent.
 * Includes answered questions and optionally pending questions.
 */
export function buildProbeContext(
  originalRequest: string,
  qaPairs: QAPair[],
  pendingQuestions: PendingQuestion[] = [],
): string {
  let context = `ORIGINAL REQUEST:\n${originalRequest}\n\n`;

  if (qaPairs.length === 0) {
    context += "CONVERSATION:\n(No questions answered yet)\n";
  } else {
    context += "CONVERSATION:\n";
    for (const qa of qaPairs) {
      const formattedAnswer = formatAnswer(qa.questionType, qa.answer, qa.config);
      context += `Q${qa.questionNumber} [${qa.questionType}]: ${qa.questionText}\n`;
      context += `A${qa.questionNumber}: ${formattedAnswer}\n\n`;
    }
  }

  if (pendingQuestions.length > 0) {
    context += "\nPENDING QUESTIONS:\n";
    for (const pq of pendingQuestions) {
      context += `Q${pq.questionNumber} [${pq.questionType}]: ${pq.questionText}\n`;
    }
  }

  return context.trim();
}
