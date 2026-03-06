DROP POLICY IF EXISTS profiles_select_linked_members_admin ON public.profiles;

CREATE POLICY profiles_select_linked_members_admin
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.user_roles me
    WHERE me.user_id = auth.uid()
      AND me.tenant_id = public.jwt_tenant_id()
      AND me.role = 'admin'::public.app_role
  )
  AND EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = profiles.id
      AND ur.tenant_id = public.jwt_tenant_id()
  )
);