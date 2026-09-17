import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useInstitutionAccess } from "@/hooks/useInstitutionAccess";

export type ResearchChatRow = {
  id: string;
  title: string;
  goal: string;
  source_types: string[];
  stage: string;
  answers: Record<string, string>;
  profile: unknown;
  terms: unknown;
  updated_at: string;
};

export type ResearchChatSnapshot = {
  id?: string | null;
  title: string;
  goal: string;
  sourceTypes: string[];
  stage: string;
  answers: Record<string, string>;
  profile: unknown;
  terms: unknown;
};

/**
 * Previous research chats for the signed-in student only.
 * Row Level Security scopes every row to the caller's own user id and
 * their own institution — guests never read or write chats.
 */
export function useResearchChats() {
  const { user } = useAuth();

  return useQuery<ResearchChatRow[]>({
    queryKey: ["research-chats", user?.id ?? null],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("research_chats")
        .select("id, title, goal, source_types, stage, answers, profile, terms, updated_at")
        .order("updated_at", { ascending: false })
        .limit(25);
      if (error) throw error;
      return (data ?? []) as unknown as ResearchChatRow[];
    },
  });
}

export function useSaveResearchChat() {
  const { user } = useAuth();
  const access = useInstitutionAccess();
  const queryClient = useQueryClient();
  const institutionId = access.data?.institutionId ?? null;

  return useMutation({
    mutationFn: async (snapshot: ResearchChatSnapshot): Promise<string | null> => {
      if (!user?.id || !institutionId) return null;

      const payload = {
        title: snapshot.title.slice(0, 120) || "New research chat",
        goal: snapshot.goal,
        source_types: snapshot.sourceTypes,
        stage: snapshot.stage,
        answers: snapshot.answers,
        profile: snapshot.profile ?? null,
        terms: snapshot.terms ?? null,
      };

      if (snapshot.id) {
        const { error } = await supabase
          .from("research_chats")
          .update(payload)
          .eq("id", snapshot.id);
        if (error) throw error;
        return snapshot.id;
      }

      const { data, error } = await supabase
        .from("research_chats")
        .insert({ ...payload, user_id: user.id, institution_id: institutionId })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["research-chats", user?.id ?? null] });
    },
  });
}

export function useDeleteResearchChat() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("research_chats").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["research-chats", user?.id ?? null] });
    },
  });
}
