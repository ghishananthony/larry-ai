CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  inst_id UUID;
BEGIN
  -- Institution assignment is server-authoritative: every new student
  -- account is attached to Menlo College. Any institution_slug supplied
  -- in the signup request metadata is ignored.
  SELECT id INTO inst_id
  FROM public.institutions
  WHERE slug = 'menlo-college'
  LIMIT 1;

  INSERT INTO public.profiles (id, email, full_name, institution_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    inst_id
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role, institution_id)
  VALUES (NEW.id, 'student', inst_id)
  ON CONFLICT (user_id, role, institution_id) DO NOTHING;

  RETURN NEW;
END;
$function$;