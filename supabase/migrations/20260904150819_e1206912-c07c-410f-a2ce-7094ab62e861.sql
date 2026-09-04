DROP INDEX IF EXISTS public.leads_facebook_link_global_unique;
CREATE UNIQUE INDEX leads_facebook_link_global_unique ON public.leads (lower(btrim(rtrim(btrim(facebook_link), '/'))));