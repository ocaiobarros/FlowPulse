
-- Enable pgcrypto
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;

-- Webhook tokens table for rotatable authentication
CREATE TABLE IF NOT EXISTS public.webhook_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  label TEXT NOT NULL DEFAULT 'default',
  token_hash TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  created_by UUID,
  UNIQUE(tenant_id, label)
);

ALTER TABLE public.webhook_tokens ENABLE ROW LEVEL SECURITY;

-- Drop policies if they exist from partial previous run
DROP POLICY IF EXISTS "wt_select" ON public.webhook_tokens;
DROP POLICY IF EXISTS "wt_manage" ON public.webhook_tokens;

CREATE POLICY "wt_select" ON public.webhook_tokens FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "wt_manage" ON public.webhook_tokens FOR ALL
  USING (
    (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), tenant_id, 'admin'::app_role))
    OR is_super_admin(auth.uid())
  )
  WITH CHECK (
    (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), tenant_id, 'admin'::app_role))
    OR is_super_admin(auth.uid())
  );

-- Verify token function using pgcrypto
CREATE OR REPLACE FUNCTION public.verify_webhook_token(p_token TEXT)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public', 'extensions', 'pg_temp'
AS $$
  SELECT tenant_id FROM public.webhook_tokens
  WHERE token_hash = encode(extensions.digest(p_token::bytea, 'sha256'), 'hex')
    AND is_active = true
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.verify_webhook_token(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_webhook_token(TEXT) TO service_role;
