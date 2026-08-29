CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  inst_id UUID;
BEGIN
  SELECT id INTO inst_id
  FROM public.institutions
  WHERE slug = COALESCE(NEW.raw_user_meta_data ->> 'institution_slug', 'menlo-college')
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

CREATE OR REPLACE FUNCTION public.claim_institution_access(_institution_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _email text;
  _confirmed timestamptz;
  _domain text;
  _domains text[];
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('granted', false, 'reason', 'not_authenticated');
  END IF;

  SELECT email, email_confirmed_at INTO _email, _confirmed FROM auth.users WHERE id = _uid;

  IF _confirmed IS NULL THEN
    RETURN jsonb_build_object('granted', false, 'reason', 'email_not_verified');
  END IF;

  SELECT email_domains INTO _domains FROM public.institutions WHERE id = _institution_id AND is_active;
  IF _domains IS NULL THEN
    RETURN jsonb_build_object('granted', false, 'reason', 'unknown_institution');
  END IF;

  _domain := lower(split_part(_email, '@', 2));

  IF NOT (_domain = ANY (SELECT lower(unnest(_domains)))) THEN
    RETURN jsonb_build_object('granted', false, 'reason', 'domain_mismatch', 'domain', _domain);
  END IF;

  PERFORM set_config('public.allow_tenant_change', 'on', true);
  UPDATE public.profiles SET institution_id = _institution_id, updated_at = now() WHERE id = _uid;
  PERFORM set_config('public.allow_tenant_change', 'off', true);

  INSERT INTO public.user_roles (user_id, role, institution_id)
  VALUES (_uid, 'student', _institution_id)
  ON CONFLICT (user_id, role, institution_id) DO UPDATE SET institution_id = EXCLUDED.institution_id;

  RETURN jsonb_build_object('granted', true, 'institution_id', _institution_id);
END;
$function$;