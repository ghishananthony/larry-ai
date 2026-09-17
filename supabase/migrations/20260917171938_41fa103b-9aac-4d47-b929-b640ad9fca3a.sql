CREATE TABLE public.research_chats (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'New research chat',
  goal text NOT NULL DEFAULT '',
  source_types text[] NOT NULL DEFAULT '{}'::text[],
  stage text NOT NULL DEFAULT 'request',
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  profile jsonb,
  terms jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.research_chats TO authenticated;
GRANT ALL ON public.research_chats TO service_role;

ALTER TABLE public.research_chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students read own chats" ON public.research_chats
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND institution_id = public.current_institution(auth.uid()));

CREATE POLICY "Students create own chats" ON public.research_chats
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND institution_id = public.current_institution(auth.uid()));

CREATE POLICY "Students update own chats" ON public.research_chats
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND institution_id = public.current_institution(auth.uid()))
  WITH CHECK (user_id = auth.uid() AND institution_id = public.current_institution(auth.uid()));

CREATE POLICY "Students delete own chats" ON public.research_chats
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND institution_id = public.current_institution(auth.uid()));

CREATE INDEX research_chats_user_updated_idx ON public.research_chats (user_id, updated_at DESC);

CREATE TRIGGER update_research_chats_updated_at
  BEFORE UPDATE ON public.research_chats
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();