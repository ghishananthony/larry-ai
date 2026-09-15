import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type InstitutionAccess = {
  institutionId: string | null;
  slug: string | null;
  name: string | null;
  roles: string[];
  isAdmin: boolean;
};

/**
 * Reads the signed-in user's own tenancy from the database.
 * Row Level Security guarantees these queries can only ever return
 * the caller's own profile/roles — the values are not client-supplied.
 */
export function useInstitutionAccess() {
  const { user } = useAuth();

  return useQuery<InstitutionAccess>({
    queryKey: ["institution-access", user?.id ?? null],
    enabled: Boolean(user?.id),
    staleTime: 60_000,
    queryFn: async () => {
      const [{ data: profile, error }, { data: roleRows, error: roleError }] = await Promise.all([
        supabase
          .from("profiles")
          .select("institution_id, institutions(slug, name)")
          .eq("id", user!.id)
          .maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user!.id),
      ]);
      if (error) throw error;
      if (roleError) throw roleError;

      const institution = (profile?.institutions ?? null) as {
        slug?: string;
        name?: string;
      } | null;
      const roles = (roleRows ?? []).map((r) => r.role as string);

      return {
        institutionId: profile?.institution_id ?? null,
        slug: institution?.slug ?? null,
        name: institution?.name ?? null,
        roles,
        isAdmin: roles.includes("college_admin") || roles.includes("super_admin"),
      };
    },
  });
}
