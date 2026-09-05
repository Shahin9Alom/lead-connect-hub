CREATE OR REPLACE FUNCTION public.canonical_facebook_link(input_link text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
STRICT
SET search_path = public
AS $$
DECLARE
  normalized text;
  profile_id text;
BEGIN
  normalized := lower(btrim(input_link));
  normalized := regexp_replace(normalized, '[[:space:]]+', '', 'g');
  normalized := regexp_replace(normalized, '^https?://', '', 'i');
  normalized := regexp_replace(normalized, '^(www\.|m\.|mbasic\.|web\.|mobile\.)', '', 'i');
  normalized := regexp_replace(normalized, '^fb\.com/', 'facebook.com/', 'i');
  normalized := regexp_replace(normalized, '^facebook\.com/', '', 'i');
  normalized := regexp_replace(normalized, '#.*$', '');

  IF normalized ~ '^profile\.php\?' THEN
    profile_id := substring(normalized FROM '(?:^|[?&])id=([0-9]+)');
    IF profile_id IS NOT NULL THEN
      RETURN 'profile:' || profile_id;
    END IF;
  END IF;

  IF normalized ~ '^people/[^/]+/[0-9]+/?(?:[?#].*)?$' THEN
    profile_id := substring(normalized FROM '^people/[^/]+/([0-9]+)');
    IF profile_id IS NOT NULL THEN
      RETURN 'profile:' || profile_id;
    END IF;
  END IF;

  normalized := regexp_replace(normalized, '\?.*$', '');
  normalized := regexp_replace(normalized, '/+$', '');
  RETURN normalized;
END;
$$;

ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS canonical_link text;

UPDATE public.leads
SET canonical_link = public.canonical_facebook_link(facebook_link);

WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY canonical_link
           ORDER BY created_at ASC, id ASC
         ) AS duplicate_rank
  FROM public.leads
)
DELETE FROM public.leads AS leads
USING ranked
WHERE leads.id = ranked.id
  AND ranked.duplicate_rank > 1;

ALTER TABLE public.leads ALTER COLUMN canonical_link SET NOT NULL;

DROP INDEX IF EXISTS public.leads_facebook_link_global_unique;
DROP INDEX IF EXISTS public.leads_user_facebook_link_idx;
CREATE UNIQUE INDEX leads_canonical_link_global_unique
  ON public.leads (canonical_link);

CREATE OR REPLACE FUNCTION public.set_lead_canonical_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.facebook_link := btrim(NEW.facebook_link);
  NEW.canonical_link := public.canonical_facebook_link(NEW.facebook_link);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS leads_set_canonical_link ON public.leads;
CREATE TRIGGER leads_set_canonical_link
BEFORE INSERT OR UPDATE OF facebook_link, canonical_link ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.set_lead_canonical_link();

REVOKE EXECUTE ON FUNCTION public.canonical_facebook_link(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.canonical_facebook_link(text) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.set_lead_canonical_link() FROM PUBLIC, anon, authenticated;