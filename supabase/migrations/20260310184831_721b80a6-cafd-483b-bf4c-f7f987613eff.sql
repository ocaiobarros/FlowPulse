
-- Step 1: Add plan/limit columns to tenants
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'starter',
  ADD COLUMN IF NOT EXISTS max_users integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS max_teams integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS max_dashboards integer NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS max_integrations integer NOT NULL DEFAULT 3;

-- Step 2: Create tenant_billing table
CREATE TABLE IF NOT EXISTS public.tenant_billing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE UNIQUE,
  plan text NOT NULL DEFAULT 'starter',
  status text NOT NULL DEFAULT 'active',
  subscription_id text,
  renewal_date timestamptz,
  billing_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tenant_billing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tb_select" ON public.tenant_billing
  FOR SELECT TO authenticated
  USING (tenant_id = jwt_tenant_id() OR is_super_admin(auth.uid()));

CREATE POLICY "tb_manage" ON public.tenant_billing
  FOR ALL TO authenticated
  USING ((tenant_id = jwt_tenant_id() AND has_role(auth.uid(), tenant_id, 'admin'::app_role)) OR is_super_admin(auth.uid()))
  WITH CHECK ((tenant_id = jwt_tenant_id() AND has_role(auth.uid(), tenant_id, 'admin'::app_role)) OR is_super_admin(auth.uid()));

-- Step 3: Create tenant_sso table
CREATE TABLE IF NOT EXISTS public.tenant_sso (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'saml_generic',
  saml_metadata text,
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, provider)
);

ALTER TABLE public.tenant_sso ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sso_select" ON public.tenant_sso
  FOR SELECT TO authenticated
  USING (tenant_id = jwt_tenant_id() OR is_super_admin(auth.uid()));

CREATE POLICY "sso_manage" ON public.tenant_sso
  FOR ALL TO authenticated
  USING ((tenant_id = jwt_tenant_id() AND has_role(auth.uid(), tenant_id, 'admin'::app_role)) OR is_super_admin(auth.uid()))
  WITH CHECK ((tenant_id = jwt_tenant_id() AND has_role(auth.uid(), tenant_id, 'admin'::app_role)) OR is_super_admin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER set_tenant_billing_updated_at
  BEFORE UPDATE ON public.tenant_billing
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_tenant_sso_updated_at
  BEFORE UPDATE ON public.tenant_sso
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
