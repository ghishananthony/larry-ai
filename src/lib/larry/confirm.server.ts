import { createHmac, timingSafeEqual } from "crypto";
import type { ResearchProfile } from "./types";

/**
 * Server-issued confirmation token. The search endpoint only runs for a profile
 * the understanding step actually produced and presented for confirmation, so a
 * direct API call cannot skip the confirm step or search with an invented profile.
 */
const key = () => {
  const k = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? process.env["LOVABLE_API_KEY"];
  if (!k) throw new Error("Server signing key missing.");
  return `larry-confirm:${k}`;
};

export function signProfile(profile: ResearchProfile): string {
  return createHmac("sha256", key()).update(JSON.stringify(profile)).digest("hex");
}

export function verifyProfile(profile: ResearchProfile, token: unknown): boolean {
  if (typeof token !== "string" || !/^[0-9a-f]{64}$/.test(token)) return false;
  const a = Buffer.from(signProfile(profile), "hex");
  const b = Buffer.from(token, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
