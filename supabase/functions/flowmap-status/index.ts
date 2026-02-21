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

/* ─── AES-GCM helpers (reused from zabbix-proxy) ─── */
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

/* ─── Host status type ─── */
interface HostStatusResult {
  status: "UP" | "DOWN" | "UNKNOWN";
  latency?: number;
  lastCheck?: string;
  availability24h?: number;
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

  // Validate token
  const token = authHeader.replace("Bearer ", "");
  const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
  if (claimsErr || !claims?.claims) return json({ error: "Invalid token" }, 401);

  const userId = claims.claims.sub as string;

  try {
    const body = await req.json() as { map_id: string; connection_id: string };
    const { map_id, connection_id } = body;

    if (!map_id || !connection_id) return json({ error: "map_id and connection_id are required" }, 400);

    // Get tenant
    const serviceClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const { data: tenantId } = await serviceClient.rpc("get_user_tenant_id", { p_user_id: userId });
    if (!tenantId) return json({ error: "Tenant not found" }, 403);

    // Fetch map hosts (via service role to avoid complex RLS join)
    const { data: hosts, error: hostsErr } = await serviceClient
      .from("flow_map_hosts")
      .select("id, zabbix_host_id, host_name")
      .eq("map_id", map_id)
      .eq("tenant_id", tenantId as string);

    if (hostsErr) return json({ error: `Hosts query failed: ${hostsErr.message}` }, 500);
    if (!hosts || hosts.length === 0) return json({ hosts: {} });

    // Fetch Zabbix connection
    const { data: conn, error: connErr } = await supabase
      .from("zabbix_connections")
      .select("id, url, username, password_ciphertext, password_iv, password_tag, is_active")
      .eq("id", connection_id)
      .single();

    if (connErr || !conn) return json({ error: "Connection not found" }, 404);
    if (!conn.is_active) return json({ error: "Connection disabled" }, 400);

    // Decrypt & login
    const password = await decryptPassword(conn.password_ciphertext, conn.password_iv, conn.password_tag, encryptionKey);
    const zabbixAuth = await getToken(conn.url, conn.username, password, conn.id);

    // Batch host.get — fetch all hosts at once
    const zabbixHostIds = hosts.map((h) => h.zabbix_host_id);
    const zbxHosts = (await zabbixCall(conn.url, zabbixAuth, "host.get", {
      hostids: zabbixHostIds,
      output: ["hostid", "host", "name", "status", "available"],
      selectInterfaces: ["ip", "dns", "port", "type", "available"],
    })) as Array<Record<string, unknown>>;

    // Batch: get ICMP ping items for latency
    const zbxItems = (await zabbixCall(conn.url, zabbixAuth, "item.get", {
      hostids: zabbixHostIds,
      search: { key_: "icmppingsec" },
      output: ["itemid", "hostid", "lastvalue", "lastclock"],
      limit: 500,
    })) as Array<Record<string, string>>;

    // Build lookup maps
    const zbxHostMap = new Map(zbxHosts.map((h) => [String(h.hostid), h]));
    const latencyMap = new Map<string, { latency: number; lastClock: string }>();
    for (const item of zbxItems) {
      const val = parseFloat(item.lastvalue || "0") * 1000; // sec → ms
      latencyMap.set(item.hostid, {
        latency: Math.round(val * 100) / 100,
        lastClock: item.lastclock ? new Date(parseInt(item.lastclock) * 1000).toISOString() : "",
      });
    }

    // Build result keyed by zabbix_host_id
    const result: Record<string, HostStatusResult> = {};

    for (const host of hosts) {
      const zbx = zbxHostMap.get(host.zabbix_host_id);
      if (!zbx) {
        result[host.zabbix_host_id] = { status: "UNKNOWN" };
        continue;
      }

      // available: 1 = available, 2 = unavailable, 0 = unknown
      // For Zabbix 6+, check interfaces
      let available = 0;
      const interfaces = zbx.interfaces as Array<Record<string, string>> | undefined;
      if (interfaces && interfaces.length > 0) {
        available = interfaces.some((iface) => String(iface.available) === "1") ? 1 : 2;
      } else {
        available = zbx.available ? Number(zbx.available) : 0;
      }

      const status: "UP" | "DOWN" | "UNKNOWN" = available === 1 ? "UP" : available === 2 ? "DOWN" : "UNKNOWN";
      const lat = latencyMap.get(host.zabbix_host_id);

      result[host.zabbix_host_id] = {
        status,
        latency: lat?.latency,
        lastCheck: lat?.lastClock || new Date().toISOString(),
      };
    }

    return json({ hosts: result });
  } catch (err) {
    console.error("flowmap-status error:", err);
    if (err instanceof Error && err.message.includes("login failed")) tokenCache.clear();
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
