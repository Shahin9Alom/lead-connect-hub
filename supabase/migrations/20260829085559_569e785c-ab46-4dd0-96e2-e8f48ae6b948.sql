ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
CREATE INDEX IF NOT EXISTS leads_deleted_at_idx ON public.leads (deleted_at);