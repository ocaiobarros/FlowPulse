
-- Performance indexes for audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created ON public.audit_logs (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs (tenant_id, action);

-- GIN index for metadata search inside details jsonb
CREATE INDEX IF NOT EXISTS idx_audit_logs_details_gin ON public.audit_logs USING gin (details);
