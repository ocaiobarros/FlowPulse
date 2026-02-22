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

/* ─── CTO Telemetry result ─── */
interface CTOTelemetry {
  id: string;
  status: string;
  healthRatio: number;
  onuOnline: number;
  onuOffline: number;
  onuAuthorized: number;
  onuUnprovisioned: number;
  ponLinkStatus: string;
  trafficIn: number | null;
  trafficOut: number | null;
  temperature: number | null;
  fanStatus: string | null;
  fanRotation: number | null;
  txPower: number | null;
  cpuLoad: number | null;
  uptime: number | null;
}

/* ─── OLT-level aggregated health ─── */
interface OLTHealth {
  hostId: string;
  hostName: string;
  temperature: number | null;
  fanStatus: string | null;
  fanRotation: number | null;
  cpuLoad: number | null;
  uptime: number | null;
  totalOnuOnline: number;
  totalOnuOffline: number;
  totalUnprovisioned: number;
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

    // Fetch CTOs with OLT host association
    const { data: ctos, error: ctosErr } = await serviceClient
      .from("flow_map_ctos")
      .select("id, zabbix_host_ids, olt_host_id, pon_port_index, capacity, occupied_ports, status_calculated")
      .eq("map_id", map_id)
      .eq("tenant_id", tenantId as string);

    if (ctosErr) return json({ error: `CTOs query: ${ctosErr.message}` }, 500);
    if (!ctos || ctos.length === 0) return json({ updated: 0, ctos: [] });

    // Collect all Zabbix host IDs (from zabbix_host_ids array + olt_host_id via flow_map_hosts)
    const allZbxIds = new Set<string>();
    const oltHostDbIds = new Set<string>();
    for (const cto of ctos) {
      const ids = cto.zabbix_host_ids as string[] | null;
      if (ids) ids.forEach((id) => allZbxIds.add(id));
      if (cto.olt_host_id) oltHostDbIds.add(cto.olt_host_id);
    }

