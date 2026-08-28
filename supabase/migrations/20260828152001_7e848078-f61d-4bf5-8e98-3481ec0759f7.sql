ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS leads_user_archived_idx ON public.leads (user_id, archived);