CREATE OR REPLACE FUNCTION public.collected_leads()
RETURNS TABLE (facebook_link text, canonical_link text, created_at timestamptz, mine boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT l.facebook_link, l.canonical_link, l.created_at, (l.user_id = auth.uid()) AS mine
  FROM public.leads l
  WHERE auth.uid() IS NOT NULL
    AND l.deleted_at IS NULL
$$;

REVOKE ALL ON FUNCTION public.collected_leads() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.collected_leads() TO authenticated;