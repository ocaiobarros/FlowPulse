import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, cache-control, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-cache, no-store" },
  });
}

/* ─── AES-GCM helpers ─── */
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  return bytes;
}

async function deriveAesKey(secret: string): Promise<CryptoKey> {
  if (/^[0-9a-fA-F]{64}$/.test(secret))
    return crypto.subtle.importKey("raw", hexToBytes(secret), { name: "AES-GCM" }, false, ["decrypt"]);
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", hash, { name: "AES-GCM" }, false, ["decrypt"]);
}

async function decryptPassword(ct: string, iv: string, tag: string, key: string): Promise<string> {
  const cryptoKey = await deriveAesKey(key);
  const combined = new Uint8Array(hexToBytes(ct).length + hexToBytes(tag).length);
  combined.set(hexToBytes(ct));
  combined.set(hexToBytes(tag), hexToBytes(ct).length);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: hexToBytes(iv), tagLength: 128 }, cryptoKey, combined);
  return new TextDecoder().decode(decrypted);
}

/* ─── Zabbix JSON-RPC ─── */
function buildApiUrl(base: string): string {
  const trimmed = base.replace(/\/+$/, "");
  return trimmed.endsWith("/api_jsonrpc.php") ? trimmed : `${trimmed}/api_jsonrpc.php`;
}

const tokenCache = new Map<string, { token: string; expiresAt: number }>();

async function zabbixLogin(url: string, username: string, password: string): Promise<string> {
  const res = await fetch(buildApiUrl(url), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method: "user.login", params: { username, password }, id: 1 }),
    signal: AbortSignal.timeout(15_000),
  });
  const data = await res.json();
  if (data.error) throw new Error(`Zabbix login failed: ${JSON.stringify(data.error)}`);
  return data.result;
}

async function getToken(url: string, username: string, password: string, connId: string): Promise<string> {
  const cached = tokenCache.get(connId);
  if (cached && cached.expiresAt > Date.now()) return cached.token;
  const token = await zabbixLogin(url, username, password);
  tokenCache.set(connId, { token, expiresAt: Date.now() + 10 * 60_000 });
  return token;
}

async function zabbixCall(url: string, auth: string, method: string, params: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(buildApiUrl(url), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method, params, auth, id: 2 }),
    signal: AbortSignal.timeout(30_000),
  });
  const data = await res.json();
  if (data.error) throw new Error(`Zabbix ${method}: ${JSON.stringify(data.error)}`);
  return data.result;
}

/* ─── Main Handler ─── */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const encryptionKey = Deno.env.get("ZABBIX_ENCRYPTION_KEY");

  if (!encryptionKey) return json({ error: "ZABBIX_ENCRYPTION_KEY not configured" }, 500);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
  if (claimsErr || !claims?.claims) return json({ error: "Invalid token" }, 401);

  const userId = claims.claims.sub as string;

  try {
    const body = await req.json() as { map_id: string; connection_id: string };
    const { map_id, connection_id } = body;
    if (!map_id || !connection_id) return json({ error: "map_id and connection_id required" }, 400);

    const serviceClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const { data: tenantId } = await serviceClient.rpc("get_user_tenant_id", { p_user_id: userId });
    if (!tenantId) return json({ error: "Tenant not found" }, 403);

    // Fetch all CTOs for this map that have zabbix_host_ids
    const { data: ctos, error: ctosErr } = await serviceClient
      .from("flow_map_ctos")
      .select("id, zabbix_host_ids, capacity, occupied_ports, status_calculated")
      .eq("map_id", map_id)
      .eq("tenant_id", tenantId as string);

    if (ctosErr) return json({ error: `CTOs query: ${ctosErr.message}` }, 500);
    if (!ctos || ctos.length === 0) return json({ updated: 0, ctos: [] });

    // Collect all unique Zabbix host IDs from all CTOs
    const allZbxIds = new Set<string>();
    for (const cto of ctos) {
      const ids = cto.zabbix_host_ids as string[] | null;
      if (ids) ids.forEach((id) => allZbxIds.add(id));
    }

    if (allZbxIds.size === 0) return json({ updated: 0, ctos: [] });

    // Fetch Zabbix connection
    const { data: conn, error: connErr } = await supabase
      .from("zabbix_connections")
      .select("id, url, username, password_ciphertext, password_iv, password_tag, is_active")
      .eq("id", connection_id)
      .single();

    if (connErr || !conn) return json({ error: "Connection not found" }, 404);
    if (!conn.is_active) return json({ error: "Connection disabled" }, 400);

    const password = await decryptPassword(conn.password_ciphertext, conn.password_iv, conn.password_tag, encryptionKey);
    const zabbixAuth = await getToken(conn.url, conn.username, password, conn.id);

    // Fetch host availability from Zabbix
    const zbxHostIds = [...allZbxIds];
    const zbxHosts = await zabbixCall(conn.url, zabbixAuth, "host.get", {
      hostids: zbxHostIds,
      output: ["hostid", "available"],
      selectInterfaces: ["available"],
    }) as Array<{ hostid: string; available?: string; interfaces?: Array<{ available: string }> }>;

    // Build availability map
    const availMap = new Map<string, boolean>();
    for (const h of zbxHosts) {
      let up = false;
      if (h.interfaces && h.interfaces.length > 0) {
        up = h.interfaces.some((i) => String(i.available) === "1");
      } else {
        up = String(h.available) === "1";
      }
      availMap.set(h.hostid, up);
    }

    // Calculate status per CTO and batch update
    const updates: Array<{ id: string; newStatus: string }> = [];
    const ctoStatuses: Array<{ id: string; status: string; upCount: number; totalCount: number }> = [];

    for (const cto of ctos) {
      const ids = (cto.zabbix_host_ids as string[] | null) ?? [];
      if (ids.length === 0) continue;

      let upCount = 0;
      let totalCount = ids.length;
      for (const zbxId of ids) {
        if (availMap.get(zbxId)) upCount++;
      }

      const ratio = upCount / totalCount;
      let newStatus: string;
      if (ratio >= 1) newStatus = "OK";
      else if (ratio >= 0.5) newStatus = "DEGRADED";
      else if (ratio > 0) newStatus = "CRITICAL";
      else newStatus = "CRITICAL";

      if (cto.status_calculated !== newStatus) {
        updates.push({ id: cto.id, newStatus });
      }
      ctoStatuses.push({ id: cto.id, status: newStatus, upCount, totalCount });
    }

    // Batch update CTOs
    const ops: Promise<unknown>[] = [];
    for (const upd of updates) {
      ops.push(
        serviceClient.from("flow_map_ctos")
          .update({ status_calculated: upd.newStatus })
          .eq("id", upd.id)
      );
    }
    if (ops.length > 0) await Promise.all(ops);

    console.log(`[cto-status-aggregator] Processed ${ctos.length} CTOs, updated ${updates.length}`);

    return json({ updated: updates.length, ctos: ctoStatuses });
  } catch (err) {
    console.error("[cto-status-aggregator] error:", err);
    if (err instanceof Error && err.message.includes("login failed")) tokenCache.clear();
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