    // Resolve OLT host DB IDs to Zabbix host IDs
    const oltZbxMap = new Map<string, string>(); // DB id → zabbix_host_id
    if (oltHostDbIds.size > 0) {
      const { data: oltHosts } = await serviceClient
        .from("flow_map_hosts")
        .select("id, zabbix_host_id")
        .in("id", [...oltHostDbIds]);
      if (oltHosts) {
        for (const h of oltHosts) {
          oltZbxMap.set(h.id, h.zabbix_host_id);
          allZbxIds.add(h.zabbix_host_id);
        }
      }
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

    const zbxHostIds = [...allZbxIds];

    // Parallel Zabbix calls: host availability + ONU items + traffic + hardware
    const [zbxHosts, zbxItems] = await Promise.all([
      zabbixCall(conn.url, zabbixAuth, "host.get", {
        hostids: zbxHostIds,
        output: ["hostid", "available"],
        selectInterfaces: ["available"],
      }) as Promise<Array<{ hostid: string; available?: string; interfaces?: Array<{ available: string }> }>>,

      // Fetch OLT-specific items: ONU counts, PON status, traffic, temperature, fan, tx power, uptime, cpu, desprovisionadas
      zabbixCall(conn.url, zabbixAuth, "item.get", {
        hostids: zbxHostIds,
        output: ["itemid", "hostid", "key_", "lastvalue", "name"],
        search: { key_: "pon,ramal,descoberta,fan,CPU,net.if,desprovisionadas,1.3.6.1.2.1.1.3,1.3.6.1.4.1.2011.6.128.1.1.2.23.1.4,1.3.6.1.4.1.2011.6.1.1.5.1.9" },
        searchByAny: true,
        limit: 3000,
      }) as Promise<Array<{ itemid: string; hostid: string; key_: string; lastvalue: string; name: string }>>,
    ]);

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

    // Index items by hostid for fast lookup
    const itemsByHost = new Map<string, Array<{ key_: string; lastvalue: string; name: string }>>();
    for (const item of zbxItems) {
      if (!itemsByHost.has(item.hostid)) itemsByHost.set(item.hostid, []);
      itemsByHost.get(item.hostid)!.push({ key_: item.key_, lastvalue: item.lastvalue, name: item.name });
    }

    // Calculate status per CTO using ONU health ratio
    const updates: Array<{ id: string; newStatus: string }> = [];
    const ctoTelemetry: CTOTelemetry[] = [];

    for (const cto of ctos) {
      const directIds = (cto.zabbix_host_ids as string[] | null) ?? [];
      const oltDbId = cto.olt_host_id as string | null;
      const oltZbxId = oltDbId ? oltZbxMap.get(oltDbId) : null;
      const ponIndex = cto.pon_port_index as number | null;

      // Collect all relevant Zabbix host IDs for this CTO
      const relevantIds = [...directIds];
      if (oltZbxId && !relevantIds.includes(oltZbxId)) relevantIds.push(oltZbxId);

      let onuOnline = 0;
      let onuOffline = 0;
      let onuAuthorized = 0;
      let onuUnprovisioned = 0;
      let ponLinkStatus = "UNKNOWN";
      let trafficIn: number | null = null;
      let trafficOut: number | null = null;
      let temperature: number | null = null;
      let fanStatus: string | null = null;
      let fanRotation: number | null = null;
      let txPower: number | null = null;
      let cpuLoad: number | null = null;
      let uptime: number | null = null;

      // Search items across all relevant hosts
      for (const zbxId of relevantIds) {
        const items = itemsByHost.get(zbxId) ?? [];
        for (const item of items) {
          const key = item.key_.toLowerCase();
          const val = item.lastvalue;

          // ONU Online: keys like pon[...,1,...] or tag "ONUs ON"
          if (key.includes("pon[") && key.includes(",\"1\",")) {
            onuOnline += parseInt(val) || 0;
          }
          // ONU Offline: keys like pon[...,2,...]
          else if (key.includes("pon[") && key.includes(",\"2\",")) {
            onuOffline += parseInt(val) || 0;
          }
          // ONU Autorizadas: ramal.autorizadas
          else if (key.includes("ramal.autorizadas")) {
            onuAuthorized += parseInt(val) || 0;
          }
          // ONUs Desprovisionadas
          else if (key.includes("desprovisionadas")) {
            onuUnprovisioned += parseInt(val) || 0;
          }
          // PON Link Status: ramal.status
          else if (key.includes("ramal.status")) {
            if (ponIndex != null) {
              const match = key.match(/ramal\.status\[(\d+)\./);
              if (match && parseInt(match[1]) !== ponIndex) continue;
            }
            ponLinkStatus = val === "1" ? "UP" : val === "2" ? "DOWN" : "UNKNOWN";
          }
          // Tx Power (dBm) — OID 1.3.6.1.4.1.2011.6.128.1.1.2.23.1.4
          else if (key.includes("1.3.6.1.4.1.2011.6.128.1.1.2.23.1.4")) {
            const pw = parseFloat(val);
            if (!isNaN(pw)) {
              // Value comes pre-multiplied by 0.01 from Zabbix preprocessing
              txPower = txPower == null ? pw : Math.min(txPower, pw); // worst-case
            }
          }
          // Traffic In (bits received)
          else if (key.includes("net.if.in[ifhcinoctets")) {
            const bps = parseFloat(val) || 0;
            trafficIn = (trafficIn ?? 0) + bps;
          }
          // Traffic Out (bits sent)
          else if (key.includes("net.if.out[ifhcoutoctets")) {
            const bps = parseFloat(val) || 0;
            trafficOut = (trafficOut ?? 0) + bps;
          }
          // Slot temperature
          else if (key.includes("1.3.6.1.4.1.2011.6.3.3.2.1.13")) {
            const temp = parseInt(val) || 0;
            if (temp > 0 && temp < 2147483647) {
              temperature = temperature == null ? temp : Math.max(temperature, temp);
            }
          }
          // Fan status
          else if (key.includes("1.3.6.1.4.1.2011.6.1.1.5.1.6")) {
            fanStatus = val === "1" ? "ACTIVE" : "INACTIVE";
          }
          // Fan rotation (%)
          else if (key.includes("1.3.6.1.4.1.2011.6.1.1.5.1.9")) {
            const rot = parseInt(val) || 0;
            fanRotation = fanRotation == null ? rot : Math.max(fanRotation, rot);
          }
          // CPU load
          else if (key.includes("cpu[")) {
            const cpu = parseFloat(val) || 0;
            cpuLoad = cpuLoad == null ? cpu : Math.max(cpuLoad, cpu);
          }
          // Uptime (SNMP sysUptime — already in seconds via 0.01 multiplier)
          else if (key.includes("1.3.6.1.2.1.1.3.0")) {
            const ut = parseFloat(val) || 0;
            uptime = uptime == null ? ut : Math.max(uptime, ut);
          }
        }
      }

      // Health ratio: ONUs Online / Autorizadas
      const totalAuthorized = onuAuthorized > 0 ? onuAuthorized : (onuOnline + onuOffline);
      const healthRatio = totalAuthorized > 0 ? onuOnline / totalAuthorized : 1;

      // Status thresholds: ≥90% → OK, ≥10% → DEGRADED, <10% → CRITICAL
      let newStatus: string;
      if (ponLinkStatus === "DOWN") {
        newStatus = "CRITICAL";
      } else if (healthRatio >= 0.9) {
        newStatus = "OK";
      } else if (healthRatio >= 0.1) {
        newStatus = "DEGRADED";
      } else {
        newStatus = "CRITICAL";
      }

      // Fallback: if no ONU data, use host availability
      if (totalAuthorized === 0 && directIds.length > 0) {
        let upCount = 0;
        for (const zbxId of directIds) {
          if (availMap.get(zbxId)) upCount++;
        }
        const ratio = upCount / directIds.length;
        newStatus = ratio >= 0.9 ? "OK" : ratio >= 0.1 ? "DEGRADED" : "CRITICAL";
      }

      if (cto.status_calculated !== newStatus) {
        updates.push({ id: cto.id, newStatus });
      }

      ctoTelemetry.push({
        id: cto.id,
        status: newStatus,
        healthRatio: Math.round(healthRatio * 1000) / 10,
        onuOnline,
        onuOffline,
        onuAuthorized: totalAuthorized,
        onuUnprovisioned,
        ponLinkStatus,
        trafficIn,
        trafficOut,
        temperature,
        fanStatus,
        fanRotation,
        txPower,
        cpuLoad,
        uptime,
      });
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

    // Aggregate OLT-level health per unique Zabbix host
    const oltHealthMap = new Map<string, OLTHealth>();
    for (const zbxId of allZbxIds) {
      const items = itemsByHost.get(zbxId) ?? [];
      const health: OLTHealth = { hostId: zbxId, hostName: "", temperature: null, fanStatus: null, fanRotation: null, cpuLoad: null, uptime: null, totalOnuOnline: 0, totalOnuOffline: 0, totalUnprovisioned: 0 };
      for (const item of items) {
        const key = item.key_.toLowerCase();
        const val = item.lastvalue;
        if (key.includes("1.3.6.1.4.1.2011.6.3.3.2.1.13")) {
          const t = parseInt(val) || 0;
          if (t > 0 && t < 2147483647) health.temperature = health.temperature == null ? t : Math.max(health.temperature, t);
        } else if (key.includes("1.3.6.1.4.1.2011.6.1.1.5.1.6")) {
          health.fanStatus = val === "1" ? "ACTIVE" : "INACTIVE";
        } else if (key.includes("1.3.6.1.4.1.2011.6.1.1.5.1.9")) {
          const r = parseInt(val) || 0;
          health.fanRotation = health.fanRotation == null ? r : Math.max(health.fanRotation, r);
        } else if (key.includes("cpu[")) {
          const c = parseFloat(val) || 0;
          health.cpuLoad = health.cpuLoad == null ? c : Math.max(health.cpuLoad, c);
        } else if (key.includes("1.3.6.1.2.1.1.3.0")) {
          health.uptime = parseFloat(val) || 0;
        } else if (key.includes("pon[") && key.includes(",\"1\",")) {
          health.totalOnuOnline += parseInt(val) || 0;
        } else if (key.includes("pon[") && key.includes(",\"2\",")) {
          health.totalOnuOffline += parseInt(val) || 0;
        } else if (key.includes("desprovisionadas")) {
          health.totalUnprovisioned += parseInt(val) || 0;
        }
      }
      // Only include hosts that have some OLT data
      if (health.temperature != null || health.cpuLoad != null || health.uptime != null || health.totalOnuOnline > 0) {
        oltHealthMap.set(zbxId, health);
      }
    }

    console.log(`[cto-status-aggregator] Processed ${ctos.length} CTOs, updated ${updates.length}, OLTs: ${oltHealthMap.size}`);

    return json({ updated: updates.length, ctos: ctoTelemetry, oltHealth: Object.fromEntries(oltHealthMap) });
  } catch (err) {
    console.error("[cto-status-aggregator] error:", err);
    if (err instanceof Error && err.message.includes("login failed")) tokenCache.clear();
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
