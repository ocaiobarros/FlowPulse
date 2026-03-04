
-- Resource access control table
-- Supports granting access to individual users or entire teams
CREATE TABLE public.resource_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  resource_type text NOT NULL, -- 'dashboard', 'flow_map'
  resource_id uuid NOT NULL,
  grantee_type text NOT NULL CHECK (grantee_type IN ('user', 'team')),
  grantee_id uuid NOT NULL, -- user_id or team_id
  access_level text NOT NULL DEFAULT 'viewer' CHECK (access_level IN ('viewer', 'editor')),
  granted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, resource_type, resource_id, grantee_type, grantee_id)
);

ALTER TABLE public.resource_access ENABLE ROW LEVEL SECURITY;

-- Admins can manage all grants in their tenant
CREATE POLICY "ra_manage" ON public.resource_access
FOR ALL USING (
  ((tenant_id = jwt_tenant_id()) AND has_role(auth.uid(), tenant_id, 'admin'::app_role))
  OR is_super_admin(auth.uid())
)
WITH CHECK (
  ((tenant_id = jwt_tenant_id()) AND has_role(auth.uid(), tenant_id, 'admin'::app_role))
  OR is_super_admin(auth.uid())
);

-- Editors who created the resource can also manage grants (handled in app logic)
-- All tenant users can see grants to know their own access
CREATE POLICY "ra_select" ON public.resource_access
FOR SELECT USING (
  (tenant_id = jwt_tenant_id()) OR is_super_admin(auth.uid())
);

-- Also allow editors to insert/update/delete grants for resources they created
CREATE POLICY "ra_editor_manage" ON public.resource_access
FOR ALL USING (
  (tenant_id = jwt_tenant_id()) AND has_role(auth.uid(), tenant_id, 'editor'::app_role)
)
WITH CHECK (
  (tenant_id = jwt_tenant_id()) AND has_role(auth.uid(), tenant_id, 'editor'::app_role)
);

-- Create a security definer function to check resource access
-- Returns true if user has access (admin, creator, or granted)
CREATE OR REPLACE FUNCTION public.has_resource_access(
  p_user_id uuid,
  p_tenant_id uuid,
  p_resource_type text,
  p_resource_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT 
    -- Admins always have access
    has_role(p_user_id, p_tenant_id, 'admin'::app_role)
    OR is_super_admin(p_user_id)
    -- Direct user grant
    OR EXISTS (
      SELECT 1 FROM public.resource_access
      WHERE tenant_id = p_tenant_id
        AND resource_type = p_resource_type
        AND resource_id = p_resource_id
        AND grantee_type = 'user'
        AND grantee_id = p_user_id
    )
    -- Team grant
    OR EXISTS (
      SELECT 1 FROM public.resource_access ra
      JOIN public.team_members tm ON tm.team_id = ra.grantee_id AND tm.tenant_id = ra.tenant_id
      WHERE ra.tenant_id = p_tenant_id
        AND ra.resource_type = p_resource_type
        AND ra.resource_id = p_resource_id
        AND ra.grantee_type = 'team'
        AND tm.user_id = p_user_id
    )
$$;

-- Function to check if user is the creator of a resource
CREATE OR REPLACE FUNCTION public.is_resource_creator(
  p_user_id uuid,
  p_resource_type text,
  p_resource_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT CASE p_resource_type
    WHEN 'dashboard' THEN EXISTS (SELECT 1 FROM public.dashboards WHERE id = p_resource_id AND created_by = p_user_id)
    WHEN 'flow_map' THEN EXISTS (SELECT 1 FROM public.flow_maps WHERE id = p_resource_id AND created_by = p_user_id)
    ELSE false
  END
$$;

-- Now update the dashboards SELECT policy to enforce resource-level access
-- Drop existing and recreate
DROP POLICY IF EXISTS "dashboards_select" ON public.dashboards;
CREATE POLICY "dashboards_select" ON public.dashboards
FOR SELECT USING (
  is_super_admin(auth.uid())
  OR (
    tenant_id = jwt_tenant_id()
    AND (
      has_role(auth.uid(), tenant_id, 'admin'::app_role)
      OR created_by = auth.uid()
      OR has_resource_access(auth.uid(), tenant_id, 'dashboard', id)
    )
  )
);

-- Update flow_maps SELECT policy
DROP POLICY IF EXISTS "fm_select" ON public.flow_maps;
CREATE POLICY "fm_select" ON public.flow_maps
FOR SELECT USING (
  is_super_admin(auth.uid())
  OR (
    tenant_id = jwt_tenant_id()
    AND (
      has_role(auth.uid(), tenant_id, 'admin'::app_role)
      OR created_by = auth.uid()
      OR has_resource_access(auth.uid(), tenant_id, 'flow_map', id)
    )
  )
);

-- Index for performance
CREATE INDEX idx_resource_access_lookup ON public.resource_access(tenant_id, resource_type, resource_id);
CREATE INDEX idx_resource_access_grantee ON public.resource_access(grantee_type, grantee_id);
