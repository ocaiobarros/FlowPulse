import { supabase } from "@/integrations/supabase/client";

async function invokeTeamAction(action: string, payload: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("tenant-admin", {
    body: { action, ...payload },
  });

  if (error) {
    let msg = error.message || "Edge Function error";
    const ctx = (error as any)?.context;
    if (ctx?.clone) {
      try {
        const j = await ctx.clone().json();
        if (j?.error) msg = j.error;
      } catch { /* */ }
    }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export interface CreateTeamParams {
  tenant_id: string;
  name: string;
  description?: string;
  color?: string;
}

export interface UpdateTeamParams {
  team_id: string;
  name: string;
  description?: string;
  color?: string;
}

export async function fetchTeams(tenantId: string) {
  try {
    const result = await invokeTeamAction("tenant_teams", { tenant_id: tenantId });
    return {
      teams: (result.teams ?? []) as any[],
      members: (result.members ?? []) as any[],
    };
  } catch {
    // Fallback to direct query
    const [teamsRes, membersRes] = await Promise.all([
      supabase.from("teams").select("*").eq("tenant_id", tenantId).order("name"),
      supabase.from("team_members").select("*").eq("tenant_id", tenantId),
    ]);
    return {
      teams: (teamsRes.data ?? []) as any[],
      members: (membersRes.data ?? []) as any[],
    };
  }
}

export async function createTeam(params: CreateTeamParams) {
  return invokeTeamAction("create_team", {
    tenant_id: params.tenant_id,
    name: params.name.trim(),
    description: params.description?.trim() ?? "",
    color: params.color ?? "#10b981",
  });
}

export async function updateTeam(params: UpdateTeamParams) {
  return invokeTeamAction("update_team", {
    team_id: params.team_id,
    name: params.name.trim(),
    description: params.description?.trim() ?? "",
    color: params.color,
  });
}

export async function deleteTeam(teamId: string) {
  return invokeTeamAction("delete_team", { team_id: teamId });
}

export async function addTeamMember(tenantId: string, teamId: string, userId: string) {
  return invokeTeamAction("add_team_member", {
    tenant_id: tenantId,
    team_id: teamId,
    user_id: userId,
  });
}

export async function removeTeamMember(memberId: string) {
  return invokeTeamAction("remove_team_member", { member_id: memberId });
}
