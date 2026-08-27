
CREATE TYPE public.app_role AS ENUM ('student', 'college_admin', 'super_admin');

-- INSTITUTIONS ---------------------------------------------------------
CREATE TABLE public.institutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  short_name text NOT NULL,
  catalog_name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.institutions TO anon;
GRANT SELECT ON public.institutions TO authenticated;
GRANT ALL ON public.institutions TO service_role;
ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.institution_settings (
  institution_id uuid PRIMARY KEY REFERENCES public.institutions(id) ON DELETE CASCADE,
  proxy_prefix text NOT NULL DEFAULT '',
  default_auth_method text NOT NULL DEFAULT 'Shibboleth SSO',
  embed_key uuid NOT NULL DEFAULT gen_random_uuid(),
  notes text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.institution_settings TO authenticated;
GRANT ALL ON public.institution_settings TO service_role;
ALTER TABLE public.institution_settings ENABLE ROW LEVEL SECURITY;

-- PROFILES -------------------------------------------------------------
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL DEFAULT '',
  institution_id uuid REFERENCES public.institutions(id) ON DELETE SET NULL,
  marketing_opt_in boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ROLES ----------------------------------------------------------------
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  institution_id uuid REFERENCES public.institutions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role, institution_id)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- SECURITY DEFINER HELPERS --------------------------------------------
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'super_admin');
$$;

CREATE OR REPLACE FUNCTION public.manages_institution(_user_id uuid, _institution_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND (role = 'super_admin'
           OR (role = 'college_admin' AND institution_id = _institution_id))
  );
$$;

CREATE OR REPLACE FUNCTION public.current_institution(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT institution_id FROM public.profiles WHERE id = _user_id;
$$;

-- POLICIES: institutions ----------------------------------------------
CREATE POLICY "Institution directory is publicly readable"
  ON public.institutions FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Super admins manage institutions"
  ON public.institutions FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- POLICIES: institution_settings --------------------------------------
CREATE POLICY "Managers read their institution settings"
  ON public.institution_settings FOR SELECT TO authenticated
  USING (public.manages_institution(auth.uid(), institution_id));

CREATE POLICY "Managers update their institution settings"
  ON public.institution_settings FOR UPDATE TO authenticated
  USING (public.manages_institution(auth.uid(), institution_id))
  WITH CHECK (public.manages_institution(auth.uid(), institution_id));

-- POLICIES: profiles ---------------------------------------------------
CREATE POLICY "Users read own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_super_admin(auth.uid()));

CREATE POLICY "Users insert own profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- Prevent a signed-in user from moving themselves to another tenant.
CREATE OR REPLACE FUNCTION public.guard_profile_tenant()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.institution_id IS DISTINCT FROM OLD.institution_id
     AND NOT public.is_super_admin(auth.uid())
     AND auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Institution assignment cannot be changed by the account holder';
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER profiles_guard_tenant BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_tenant();

-- POLICIES: user_roles -------------------------------------------------
CREATE POLICY "Users read own roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()));
-- No insert/update/delete policies: role changes only happen server-side.

-- ADMIN ACCESS REQUESTS ------------------------------------------------
CREATE TABLE public.admin_access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  contact_email text NOT NULL,
  justification text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.admin_access_requests TO authenticated;
GRANT ALL ON public.admin_access_requests TO service_role;
ALTER TABLE public.admin_access_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own admin requests"
  ON public.admin_access_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()));

CREATE POLICY "Users create their own pending admin request"
  ON public.admin_access_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'pending');

