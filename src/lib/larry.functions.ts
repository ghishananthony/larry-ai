import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { ResearchProfile, SearchResult, TurnResult } from "./larry/types";

const messageSchema = z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(8000) });

const friendly = (e: unknown) => {
  const status = (e as { status?: number }).status;
  if (status === 402) return "Larry's AI service is out of credits right now. Please try again later.";
  if (status === 429) return "Larry is busy — please try again in a moment.";
  if (status === 401) return "Larry's AI service is not configured yet.";
  return "Something went wrong while Larry was working. Please try again.";
};

/** One conversational turn: safety gate → understanding → clarify or confirm. */
export const larryTurn = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ messages: z.array(messageSchema).min(1).max(40), profile: z.any().nullable() }).parse(d),
  )
  .handler(async ({ data }): Promise<TurnResult> => {
    const { checkSafety, REFUSAL } = await import("./larry/safety.server");
    const { understand, sanitizeProfile } = await import("./larry/understand.server");
    try {
      const userText = data.messages.filter((m) => m.role === "user").map((m) => m.content).join("\n---\n");
      const safety = await checkSafety(userText);
      if (!safety.allowed) return { kind: "blocked", reply: REFUSAL };
      return await understand(data.messages, data.profile ? sanitizeProfile(data.profile) : null);
    } catch (e) {
      console.error("larryTurn", e);
      return { kind: "error", reply: friendly(e) };
    }
  });

/** Runs only after the student confirms the profile. Institution resolved server-side. */
export const larrySearch = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ profile: z.any() }).parse(d))
  .handler(async ({ data }): Promise<SearchResult> => {
    const { checkSafety, REFUSAL } = await import("./larry/safety.server");
    const { sanitizeProfile } = await import("./larry/understand.server");
    const { resolveTenant } = await import("./larry/tenant.server");
    const { runSearch } = await import("./larry/orchestrate.server");
    try {
      const profile: ResearchProfile = sanitizeProfile(data.profile);
      // Re-check the (client-held) profile so a tampered profile cannot bypass the gate.
      const safety = await checkSafety(JSON.stringify(profile));
      if (!safety.allowed) return { kind: "blocked", reply: REFUSAL };
      const tenant = await resolveTenant();
      return await runSearch(profile, tenant.resources);
    } catch (e) {
      console.error("larrySearch", e);
      return { kind: "error", reply: friendly(e) };
    }
  });
