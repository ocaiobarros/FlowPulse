import { supabase } from "@/integrations/supabase/client";

export interface InviteUserParams {
  email: string;
  display_name?: string;
  role: string;
  password?: string;
  target_tenant_id: string;
  mode?: "link" | "create";
}

export interface SetUserRoleParams {
  user_id: string;
  tenant_id: string;
  role: string;
}

export interface UnlinkUserParams {
  user_id: string;
  tenant_id: string;
}

async function extractError(err: any, fallback: string): Promise<string> {
  const context = err?.context;
  if (context?.clone && typeof context.clone === "function") {
    try {
      const j = await context.clone().json();
      if (typeof j?.error === "string" && j.error.trim()) return j.error;
      if (typeof j?.message === "string" && j.message.trim()) return j.message;
    } catch { /* */ }
    try {
      const t = await context.clone().text();
      if (typeof t === "string" && t.trim()) return t;
    } catch { /* */ }
  }
  if (typeof err?.message === "string" && err.message.trim()) return err.message;
  return fallback;
}

export async function inviteUser(params: InviteUserParams) {
  let email = params.email.trim().toLowerCase();
  if (!email.includes("@")) email = `${email}@flowpulse.local`;

  const { data, error } = await supabase.functions.invoke("invite-user", {
    body: {
      email,
      display_name: params.display_name?.trim() ?? "",
      role: params.role,
      password: params.password?.trim() || undefined,
      target_tenant_id: params.target_tenant_id,
      mode: params.mode ?? "link",
    },
  });

  if (error) {
    const msg = await extractError(error, "Falha ao convidar usuário.");
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function setUserRole(params: SetUserRoleParams) {
  const { data, error } = await supabase.functions.invoke("tenant-admin", {
    body: {
      action: "set_user_role",
      user_id: params.user_id,
      tenant_id: params.tenant_id,
      role: params.role,
    },
  });

  if (error) {
    const msg = await extractError(error, "Falha ao atualizar role.");
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function unlinkUser(params: UnlinkUserParams) {
  const { data, error } = await supabase.functions.invoke("tenant-admin", {
    body: {
      action: "unlink",
      user_id: params.user_id,
      tenant_id: params.tenant_id,
    },
  });

  if (error) {
    const msg = await extractError(error, "Falha ao desvincular usuário.");
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function deleteUser(userId: string) {
  const { data, error } = await supabase.functions.invoke("delete-user", {
    body: { user_id: userId },
  });

  if (error) {
    const msg = await extractError(error, "Falha ao excluir usuário.");
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}
