ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS verified BOOLEAN NOT NULL DEFAULT false;

-- Prevent the same Facebook link from being saved twice for the same user.
CREATE UNIQUE INDEX IF NOT EXISTS leads_user_facebook_link_idx ON public.leads (user_id, facebook_link);

-- Prevent the same phone number from being saved twice for the same user (only when phone is provided).
CREATE UNIQUE INDEX IF NOT EXISTS leads_user_phone_idx ON public.leads (user_id, phone) WHERE phone IS NOT NULL;