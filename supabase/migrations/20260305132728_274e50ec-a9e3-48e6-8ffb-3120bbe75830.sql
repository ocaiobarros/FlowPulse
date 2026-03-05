-- Consolidated fix: ensure team-based grants expose map + all flow_map child entities

-- 1) Keep access function robust for team grants
CREATE OR REPLACE FUNCTION public.has_resource_access(p_user_id uuid, p_tenant_id uuid, p_resource_type text, p_resource_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $$
  SELECT
    public.has_role(p_user_id, p_tenant_id, 'admin'::app_role)
    OR public.is_super_admin(p_user_id)
    OR EXISTS (
      SELECT 1
      FROM public.resource_access ra
      WHERE ra.tenant_id = p_tenant_id
        AND ra.resource_type = p_resource_type
        AND ra.resource_id = p_resource_id
        AND ra.grantee_type = 'user'
        AND ra.grantee_id = p_user_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.resource_access ra
      JOIN public.teams t
        ON t.id = ra.grantee_id
       AND t.tenant_id = ra.tenant_id
      JOIN public.team_members tm
        ON tm.team_id = t.id
       AND tm.user_id = p_user_id
      WHERE ra.tenant_id = p_tenant_id
        AND ra.resource_type = p_resource_type
        AND ra.resource_id = p_resource_id
        AND ra.grantee_type = 'team'
    );
$$;

-- 2) Parent resources: allow explicit grant path even when jwt tenant differs
DROP POLICY IF EXISTS fm_select ON public.flow_maps;
CREATE POLICY fm_select ON public.flow_maps
  FOR SELECT TO authenticated
  USING (
    is_super_admin(auth.uid())
    OR (
      (tenant_id = jwt_tenant_id())
      AND (
        has_role(auth.uid(), tenant_id, 'admin'::app_role)
        OR (created_by = auth.uid())
        OR has_resource_access(auth.uid(), tenant_id, 'flow_map'::text, id)
      )
    )
    OR has_resource_access(auth.uid(), tenant_id, 'flow_map'::text, id)
  );

DROP POLICY IF EXISTS dashboards_select ON public.dashboards;
CREATE POLICY dashboards_select ON public.dashboards
  FOR SELECT TO authenticated
  USING (
    is_super_admin(auth.uid())
    OR (
      (tenant_id = jwt_tenant_id())
      AND (
        has_role(auth.uid(), tenant_id, 'admin'::app_role)
        OR (created_by = auth.uid())
        OR has_resource_access(auth.uid(), tenant_id, 'dashboard'::text, id)
      )
    )
    OR has_resource_access(auth.uid(), tenant_id, 'dashboard'::text, id)
  );

-- 3) Child tables: if user can access the map, user can read map internals
DROP POLICY IF EXISTS fmh_select ON public.flow_map_hosts;
CREATE POLICY fmh_select ON public.flow_map_hosts
  FOR SELECT TO authenticated
  USING (
    is_super_admin(auth.uid())
    OR (tenant_id = jwt_tenant_id())
    OR has_resource_access(auth.uid(), tenant_id, 'flow_map'::text, map_id)
  );

DROP POLICY IF EXISTS fml_select ON public.flow_map_links;
CREATE POLICY fml_select ON public.flow_map_links
  FOR SELECT TO authenticated
  USING (
    is_super_admin(auth.uid())
    OR (tenant_id = jwt_tenant_id())
    OR has_resource_access(auth.uid(), tenant_id, 'flow_map'::text, map_id)
  );

DROP POLICY IF EXISTS cto_select ON public.flow_map_ctos;
CREATE POLICY cto_select ON public.flow_map_ctos
  FOR SELECT TO authenticated
  USING (
    is_super_admin(auth.uid())
    OR (tenant_id = jwt_tenant_id())
    OR has_resource_access(auth.uid(), tenant_id, 'flow_map'::text, map_id)
  );

DROP POLICY IF EXISTS cable_select ON public.flow_map_cables;
CREATE POLICY cable_select ON public.flow_map_cables
  FOR SELECT TO authenticated
  USING (
    is_super_admin(auth.uid())
    OR (tenant_id = jwt_tenant_id())
    OR has_resource_access(auth.uid(), tenant_id, 'flow_map'::text, map_id)
  );

DROP POLICY IF EXISTS reservas_select ON public.flow_map_reservas;
CREATE POLICY reservas_select ON public.flow_map_reservas
  FOR SELECT TO authenticated
  USING (
    is_super_admin(auth.uid())
    OR (tenant_id = jwt_tenant_id())
    OR has_resource_access(auth.uid(), tenant_id, 'flow_map'::text, map_id)
  );

DROP POLICY IF EXISTS cache_select ON public.flow_map_effective_cache;
CREATE POLICY cache_select ON public.flow_map_effective_cache
  FOR SELECT TO authenticated
  USING (
    is_super_admin(auth.uid())
    OR (tenant_id = jwt_tenant_id())
    OR has_resource_access(auth.uid(), tenant_id, 'flow_map'::text, map_id)
  );

DROP POLICY IF EXISTS fmli_select ON public.flow_map_link_items;
CREATE POLICY fmli_select ON public.flow_map_link_items
  FOR SELECT TO authenticated
  USING (
    is_super_admin(auth.uid())
    OR (tenant_id = jwt_tenant_id())
    OR EXISTS (
      SELECT 1
      FROM public.flow_map_links l
      WHERE l.id = link_id
        AND l.tenant_id = tenant_id
        AND has_resource_access(auth.uid(), l.tenant_id, 'flow_map'::text, l.map_id)
    )
  );

DROP POLICY IF EXISTS fmle_select ON public.flow_map_link_events;
CREATE POLICY fmle_select ON public.flow_map_link_events
  FOR SELECT TO authenticated
  USING (
    is_super_admin(auth.uid())
    OR (tenant_id = jwt_tenant_id())
    OR EXISTS (
      SELECT 1
      FROM public.flow_map_links l
      WHERE l.id = link_id
        AND l.tenant_id = tenant_id
        AND has_resource_access(auth.uid(), l.tenant_id, 'flow_map'::text, l.map_id)
    )
  );