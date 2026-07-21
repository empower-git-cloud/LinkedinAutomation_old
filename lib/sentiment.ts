import { Contact } from "../app/data";
import { llmComplete, llmConfigured } from "./llm";

export type CommentSignal = {
  intent: "High" | "Medium" | "Low";
  sentiment: Contact["sentiment"];
  /** Only high-confidence buying/question signals should become suggested contacts. */
  isLead: boolean;
};

/**
 * Classify LinkedIn comments for buying intent and sentiment. Uses the LLM in a
 * single batched call when a key is configured (genuinely understands nuance,
 * sarcasm, and implicit intent); falls back to a keyword heuristic otherwise.
 */
export async function classifyComments(texts: string[]): Promise<CommentSignal[]> {
  if (texts.length === 0) return [];
  if (llmConfigured()) {
    try {
      return await classifyWithLlm(texts);
    } catch {
      return texts.map(keywordClassify);
    }
  }
  return texts.map(keywordClassify);
}

async function classifyWithLlm(texts: string[]): Promise<CommentSignal[]> {
  const raw = await llmComplete(
    "You classify LinkedIn comments for a B2B lead pipeline. For each comment return intent (High = clear buying signal or wants to talk/demo/pricing; Medium = a genuine question that could lead somewhere; Low = supportive or neutral), sentiment (Interested, Question, Supportive, or Neutral), and isLead (true only for High intent or a high-confidence commercial question). Return only a JSON array aligned to the input order.",
    `Classify these ${texts.length} comments as a JSON array of {intent, sentiment, isLead}:\n${texts.map((text, i) => `${i + 1}. ${text}`).join("\n")}`,
    1200,
  );
  const parsed = JSON.parse(raw.replace(/^```json\s*/i, "").replace(/```$/i, "").trim()) as Record<string, unknown>[];
  if (!Array.isArray(parsed) || parsed.length !== texts.length) throw new Error("Classification shape mismatch");
  const intents = ["High", "Medium", "Low"];
  const sentiments = ["Interested", "Question", "Supportive", "Neutral"];
  return parsed.map(item => ({
    intent: (intents.includes(item.intent as string) ? item.intent : "Low") as CommentSignal["intent"],
    sentiment: (sentiments.includes(item.sentiment as string) ? item.sentiment : "Neutral") as Contact["sentiment"],
    isLead: item.isLead === true,
  }));
}

function keywordClassify(text: string): CommentSignal {
  const normalized = text.toLowerCase();
  const high = ["demo", "pricing", "price", "buy", "trial", "can we talk", "interested", "how do i get", "book", "call", "reach out", "dm"];
  if (high.some(term => normalized.includes(term))) return { intent: "High", sentiment: "Interested", isLead: true };
  if (normalized.includes("?") || /\bhow\b|\bwhat\b|\bwhere\b|\bwhen\b|\bwhy\b/.test(normalized)) return { intent: "Medium", sentiment: "Question", isLead: true };
  if (/\b(great|love|agree|helpful|spot on|well said|congrat|nice|thanks)\b/.test(normalized)) return { intent: "Low", sentiment: "Supportive", isLead: false };
  return { intent: "Low", sentiment: "Neutral", isLead: false };
}
