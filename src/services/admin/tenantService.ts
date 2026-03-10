import { supabase } from "@/integrations/supabase/client";

async function extractError(err: any, fallback: string): Promise<string> {
  const context = err?.context;
  if (context?.clone && typeof context.clone === "function") {
    try {
      const j = await context.clone().json();
      if (typeof j?.error === "string" && j.error.trim()) return j.error;
      if (typeof j?.message === "string" && j.message.trim()) return j.message;
    } catch { /* */ }
  }
  if (typeof err?.message === "string" && err.message.trim()) return err.message;
  return fallback;
}

export interface CreateTenantParams {
  name: string;
  slug?: string;
}

export interface UpdateTenantParams {
  tenant_id: string;
  name: string;
  slug: string;
}

export async function createTenant(params: CreateTenantParams) {
  const { data, error } = await supabase.functions.invoke("tenant-admin", {
    body: {
      action: "create",
      name: params.name.trim(),
      slug: params.slug?.trim() || params.name.trim(),
    },
  });

  if (error) {
    const msg = await extractError(error, "Falha ao criar organização.");
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function updateTenant(params: UpdateTenantParams) {
  const slug = params.slug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-|-$/g, "");

  if (!slug) throw new Error("Slug inválido");

  const { data, error } = await supabase.functions.invoke("tenant-admin", {
    body: {
      action: "update_tenant",
      tenant_id: params.tenant_id,
      name: params.name.trim(),
      slug,
    },
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function deleteTenant(tenantId: string) {
  const { data, error } = await supabase.functions.invoke("tenant-admin", {
    body: { action: "delete", tenant_id: tenantId },
  });

  if (error) {
    const msg = await extractError(error, "Falha ao excluir organização.");
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function listTenantMembers() {
  const { data, error } = await supabase.functions.invoke("tenant-admin", {
    body: { action: "members" },
  });
  return { data, error };
}

export async function listTenants() {
  const { data, error } = await supabase.functions.invoke("tenant-admin", {
    body: { action: "list" },
  });
  return { data, error };
}
