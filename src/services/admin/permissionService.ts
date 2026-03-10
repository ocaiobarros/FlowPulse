import { supabase } from "@/integrations/supabase/client";

export interface GrantAccessParams {
  tenant_id: string;
  resource_type: string;
  resource_id: string;
  grantee_type: "user" | "team";
  grantee_id: string;
  access_level: "viewer" | "editor";
}

export async function grantAccess(params: GrantAccessParams) {
  const { data, error } = await supabase.functions.invoke("tenant-admin", {
    body: {
      action: "grant_access",
      ...params,
    },
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function revokeAccess(grantId: string) {
  const { data, error } = await supabase.functions.invoke("tenant-admin", {
    body: { action: "revoke_access", grant_id: grantId },
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function updateAccessLevel(grantId: string, accessLevel: "viewer" | "editor") {
  const { data, error } = await supabase.functions.invoke("tenant-admin", {
    body: {
      action: "update_access_level",
      grant_id: grantId,
      access_level: accessLevel,
    },
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function fetchTenantUsersAndTeams(tenantId: string) {
  const { data, error } = await supabase.functions.invoke("tenant-admin", {
    body: { action: "tenant_users", tenant_id: tenantId },
  });

  if (error || data?.error) {
    // Fallback to direct query
    const [usersRes, teamsRes] = await Promise.all([
      supabase.from("profiles").select("id, display_name, email").eq("tenant_id", tenantId),
      supabase.from("teams").select("id, name, color").eq("tenant_id", tenantId),
    ]);
    return {
      users: (usersRes.data ?? []) as Array<{ id: string; display_name: string | null; email: string | null }>,
      teams: (teamsRes.data ?? []) as Array<{ id: string; name: string; color?: string }>,
    };
  }

  return {
    users: (data?.users ?? []) as Array<{ id: string; display_name: string | null; email: string | null }>,
    teams: (data?.teams ?? []) as Array<{ id: string; name: string; color?: string }>,
  };
}
