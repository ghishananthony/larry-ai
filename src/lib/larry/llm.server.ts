import { createOpenAI } from "@ai-sdk/openai";
import { streamText, type ModelMessage } from "ai";

const MODEL = "openai/gpt-6-astra";
const BASE_URL = "https://ai.gateway.lovable.dev/v1";

export class LlmError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
  }
}

function runIdFetch() {
  let runId: string | undefined;
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    if (runId) headers.set("X-Lovable-AIG-Run-ID", runId);
    const res = await fetch(input, { ...init, headers });
    runId ??= res.headers.get("X-Lovable-AIG-Run-ID")?.trim() || undefined;
    return res;
  };
}

/** Server-only LLM call through Lovable AI Gateway. Streams, returns final text. */
export async function callLlm(
  system: string,
  messages: ModelMessage[],
  effort: "low" | "medium" = "low",
): Promise<string> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new LlmError("LOVABLE_API_KEY is not configured on the server.", 401);

  const provider = createOpenAI({
    baseURL: BASE_URL,
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch(),
  });

  let failure: unknown = null;
  const result = streamText({
    model: provider.responses(MODEL),
    system,
    messages,
    maxRetries: 0,
    onError: ({ error }) => {
      failure = error;
    },
    providerOptions: {
      openai: {
        forceReasoning: true,
        reasoningEffort: effort,
        reasoningSummary: "auto",
        store: false,
        include: ["reasoning.encrypted_content"],
      },
    },
  });
  const text = await result.text;
  if (failure) {
    const status = (failure as { statusCode?: number }).statusCode;
    throw new LlmError(status === 402 ? "AI credits are exhausted." : status === 429 ? "Larry is busy — please try again in a moment." : "The AI service failed.", status);
  }
  return text;
}

/** Parse a JSON object from model output (tolerates code fences). */
export function parseJson<T>(text: string): T {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) throw new LlmError("AI returned an unreadable response.");
  return JSON.parse(text.slice(start, end + 1)) as T;
}
