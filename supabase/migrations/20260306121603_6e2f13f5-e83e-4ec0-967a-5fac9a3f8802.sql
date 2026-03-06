-- Fix all foreign keys referencing tenants that use NO ACTION → CASCADE ON DELETE

-- rms_connections
ALTER TABLE public.rms_connections DROP CONSTRAINT rms_connections_tenant_id_fkey;
ALTER TABLE public.rms_connections ADD CONSTRAINT rms_connections_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

-- flow_maps
ALTER TABLE public.flow_maps DROP CONSTRAINT flow_maps_tenant_id_fkey;
ALTER TABLE public.flow_maps ADD CONSTRAINT flow_maps_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

-- financial_transactions
ALTER TABLE public.financial_transactions DROP CONSTRAINT financial_transactions_tenant_id_fkey;
ALTER TABLE public.financial_transactions ADD CONSTRAINT financial_transactions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

-- flow_map_ctos
ALTER TABLE public.flow_map_ctos DROP CONSTRAINT flow_map_ctos_tenant_id_fkey;
ALTER TABLE public.flow_map_ctos ADD CONSTRAINT flow_map_ctos_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

-- flow_map_cables
ALTER TABLE public.flow_map_cables DROP CONSTRAINT flow_map_cables_tenant_id_fkey;
ALTER TABLE public.flow_map_cables ADD CONSTRAINT flow_map_cables_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

-- flow_map_reservas
ALTER TABLE public.flow_map_reservas DROP CONSTRAINT flow_map_reservas_tenant_id_fkey;
ALTER TABLE public.flow_map_reservas ADD CONSTRAINT flow_map_reservas_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

-- webhook_tokens
ALTER TABLE public.webhook_tokens DROP CONSTRAINT webhook_tokens_tenant_id_fkey;
ALTER TABLE public.webhook_tokens ADD CONSTRAINT webhook_tokens_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

-- flow_audit_logs
ALTER TABLE public.flow_audit_logs DROP CONSTRAINT flow_audit_logs_tenant_id_fkey;
ALTER TABLE public.flow_audit_logs ADD CONSTRAINT flow_audit_logs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

-- flow_map_effective_cache
ALTER TABLE public.flow_map_effective_cache DROP CONSTRAINT flow_map_effective_cache_tenant_id_fkey;
ALTER TABLE public.flow_map_effective_cache ADD CONSTRAINT flow_map_effective_cache_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

-- printer_configs
ALTER TABLE public.printer_configs DROP CONSTRAINT printer_configs_tenant_id_fkey;
ALTER TABLE public.printer_configs ADD CONSTRAINT printer_configs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

-- billing_logs
ALTER TABLE public.billing_logs DROP CONSTRAINT billing_logs_tenant_id_fkey;
ALTER TABLE public.billing_logs ADD CONSTRAINT billing_logs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

-- system_status_snapshots
ALTER TABLE public.system_status_snapshots DROP CONSTRAINT system_status_snapshots_tenant_id_fkey;
ALTER TABLE public.system_status_snapshots ADD CONSTRAINT system_status_snapshots_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;