-- RESOURCES ------------------------------------------------------------
CREATE TABLE public.resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  name text NOT NULL,
  provider text NOT NULL DEFAULT '',
  kind text NOT NULL DEFAULT 'database' CHECK (kind IN ('database', 'catalog', 'repository')),
  disciplines text[] NOT NULL DEFAULT '{}',
  source_types text[] NOT NULL DEFAULT '{}',
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'trial', 'not_subscribed', 'auth_error')),
  auth_method text NOT NULL DEFAULT 'Shibboleth SSO',
  monthly_queries integer NOT NULL DEFAULT 0,
  url text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX resources_institution_idx ON public.resources (institution_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.resources TO authenticated;
GRANT ALL ON public.resources TO service_role;
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read their own institution resources"
  ON public.resources FOR SELECT TO authenticated
  USING (
    institution_id = public.current_institution(auth.uid())
    OR public.manages_institution(auth.uid(), institution_id)
  );

CREATE POLICY "Managers write their own institution resources"
  ON public.resources FOR ALL TO authenticated
  USING (public.manages_institution(auth.uid(), institution_id))
  WITH CHECK (public.manages_institution(auth.uid(), institution_id));

-- USAGE ----------------------------------------------------------------
CREATE TABLE public.usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resource_id uuid REFERENCES public.resources(id) ON DELETE SET NULL,
  event_type text NOT NULL DEFAULT 'resource_matched',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX usage_events_institution_idx ON public.usage_events (institution_id);
GRANT SELECT ON public.usage_events TO authenticated;
GRANT ALL ON public.usage_events TO service_role;
ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers read their institution usage"
  ON public.usage_events FOR SELECT TO authenticated
  USING (public.manages_institution(auth.uid(), institution_id));

-- SEED -----------------------------------------------------------------
INSERT INTO public.institutions (slug, name, short_name, catalog_name) VALUES
  ('menlo-college', 'Menlo College', 'Menlo', 'Bowman Library Catalog'),
  ('st-jude', 'University of St. Jude', 'St. Jude', 'St. Jude Main Library Catalog'),
  ('hudson-river', 'Hudson River University', 'Hudson River', 'Hudson River Libraries Catalog');

INSERT INTO public.institution_settings (institution_id, proxy_prefix, default_auth_method)
SELECT id,
  CASE slug
    WHEN 'menlo-college' THEN 'https://ezproxy.menlo.edu/login?url='
    WHEN 'st-jude' THEN 'https://ezproxy.stjude.edu/login?url='
    ELSE 'https://proxy.hru.edu/login?url='
  END,
  CASE slug WHEN 'hudson-river' THEN 'OpenAthens' ELSE 'Shibboleth SSO' END
FROM public.institutions;

INSERT INTO public.resources (institution_id, name, provider, kind, disciplines, source_types, description, status, auth_method, monthly_queries, url)
SELECT i.id, r.name, r.provider, r.kind, r.disciplines, r.source_types, r.description, r.status, r.auth_method, r.monthly_queries, r.url
FROM public.institutions i
JOIN (VALUES
  ('menlo-college', 'Business Source Complete', 'EBSCO', 'database', ARRAY['business','economics','psychology'], ARRAY['Peer-reviewed articles','Reports'], 'Core business, management, and applied economics literature.', 'active', 'Shibboleth SSO', 6120, 'https://search.ebscohost.com/login.aspx?direct=true&db=bth&bquery='),
  ('menlo-college', 'JSTOR — Business & Social Sciences', 'ITHAKA', 'database', ARRAY['sociology','history','psychology','media'], ARRAY['Peer-reviewed articles','Book chapters'], 'Multidisciplinary scholarly journal archive.', 'active', 'Shibboleth SSO', 4310, 'https://www.jstor.org/action/doBasicSearch?Query='),
  ('menlo-college', 'Bowman Library Catalog', 'OCLC WorldShare', 'catalog', ARRAY['business','psychology','history','media','sociology'], ARRAY['Books & e-books','Monographs'], 'Print and electronic holdings at Bowman Library.', 'active', 'Shibboleth SSO', 8880, 'https://menlo.on.worldcat.org/search?queryString='),
  ('menlo-college', 'ProQuest Dissertations & Theses', 'ProQuest', 'repository', ARRAY['psychology','business','sociology'], ARRAY['Dissertations','Primary sources'], 'Doctoral and master''s research across disciplines.', 'trial', 'EZproxy', 640, 'https://www.proquest.com/results?q='),
  ('menlo-college', 'Westlaw Campus Research', 'Thomson Reuters', 'database', ARRAY['law','policy'], ARRAY['Primary sources'], 'Not currently licensed by this institution.', 'not_subscribed', 'IP Range', 0, ''),
  ('st-jude', 'JSTOR — Arts & Sciences Collections', 'ITHAKA', 'database', ARRAY['psychology','sociology','history','media'], ARRAY['Peer-reviewed articles','Book chapters'], 'Multidisciplinary archive of scholarly journals.', 'active', 'Shibboleth SSO', 14208, 'https://www.jstor.org/action/doBasicSearch?Query='),
  ('st-jude', 'PsycINFO via EBSCOhost', 'EBSCO', 'database', ARRAY['psychology','education','health'], ARRAY['Peer-reviewed articles','Dissertations'], 'Indexes psychological literature.', 'active', 'IP Range', 8992, 'https://search.ebscohost.com/login.aspx?direct=true&db=psyh&bquery='),
  ('st-jude', 'ProQuest Dissertations & Theses', 'ProQuest', 'repository', ARRAY['psychology','marine biology','sociology'], ARRAY['Dissertations','Primary sources'], 'Doctoral and master''s research across disciplines.', 'active', 'EZproxy', 3120, 'https://www.proquest.com/results?q='),
  ('st-jude', 'ScienceDirect Journals', 'Elsevier', 'database', ARRAY['marine biology','chemistry','health'], ARRAY['Peer-reviewed articles'], 'Full-text science and technology journals.', 'trial', 'EZproxy', 1043, 'https://www.sciencedirect.com/search?qs='),
  ('st-jude', 'St. Jude Main Library Catalog', 'Ex Libris Alma', 'catalog', ARRAY['psychology','history','marine biology','sociology','media'], ARRAY['Books & e-books','Monographs'], 'Books, e-books, and physical holdings.', 'active', 'Shibboleth SSO', 20144, 'https://catalog.stjude.edu/discovery/search?query=any,contains,'),
  ('hudson-river', 'JSTOR — Essential Collection', 'ITHAKA', 'database', ARRAY['history','sociology','media'], ARRAY['Peer-reviewed articles'], 'Core humanities and social science journal archive.', 'active', 'OpenAthens', 5211, 'https://www.jstor.org/action/doBasicSearch?Query='),
  ('hudson-river', 'ERIC (Education Resources)', 'U.S. Dept. of Education', 'database', ARRAY['education','psychology'], ARRAY['Peer-reviewed articles','Reports'], 'Education research literature and reports.', 'active', 'IP Range', 2870, 'https://eric.ed.gov/?q='),
  ('hudson-river', 'Hudson River Libraries Catalog', 'FOLIO', 'catalog', ARRAY['history','education','psychology','media','sociology'], ARRAY['Books & e-books','Monographs'], 'Print and electronic holdings across three campus libraries.', 'active', 'OpenAthens', 9004, 'https://catalog.hru.edu/search?q='),
  ('hudson-river', 'Oxford University Press Journals', 'OUP', 'database', ARRAY['history','sociology'], ARRAY['Peer-reviewed articles'], 'Authentication handshake is currently failing.', 'auth_error', 'Shibboleth SSO', 0, 'https://academic.oup.com/journals/search-results?q=')
) AS r(slug, name, provider, kind, disciplines, source_types, description, status, auth_method, monthly_queries, url)
  ON r.slug = i.slug;
