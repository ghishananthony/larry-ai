
-- 1. Drop placeholder institutions (cascades to their resources/settings)
DELETE FROM public.usage_events WHERE institution_id IN (SELECT id FROM public.institutions WHERE slug IN ('st-jude','hudson-river'));
DELETE FROM public.resources WHERE institution_id IN (SELECT id FROM public.institutions WHERE slug IN ('st-jude','hudson-river'));
DELETE FROM public.institution_settings WHERE institution_id IN (SELECT id FROM public.institutions WHERE slug IN ('st-jude','hudson-river'));
DELETE FROM public.admin_access_requests WHERE institution_id IN (SELECT id FROM public.institutions WHERE slug IN ('st-jude','hudson-river'));
UPDATE public.profiles SET institution_id = NULL WHERE institution_id IN (SELECT id FROM public.institutions WHERE slug IN ('st-jude','hudson-river'));
DELETE FROM public.user_roles WHERE institution_id IN (SELECT id FROM public.institutions WHERE slug IN ('st-jude','hudson-river'));
DELETE FROM public.institutions WHERE slug IN ('st-jude','hudson-river');

-- 2. Approved email domains + subscription fields
ALTER TABLE public.institutions
  ADD COLUMN IF NOT EXISTS email_domains text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS plan_code text NOT NULL DEFAULT 'starter',
  ADD COLUMN IF NOT EXISTS implementation_fee_cents integer NOT NULL DEFAULT 250000,
  ADD COLUMN IF NOT EXISTS annual_price_cents integer NOT NULL DEFAULT 750000,
  ADD COLUMN IF NOT EXISTS subscription_status text NOT NULL DEFAULT 'trial',
  ADD COLUMN IF NOT EXISTS subscription_started_on date,
  ADD COLUMN IF NOT EXISTS renewal_on date,
  ADD COLUMN IF NOT EXISTS billing_status text NOT NULL DEFAULT 'none';

UPDATE public.institutions
SET email_domains = ARRAY['menlo.edu'],
    plan_code = 'campus',
    implementation_fee_cents = 500000,
    annual_price_cents = 1250000,
    subscription_status = 'trial',
    subscription_started_on = CURRENT_DATE,
    renewal_on = CURRENT_DATE + INTERVAL '1 year',
    billing_status = 'none'
WHERE slug = 'menlo-college';

-- 3. Configurable pricing plans (Super Admin only writes)
CREATE TABLE IF NOT EXISTS public.pricing_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  tagline text NOT NULL DEFAULT '',
  implementation_fee_cents integer NOT NULL DEFAULT 0,
  annual_price_cents integer NOT NULL DEFAULT 0,
  is_custom boolean NOT NULL DEFAULT false,
  features text[] NOT NULL DEFAULT '{}'::text[],
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.pricing_plans TO anon;
GRANT SELECT ON public.pricing_plans TO authenticated;
GRANT ALL ON public.pricing_plans TO service_role;

ALTER TABLE public.pricing_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pricing plans are publicly readable"
  ON public.pricing_plans FOR SELECT TO anon, authenticated USING (is_active);

CREATE POLICY "Super admins manage pricing plans"
  ON public.pricing_plans FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER pricing_plans_updated_at
  BEFORE UPDATE ON public.pricing_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.pricing_plans (code, name, tagline, implementation_fee_cents, annual_price_cents, is_custom, features, sort_order)
VALUES
  ('starter','Larry Starter','For single-library colleges getting started', 250000, 750000, false,
    ARRAY['One Larry instance','Catalog + licensed database directory','Standard embed widget','Email support'], 1),
  ('campus','Larry Campus','For multi-library campuses', 500000, 1250000, false,
    ARRAY['Everything in Starter','Multiple library configurations','Usage analytics','Priority support'], 2),
  ('university','Larry University','For large university systems', 0, 2000000, true,
    ARRAY['Everything in Campus','Custom implementation','System-wide deployment','Dedicated success manager'], 3)
ON CONFLICT (code) DO NOTHING;

-- 4. Server-side institutional verification: grants the student role only when
-- the caller's VERIFIED email matches an approved domain of the institution.
CREATE OR REPLACE FUNCTION public.claim_institution_access(_institution_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  ON CONFLICT (user_id, role) DO UPDATE SET institution_id = EXCLUDED.institution_id;

  RETURN jsonb_build_object('granted', true, 'institution_id', _institution_id);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_institution_access(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.claim_institution_access(uuid) TO authenticated;

-- Allow the guard trigger to accept institution assignment performed by this
-- security-definer function (it runs as definer, auth.uid() is still set).
CREATE OR REPLACE FUNCTION public.guard_profile_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.institution_id IS DISTINCT FROM OLD.institution_id
     AND NOT public.is_super_admin(auth.uid())
     AND auth.uid() IS NOT NULL
     AND current_setting('public.allow_tenant_change', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'Institution assignment cannot be changed by the account holder';
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
