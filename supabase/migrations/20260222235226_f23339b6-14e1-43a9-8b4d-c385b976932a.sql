
-- ============================================================
-- MIGRATION: JWT-Based RLS + Index Cleanup
-- Estratégia: jwt_tenant_id() com fallback seguro
-- ============================================================

-- ─── 1. Função jwt_tenant_id() com fallback ───
CREATE OR REPLACE FUNCTION public.jwt_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = 'public', 'pg_temp'
AS $$
  SELECT COALESCE(
    NULLIF(auth.jwt() -> 'app_metadata' ->> 'tenant_id', '')::uuid,
    public.get_user_tenant_id(auth.uid())
  )
$$;

-- ─── 2. Atualizar handle_new_user para injetar tenant_id no JWT ───
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
DECLARE
  new_tenant_id UUID;
  user_slug TEXT;
  user_name TEXT;
BEGIN
  user_name := COALESCE(
    NEW.raw_user_meta_data->>'display_name',
    NEW.raw_user_meta_data->>'full_name',
    split_part(NEW.email, '@', 1)
  );
  user_slug := lower(regexp_replace(user_name, '[^a-zA-Z0-9]+', '-', 'g'));

  INSERT INTO public.tenants (name, slug)
  VALUES (user_name || '''s Org', user_slug || '-' || substr(NEW.id::text, 1, 8))
  RETURNING id INTO new_tenant_id;

  INSERT INTO public.profiles (id, tenant_id, display_name, email)
  VALUES (NEW.id, new_tenant_id, user_name, NEW.email);

  INSERT INTO public.user_roles (user_id, tenant_id, role)
  VALUES (NEW.id, new_tenant_id, 'admin');

  -- Injetar tenant_id no app_metadata do JWT
  UPDATE auth.users
  SET raw_app_meta_data = jsonb_set(
    COALESCE(raw_app_meta_data, '{}'::jsonb),
    '{tenant_id}',
    to_jsonb(new_tenant_id::text)
  )
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

-- ─── 3. RLS REWRITE: Todas as policies migradas para jwt_tenant_id() ───

-- === alert_events ===
DROP POLICY IF EXISTS "ae_select" ON public.alert_events;
CREATE POLICY "ae_select" ON public.alert_events FOR SELECT
USING (tenant_id = public.jwt_tenant_id());

-- === alert_instances ===
DROP POLICY IF EXISTS "ai_select" ON public.alert_instances;
CREATE POLICY "ai_select" ON public.alert_instances FOR SELECT
USING (tenant_id = public.jwt_tenant_id());

DROP POLICY IF EXISTS "ai_update_ack_resolve" ON public.alert_instances;
CREATE POLICY "ai_update_ack_resolve" ON public.alert_instances FOR UPDATE
USING (
  tenant_id = public.jwt_tenant_id()
  AND (has_role(auth.uid(), tenant_id, 'admin') OR has_role(auth.uid(), tenant_id, 'editor'))
)
WITH CHECK (tenant_id = public.jwt_tenant_id());

-- === alert_notifications ===
DROP POLICY IF EXISTS "an_select" ON public.alert_notifications;
CREATE POLICY "an_select" ON public.alert_notifications FOR SELECT
USING (tenant_id = public.jwt_tenant_id());

-- === alert_rules ===
DROP POLICY IF EXISTS "ar_select" ON public.alert_rules;
CREATE POLICY "ar_select" ON public.alert_rules FOR SELECT
USING (tenant_id = public.jwt_tenant_id());

DROP POLICY IF EXISTS "ar_manage" ON public.alert_rules;
CREATE POLICY "ar_manage" ON public.alert_rules FOR ALL
USING (
  tenant_id = public.jwt_tenant_id()
  AND (has_role(auth.uid(), tenant_id, 'admin') OR has_role(auth.uid(), tenant_id, 'editor'))
)
WITH CHECK (
  tenant_id = public.jwt_tenant_id()
  AND (has_role(auth.uid(), tenant_id, 'admin') OR has_role(auth.uid(), tenant_id, 'editor'))
);

-- === audit_logs ===
DROP POLICY IF EXISTS "audit_logs_select" ON public.audit_logs;
CREATE POLICY "audit_logs_select" ON public.audit_logs FOR SELECT
USING (tenant_id = public.jwt_tenant_id());

-- === dashboards ===
DROP POLICY IF EXISTS "dashboards_select" ON public.dashboards;
CREATE POLICY "dashboards_select" ON public.dashboards FOR SELECT
USING (tenant_id = public.jwt_tenant_id() OR is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "dashboards_insert" ON public.dashboards;
CREATE POLICY "dashboards_insert" ON public.dashboards FOR INSERT
WITH CHECK (
  (tenant_id = public.jwt_tenant_id() AND (has_role(auth.uid(), tenant_id, 'admin') OR has_role(auth.uid(), tenant_id, 'editor')))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "dashboards_update" ON public.dashboards;
CREATE POLICY "dashboards_update" ON public.dashboards FOR UPDATE
USING (
  (tenant_id = public.jwt_tenant_id() AND (has_role(auth.uid(), tenant_id, 'admin') OR has_role(auth.uid(), tenant_id, 'editor')))
  OR is_super_admin(auth.uid())
)
WITH CHECK (tenant_id = public.jwt_tenant_id() OR is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "dashboards_delete" ON public.dashboards;
CREATE POLICY "dashboards_delete" ON public.dashboards FOR DELETE
USING (
  (tenant_id = public.jwt_tenant_id() AND has_role(auth.uid(), tenant_id, 'admin'))
  OR is_super_admin(auth.uid())
);

-- === escalation_policies ===
DROP POLICY IF EXISTS "ep_select" ON public.escalation_policies;
CREATE POLICY "ep_select" ON public.escalation_policies FOR SELECT
USING (tenant_id = public.jwt_tenant_id());

-- === escalation_steps ===
DROP POLICY IF EXISTS "es_select" ON public.escalation_steps;
CREATE POLICY "es_select" ON public.escalation_steps FOR SELECT
USING (tenant_id = public.jwt_tenant_id());

-- === flow_audit_logs ===
DROP POLICY IF EXISTS "audit_select_admin" ON public.flow_audit_logs;
CREATE POLICY "audit_select_admin" ON public.flow_audit_logs FOR SELECT
USING (
  (tenant_id = public.jwt_tenant_id() AND has_role(auth.uid(), tenant_id, 'admin'))
  OR is_super_admin(auth.uid())
);

-- === flow_map_cables ===
DROP POLICY IF EXISTS "cable_select" ON public.flow_map_cables;
CREATE POLICY "cable_select" ON public.flow_map_cables FOR SELECT
USING (tenant_id = public.jwt_tenant_id() OR is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "cable_manage" ON public.flow_map_cables;
CREATE POLICY "cable_manage" ON public.flow_map_cables FOR ALL
USING (
  (tenant_id = public.jwt_tenant_id() AND (has_role(auth.uid(), tenant_id, 'admin') OR has_role(auth.uid(), tenant_id, 'editor')))
  OR is_super_admin(auth.uid())
)
WITH CHECK (
  (tenant_id = public.jwt_tenant_id() AND (has_role(auth.uid(), tenant_id, 'admin') OR has_role(auth.uid(), tenant_id, 'editor')))
  OR is_super_admin(auth.uid())
);

-- === flow_map_ctos ===
DROP POLICY IF EXISTS "cto_select" ON public.flow_map_ctos;
CREATE POLICY "cto_select" ON public.flow_map_ctos FOR SELECT
USING (tenant_id = public.jwt_tenant_id() OR is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "cto_manage" ON public.flow_map_ctos;
CREATE POLICY "cto_manage" ON public.flow_map_ctos FOR ALL
USING (
  (tenant_id = public.jwt_tenant_id() AND (has_role(auth.uid(), tenant_id, 'admin') OR has_role(auth.uid(), tenant_id, 'editor')))
  OR is_super_admin(auth.uid())
)
WITH CHECK (
  (tenant_id = public.jwt_tenant_id() AND (has_role(auth.uid(), tenant_id, 'admin') OR has_role(auth.uid(), tenant_id, 'editor')))
  OR is_super_admin(auth.uid())
);

-- === flow_map_hosts ===
DROP POLICY IF EXISTS "fmh_select" ON public.flow_map_hosts;
CREATE POLICY "fmh_select" ON public.flow_map_hosts FOR SELECT
USING (tenant_id = public.jwt_tenant_id() OR is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "fmh_manage" ON public.flow_map_hosts;
CREATE POLICY "fmh_manage" ON public.flow_map_hosts FOR ALL
USING (
  (tenant_id = public.jwt_tenant_id() AND (has_role(auth.uid(), tenant_id, 'admin') OR has_role(auth.uid(), tenant_id, 'editor')))
  OR is_super_admin(auth.uid())
)
WITH CHECK (
  (tenant_id = public.jwt_tenant_id() AND (has_role(auth.uid(), tenant_id, 'admin') OR has_role(auth.uid(), tenant_id, 'editor')))
  OR is_super_admin(auth.uid())
);

-- === flow_map_link_events ===
DROP POLICY IF EXISTS "fmle_select" ON public.flow_map_link_events;
CREATE POLICY "fmle_select" ON public.flow_map_link_events FOR SELECT
USING (tenant_id = public.jwt_tenant_id() OR is_super_admin(auth.uid()));

-- === flow_map_link_items ===
DROP POLICY IF EXISTS "fmli_select" ON public.flow_map_link_items;
CREATE POLICY "fmli_select" ON public.flow_map_link_items FOR SELECT
USING (tenant_id = public.jwt_tenant_id() OR is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "fmli_manage" ON public.flow_map_link_items;
CREATE POLICY "fmli_manage" ON public.flow_map_link_items FOR ALL
USING (
  (tenant_id = public.jwt_tenant_id() AND (has_role(auth.uid(), tenant_id, 'admin') OR has_role(auth.uid(), tenant_id, 'editor')))
  OR is_super_admin(auth.uid())
)
WITH CHECK (
  (tenant_id = public.jwt_tenant_id() AND (has_role(auth.uid(), tenant_id, 'admin') OR has_role(auth.uid(), tenant_id, 'editor')))
  OR is_super_admin(auth.uid())
);

-- === flow_map_links ===
DROP POLICY IF EXISTS "fml_select" ON public.flow_map_links;
CREATE POLICY "fml_select" ON public.flow_map_links FOR SELECT
USING (tenant_id = public.jwt_tenant_id() OR is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "fml_manage" ON public.flow_map_links;
CREATE POLICY "fml_manage" ON public.flow_map_links FOR ALL
USING (
  (tenant_id = public.jwt_tenant_id() AND (has_role(auth.uid(), tenant_id, 'admin') OR has_role(auth.uid(), tenant_id, 'editor')))
  OR is_super_admin(auth.uid())
)
WITH CHECK (
  (tenant_id = public.jwt_tenant_id() AND (has_role(auth.uid(), tenant_id, 'admin') OR has_role(auth.uid(), tenant_id, 'editor')))
  OR is_super_admin(auth.uid())
);

-- === flow_map_reservas ===
DROP POLICY IF EXISTS "Tenant members can view reservas" ON public.flow_map_reservas;
CREATE POLICY "reservas_select" ON public.flow_map_reservas FOR SELECT
USING (tenant_id = public.jwt_tenant_id());

DROP POLICY IF EXISTS "Admins and editors can insert reservas" ON public.flow_map_reservas;
CREATE POLICY "reservas_insert" ON public.flow_map_reservas FOR INSERT
WITH CHECK (
  tenant_id = public.jwt_tenant_id()
  AND (has_role(auth.uid(), tenant_id, 'admin') OR has_role(auth.uid(), tenant_id, 'editor'))
);

DROP POLICY IF EXISTS "Admins and editors can update reservas" ON public.flow_map_reservas;
CREATE POLICY "reservas_update" ON public.flow_map_reservas FOR UPDATE
USING (
  tenant_id = public.jwt_tenant_id()
  AND (has_role(auth.uid(), tenant_id, 'admin') OR has_role(auth.uid(), tenant_id, 'editor'))
);

DROP POLICY IF EXISTS "Admins and editors can delete reservas" ON public.flow_map_reservas;
CREATE POLICY "reservas_delete" ON public.flow_map_reservas FOR DELETE
USING (
  tenant_id = public.jwt_tenant_id()
  AND (has_role(auth.uid(), tenant_id, 'admin') OR has_role(auth.uid(), tenant_id, 'editor'))
);

-- === flow_maps ===
DROP POLICY IF EXISTS "fm_select" ON public.flow_maps;
CREATE POLICY "fm_select" ON public.flow_maps FOR SELECT
USING (tenant_id = public.jwt_tenant_id() OR is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "fm_insert" ON public.flow_maps;
CREATE POLICY "fm_insert" ON public.flow_maps FOR INSERT
WITH CHECK (
  (tenant_id = public.jwt_tenant_id() AND (has_role(auth.uid(), tenant_id, 'admin') OR has_role(auth.uid(), tenant_id, 'editor')))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "fm_update" ON public.flow_maps;
CREATE POLICY "fm_update" ON public.flow_maps FOR UPDATE
USING (
  (tenant_id = public.jwt_tenant_id() AND (has_role(auth.uid(), tenant_id, 'admin') OR has_role(auth.uid(), tenant_id, 'editor')))
  OR is_super_admin(auth.uid())
)
WITH CHECK (tenant_id = public.jwt_tenant_id() OR is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "fm_delete" ON public.flow_maps;
CREATE POLICY "fm_delete" ON public.flow_maps FOR DELETE
USING (
  (tenant_id = public.jwt_tenant_id() AND has_role(auth.uid(), tenant_id, 'admin'))
  OR is_super_admin(auth.uid())
);

-- === maintenance_scopes ===
DROP POLICY IF EXISTS "ms_select" ON public.maintenance_scopes;
CREATE POLICY "ms_select" ON public.maintenance_scopes FOR SELECT
USING (tenant_id = public.jwt_tenant_id());

DROP POLICY IF EXISTS "ms_manage" ON public.maintenance_scopes;
CREATE POLICY "ms_manage" ON public.maintenance_scopes FOR ALL
USING (
  tenant_id = public.jwt_tenant_id()
  AND (has_role(auth.uid(), tenant_id, 'admin') OR has_role(auth.uid(), tenant_id, 'editor'))
)
WITH CHECK (
  tenant_id = public.jwt_tenant_id()
  AND (has_role(auth.uid(), tenant_id, 'admin') OR has_role(auth.uid(), tenant_id, 'editor'))
);

-- === maintenance_windows ===
DROP POLICY IF EXISTS "mw_select" ON public.maintenance_windows;
CREATE POLICY "mw_select" ON public.maintenance_windows FOR SELECT
USING (tenant_id = public.jwt_tenant_id());

DROP POLICY IF EXISTS "mw_manage" ON public.maintenance_windows;
CREATE POLICY "mw_manage" ON public.maintenance_windows FOR ALL
USING (
  tenant_id = public.jwt_tenant_id()
  AND (has_role(auth.uid(), tenant_id, 'admin') OR has_role(auth.uid(), tenant_id, 'editor'))
)
WITH CHECK (
  tenant_id = public.jwt_tenant_id()
  AND (has_role(auth.uid(), tenant_id, 'admin') OR has_role(auth.uid(), tenant_id, 'editor'))
);

-- === notification_channels ===
DROP POLICY IF EXISTS "nc_select" ON public.notification_channels;
CREATE POLICY "nc_select" ON public.notification_channels FOR SELECT
USING (tenant_id = public.jwt_tenant_id());

-- === profiles ===
DROP POLICY IF EXISTS "profiles_select_tenant" ON public.profiles;
CREATE POLICY "profiles_select_tenant" ON public.profiles FOR SELECT
USING (tenant_id = public.jwt_tenant_id() OR is_super_admin(auth.uid()));

-- profiles_self_select, profiles_insert, profiles_update, profiles_update_super remain unchanged (they use auth.uid())

-- === rms_connections ===
DROP POLICY IF EXISTS "rms_select" ON public.rms_connections;
CREATE POLICY "rms_select" ON public.rms_connections FOR SELECT
USING (tenant_id = public.jwt_tenant_id() OR is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "rms_insert" ON public.rms_connections;
CREATE POLICY "rms_insert" ON public.rms_connections FOR INSERT
WITH CHECK (
  (tenant_id = public.jwt_tenant_id() AND has_role(auth.uid(), tenant_id, 'admin'))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "rms_update" ON public.rms_connections;
CREATE POLICY "rms_update" ON public.rms_connections FOR UPDATE
USING (
  (tenant_id = public.jwt_tenant_id() AND has_role(auth.uid(), tenant_id, 'admin'))
  OR is_super_admin(auth.uid())
)
WITH CHECK (
  (tenant_id = public.jwt_tenant_id() AND has_role(auth.uid(), tenant_id, 'admin'))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "rms_delete" ON public.rms_connections;
CREATE POLICY "rms_delete" ON public.rms_connections FOR DELETE
USING (
  (tenant_id = public.jwt_tenant_id() AND has_role(auth.uid(), tenant_id, 'admin'))
  OR is_super_admin(auth.uid())
);

-- === sla_policies ===
DROP POLICY IF EXISTS "sla_select" ON public.sla_policies;
CREATE POLICY "sla_select" ON public.sla_policies FOR SELECT
USING (tenant_id = public.jwt_tenant_id());

-- === telemetry_config ===
DROP POLICY IF EXISTS "tc_select" ON public.telemetry_config;
CREATE POLICY "tc_select" ON public.telemetry_config FOR SELECT
USING (
  (tenant_id = public.jwt_tenant_id() AND has_role(auth.uid(), tenant_id, 'admin'))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "tc_manage" ON public.telemetry_config;
CREATE POLICY "tc_manage" ON public.telemetry_config FOR ALL
USING (
  (tenant_id = public.jwt_tenant_id() AND has_role(auth.uid(), tenant_id, 'admin'))
  OR is_super_admin(auth.uid())
)
WITH CHECK (
  (tenant_id = public.jwt_tenant_id() AND has_role(auth.uid(), tenant_id, 'admin'))
  OR is_super_admin(auth.uid())
);

-- === telemetry_heartbeat ===
DROP POLICY IF EXISTS "th_select" ON public.telemetry_heartbeat;
CREATE POLICY "th_select" ON public.telemetry_heartbeat FOR SELECT
USING (tenant_id = public.jwt_tenant_id() OR is_super_admin(auth.uid()));

-- === tenants ===
DROP POLICY IF EXISTS "tenants_select" ON public.tenants;
CREATE POLICY "tenants_select" ON public.tenants FOR SELECT
USING (id = public.jwt_tenant_id() OR is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "tenants_update" ON public.tenants;
CREATE POLICY "tenants_update" ON public.tenants FOR UPDATE
USING (
  (id = public.jwt_tenant_id() AND has_role(auth.uid(), id, 'admin'))
  OR is_super_admin(auth.uid())
)
WITH CHECK (
  (id = public.jwt_tenant_id() AND has_role(auth.uid(), id, 'admin'))
  OR is_super_admin(auth.uid())
);

-- tenants_insert_super and tenants_delete_super remain unchanged (super_admin only)

-- === user_roles ===
DROP POLICY IF EXISTS "user_roles_select" ON public.user_roles;
CREATE POLICY "user_roles_select" ON public.user_roles FOR SELECT
USING (tenant_id = public.jwt_tenant_id() OR is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "user_roles_insert" ON public.user_roles;
CREATE POLICY "user_roles_insert" ON public.user_roles FOR INSERT
WITH CHECK (
  (tenant_id = public.jwt_tenant_id() AND has_role(auth.uid(), tenant_id, 'admin'))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "user_roles_update" ON public.user_roles;
CREATE POLICY "user_roles_update" ON public.user_roles FOR UPDATE
USING (
  (tenant_id = public.jwt_tenant_id() AND has_role(auth.uid(), tenant_id, 'admin'))
  OR is_super_admin(auth.uid())
)
WITH CHECK (
  (tenant_id = public.jwt_tenant_id() AND has_role(auth.uid(), tenant_id, 'admin'))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "user_roles_delete" ON public.user_roles;
CREATE POLICY "user_roles_delete" ON public.user_roles FOR DELETE
USING (
  (tenant_id = public.jwt_tenant_id() AND has_role(auth.uid(), tenant_id, 'admin'))
  OR is_super_admin(auth.uid())
);

-- === webhook_tokens ===
DROP POLICY IF EXISTS "wt_select" ON public.webhook_tokens;
CREATE POLICY "wt_select" ON public.webhook_tokens FOR SELECT
USING (tenant_id = public.jwt_tenant_id());

DROP POLICY IF EXISTS "wt_manage" ON public.webhook_tokens;
CREATE POLICY "wt_manage" ON public.webhook_tokens FOR ALL
USING (
  (tenant_id = public.jwt_tenant_id() AND has_role(auth.uid(), tenant_id, 'admin'))
  OR is_super_admin(auth.uid())
)
WITH CHECK (
  (tenant_id = public.jwt_tenant_id() AND has_role(auth.uid(), tenant_id, 'admin'))
  OR is_super_admin(auth.uid())
);

-- === widgets (subquery pattern — update dashboards reference) ===
DROP POLICY IF EXISTS "widgets_select" ON public.widgets;
CREATE POLICY "widgets_select" ON public.widgets FOR SELECT
USING (EXISTS (
  SELECT 1 FROM dashboards d
  WHERE d.id = widgets.dashboard_id AND d.tenant_id = public.jwt_tenant_id()
));

DROP POLICY IF EXISTS "widgets_insert" ON public.widgets;
CREATE POLICY "widgets_insert" ON public.widgets FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM dashboards d WHERE d.id = widgets.dashboard_id AND d.tenant_id = public.jwt_tenant_id())
  AND (has_role(auth.uid(), public.jwt_tenant_id(), 'admin') OR has_role(auth.uid(), public.jwt_tenant_id(), 'editor'))
);

DROP POLICY IF EXISTS "widgets_update" ON public.widgets;
CREATE POLICY "widgets_update" ON public.widgets FOR UPDATE
USING (
  EXISTS (SELECT 1 FROM dashboards d WHERE d.id = widgets.dashboard_id AND d.tenant_id = public.jwt_tenant_id())
  AND (has_role(auth.uid(), public.jwt_tenant_id(), 'admin') OR has_role(auth.uid(), public.jwt_tenant_id(), 'editor'))
)
WITH CHECK (
  EXISTS (SELECT 1 FROM dashboards d WHERE d.id = widgets.dashboard_id AND d.tenant_id = public.jwt_tenant_id())
);

DROP POLICY IF EXISTS "widgets_delete" ON public.widgets;
CREATE POLICY "widgets_delete" ON public.widgets FOR DELETE
USING (
  EXISTS (SELECT 1 FROM dashboards d WHERE d.id = widgets.dashboard_id AND d.tenant_id = public.jwt_tenant_id())
  AND (has_role(auth.uid(), public.jwt_tenant_id(), 'admin') OR has_role(auth.uid(), public.jwt_tenant_id(), 'editor'))
);

-- === zabbix_connections ===
DROP POLICY IF EXISTS "zabbix_select" ON public.zabbix_connections;
CREATE POLICY "zabbix_select" ON public.zabbix_connections FOR SELECT
USING (tenant_id = public.jwt_tenant_id() OR is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "zabbix_insert" ON public.zabbix_connections;
CREATE POLICY "zabbix_insert" ON public.zabbix_connections FOR INSERT
WITH CHECK (
  (tenant_id = public.jwt_tenant_id() AND has_role(auth.uid(), tenant_id, 'admin'))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "zabbix_update" ON public.zabbix_connections;
CREATE POLICY "zabbix_update" ON public.zabbix_connections FOR UPDATE
USING (
  (tenant_id = public.jwt_tenant_id() AND has_role(auth.uid(), tenant_id, 'admin'))
  OR is_super_admin(auth.uid())
)
WITH CHECK (
  (tenant_id = public.jwt_tenant_id() AND has_role(auth.uid(), tenant_id, 'admin'))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "zabbix_delete" ON public.zabbix_connections;
CREATE POLICY "zabbix_delete" ON public.zabbix_connections FOR DELETE
USING (
  (tenant_id = public.jwt_tenant_id() AND has_role(auth.uid(), tenant_id, 'admin'))
  OR is_super_admin(auth.uid())
);

-- ─── 4. Limpeza de índices redundantes ───

-- idx_alert_instances_dedupe é coberto por alert_instances_tenant_id_dedupe_key_key
DROP INDEX IF EXISTS idx_alert_instances_dedupe;

-- idx_user_roles_user_tenant é prefixo de idx_user_roles_lookup
DROP INDEX IF EXISTS idx_user_roles_user_tenant;

-- idx_unique_link_pair_normalized é substituído por unique_link_per_map (com tenant_id)
DROP INDEX IF EXISTS idx_unique_link_pair_normalized;

-- idx_maint_windows_tenant_time é coberto parcialmente por idx_maintenance_active_lookup
DROP INDEX IF EXISTS idx_maint_windows_tenant_time;

-- idx_alert_instances_tenant_dedupe duplica alert_instances_tenant_id_dedupe_key_key
DROP INDEX IF EXISTS idx_alert_instances_tenant_dedupe;

-- idx_fmle_tenant_id é prefixo de idx_flow_map_link_events_open
DROP INDEX IF EXISTS idx_fmle_tenant_id;
