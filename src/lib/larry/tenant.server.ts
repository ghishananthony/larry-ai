import { getRequestHeader } from "@tanstack/react-start/server";

export type TenantResource = { name: string; status: string; disciplines: string[]; description: string | null };

/**
 * Resolves the caller's institution SERVER-SIDE. Never trusts an institution
 * id from the client: signed-in students are pinned to the institution on
 * their profile; signed-out visitors use the prototype default (Menlo College).
 * Only active/trial resources are returned — unsubscribed resources are never searchable.
 */
export async function resolveTenant(): Promise<{ institutionName: string; resources: TenantResource[] }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  let institutionId: string | null = null;

  const auth = getRequestHeader("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (token) {
    const { data } = await supabaseAdmin.auth.getUser(token);
    if (data.user) {
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("institution_id")
        .eq("id", data.user.id)
        .maybeSingle();
      institutionId = (prof as { institution_id: string | null } | null)?.institution_id ?? null;
      if (!institutionId) throw new Error("Your account is not linked to an institution.");
    }
  }

  const instQuery = supabaseAdmin.from("institutions").select("id, name");
  const { data: inst, error } = institutionId
    ? await instQuery.eq("id", institutionId).single()
    : await instQuery.eq("slug", "menlo-college").single();
  if (error || !inst) throw new Error("Institution not found.");

  const { data: res } = await supabaseAdmin
    .from("resources")
    .select("name, status, disciplines, description")
    .eq("institution_id", inst.id)
    .in("status", ["active", "trial"]);

  return { institutionName: inst.name, resources: (res ?? []) as TenantResource[] };
}
