-- Replace prevent_tenant_change to allow super_admin to move users
CREATE OR REPLACE FUNCTION public.prevent_tenant_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.tenant_id <> OLD.tenant_id THEN
    -- Allow super admins to move users between tenants
    IF public.is_super_admin(auth.uid()) THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'tenant_id is immutable';
  END IF;
  RETURN NEW;
END;
$function$;

-- Allow super admin to update profiles (for moving users)
CREATE POLICY "profiles_update_super" ON public.profiles
FOR UPDATE USING (is_super_admin(auth.uid()));
