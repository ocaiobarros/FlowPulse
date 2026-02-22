import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Authenticate user
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json({ error: "Unauthorized" }, 401);
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: claimsData, error: claimsError } = await userClient.auth.getUser();
  if (claimsError || !claimsData?.user) {
    return json({ error: "Unauthorized" }, 401);
  }
  const userId = claimsData.user.id;

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // Get user's tenant
  const { data: tenantId } = await adminClient.rpc("get_user_tenant_id", { p_user_id: userId });
  if (!tenantId) return json({ error: "No tenant found" }, 403);

  // Check admin role
  const { data: isAdmin } = await adminClient.rpc("has_role", {
    p_user_id: userId,
    p_tenant_id: tenantId,
    p_role: "admin",
  });
  if (!isAdmin) return json({ error: "Admin role required" }, 403);

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    if (req.method === "GET") {
      // List active tokens (without hash)
      const { data: tokens, error } = await adminClient
        .from("webhook_tokens")
        .select("id, label, is_active, created_at, revoked_at")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return json({ tokens });
    }

    if (req.method === "POST" && action === "generate") {
      const body = await req.json().catch(() => ({}));
      const label = (body as Record<string, string>).label || "default";

      // Revoke existing token with same label
      await adminClient
        .from("webhook_tokens")
        .update({ is_active: false, revoked_at: new Date().toISOString() })
        .eq("tenant_id", tenantId)
        .eq("label", label)
        .eq("is_active", true);

      // Generate new token
      const plainToken = generateToken();
      const tokenHash = await sha256hex(plainToken);

      const { data: newToken, error } = await adminClient
        .from("webhook_tokens")
        .insert({
          tenant_id: tenantId,
          label,
          token_hash: tokenHash,
          is_active: true,
          created_by: userId,
        })
        .select("id, label, created_at")
        .single();

      if (error) throw error;

      // Return plain token ONCE — it won't be stored/visible again
      return json({
        message: "Token generated. Save it now — it won't be shown again.",
        token: plainToken,
        id: newToken.id,
        label: newToken.label,
      });
    }

    if (req.method === "POST" && action === "revoke") {
      const body = await req.json().catch(() => ({}));
      const tokenId = (body as Record<string, string>).token_id;
      if (!tokenId) return json({ error: "token_id required" }, 400);

      const { error } = await adminClient
        .from("webhook_tokens")
        .update({ is_active: false, revoked_at: new Date().toISOString() })
        .eq("id", tokenId)
        .eq("tenant_id", tenantId);

      if (error) throw error;
      return json({ message: "Token revoked", token_id: tokenId });
    }

    return json({ error: "Invalid action. Use ?action=generate or ?action=revoke" }, 400);
  } catch (err) {
    console.error("[webhook-token-manage] error:", err);
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
