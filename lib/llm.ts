import { env } from "cloudflare:workers";

/**
 * Provider-agnostic LLM client. Uses the OpenAI-compatible Chat Completions API,
 * which OpenAI, Groq, Together, OpenRouter and most gateways all expose. The
 * provider is chosen entirely by environment variables, so switching from OpenAI
 * to Groq is a config change, not a code change.
 */

type LlmEnv = {
  LLM_API_KEY?: string; LLM_BASE_URL?: string; LLM_MODEL?: string;
  GROQ_API_KEY?: string;
  OPENAI_API_KEY?: string; OPENAI_MODEL?: string;
};

export function llmConfig() {
  const e = env as LlmEnv;
  const apiKey = e.LLM_API_KEY || e.GROQ_API_KEY || e.OPENAI_API_KEY;
  const usingGroq = Boolean(!e.LLM_BASE_URL && e.GROQ_API_KEY && !e.OPENAI_API_KEY);
  const baseUrl = (e.LLM_BASE_URL || (usingGroq ? "https://api.groq.com/openai/v1" : "https://api.openai.com/v1")).replace(/\/$/, "");
  const model = e.LLM_MODEL || e.OPENAI_MODEL || (baseUrl.includes("groq") ? "llama-3.3-70b-versatile" : "gpt-5.4-mini");
  return { apiKey, baseUrl, model };
}

export function llmConfigured() {
  return Boolean(llmConfig().apiKey);
}

/** One system+user turn → assistant text. Throws on any transport/format failure. */
export async function llmComplete(system: string, user: string, maxTokens = 2000): Promise<string> {
  const { apiKey, baseUrl, model } = llmConfig();
  if (!apiKey) throw new Error("No LLM key configured");
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      max_tokens: maxTokens,
      temperature: 0.7,
    }),
  });
  if (!response.ok) throw new Error(`LLM request failed: ${response.status} ${(await response.text()).slice(0, 200)}`);
  const result = await response.json() as { choices?: { message?: { content?: string } }[] };
  const text = result.choices?.[0]?.message?.content;
  if (!text) throw new Error("LLM returned no content");
  return text;
}
