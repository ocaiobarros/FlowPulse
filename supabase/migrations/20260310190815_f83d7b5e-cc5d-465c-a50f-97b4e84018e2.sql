
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  existing_tenant_id UUID;
  user_name TEXT;
BEGIN
  user_name := COALESCE(
    NEW.raw_user_meta_data->>'display_name',
    NEW.raw_user_meta_data->>'full_name',
    split_part(NEW.email, '@', 1)
  );

  -- Only process users that have a pre-assigned tenant_id (set by invite-user edge function)
  existing_tenant_id := NULLIF(TRIM(COALESCE(NEW.raw_app_meta_data->>'tenant_id', '')), '')::UUID;

  IF existing_tenant_id IS NULL THEN
    -- No tenant assigned — skip profile/role creation.
    -- User exists in auth.users but has no access until an admin invites them.
    RETURN NEW;
  END IF;

  -- Verify the tenant actually exists
  PERFORM 1 FROM public.tenants WHERE id = existing_tenant_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Create profile pointing to the pre-assigned tenant
  INSERT INTO public.profiles (id, tenant_id, display_name, email)
  VALUES (NEW.id, existing_tenant_id, user_name, NEW.email)
  ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    email = EXCLUDED.email;

  -- Create default role (will be updated by edge function after)
  INSERT INTO public.user_roles (user_id, tenant_id, role)
  VALUES (NEW.id, existing_tenant_id, 'viewer')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$function$;
