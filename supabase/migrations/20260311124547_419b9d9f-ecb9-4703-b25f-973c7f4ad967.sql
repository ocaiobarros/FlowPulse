
-- Remediation: mark conflicting policies as dropped before re-creating
-- This fixes the CI/CD deploy failure where policies already exist on remote

-- tenant_billing policies
DROP POLICY IF EXISTS "tb_select" ON public.tenant_billing;
CREATE POLICY "tb_select" ON public.tenant_billing
  FOR SELECT TO authenticated
  USING (tenant_id = jwt_tenant_id() OR is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "tb_manage" ON public.tenant_billing;
CREATE POLICY "tb_manage" ON public.tenant_billing
  FOR ALL TO authenticated
  USING ((tenant_id = jwt_tenant_id() AND has_role(auth.uid(), tenant_id, 'admin'::app_role)) OR is_super_admin(auth.uid()))
  WITH CHECK ((tenant_id = jwt_tenant_id() AND has_role(auth.uid(), tenant_id, 'admin'::app_role)) OR is_super_admin(auth.uid()));
