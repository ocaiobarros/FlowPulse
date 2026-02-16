import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/* ─── config ──────────────────────────────────────── */
const DEDUPE_TTL_S = 5;          // 5s dedupe window
const COALESCE_WINDOW_MS = 100;  // 100ms coalescing batch
const MAX_BATCH = 200;

/* ─── Upstash Redis REST helper ───────────────────── */
class UpstashRedis {
  private url: string;
  private token: string;

  constructor(url: string, token: string) {
    this.url = url.endsWith("/") ? url.slice(0, -1) : url;
    this.token = token;
  }

  async setNX(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    const resp = await fetch(`${this.url}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["SET", key, value, "NX", "EX", String(ttlSeconds)],
      ]),
    });
    const results = await resp.json();
    // Pipeline returns array of [result]. SET NX returns "OK" or null
    return results?.[0]?.result === "OK";
  }
}

/* ─── types ───────────────────────────────────────── */
interface TelemetryPayload {
  tenant_id: string;
  dashboard_id: string;
  key: string;
  type: string;
  data: Record<string, unknown>;
  ts: number;
  meta?: Record<string, unknown>;
}

/* ─── main ────────────────────────────────────────── */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Env checks
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const redisUrl = Deno.env.get("UPSTASH_REDIS_REST_URL");
  const redisToken = Deno.env.get("UPSTASH_REDIS_REST_TOKEN");

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }, 500);
  }
  if (!redisUrl || !redisToken) {
    return jsonResponse({ error: "Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN" }, 500);
  }

  const redis = new UpstashRedis(redisUrl, redisToken);
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  try {
    const body = await req.json();
    const events: TelemetryPayload[] = Array.isArray(body) ? body : [body];

    if (events.length > MAX_BATCH) {
      return jsonResponse({ error: `batch too large: ${events.length} > ${MAX_BATCH}` }, 400);
    }

    // 1. Dedupe: filter out recently seen keys
    const dedupeResults = await Promise.all(
      events.map(async (evt) => {
        const dedupeKey = `reactor:${evt.dashboard_id}:${evt.key}`;
        const isNew = await redis.setNX(dedupeKey, String(evt.ts), DEDUPE_TTL_S);
        return { evt, isNew };
      }),
    );

    const fresh = dedupeResults.filter((r) => r.isNew).map((r) => r.evt);

    if (fresh.length === 0) {
      return jsonResponse({ processed: 0, deduped: events.length, broadcast: 0 });
    }

    // 2. Coalesce: group by dashboard_id, keep only latest per key
    const byDashboard = new Map<string, Map<string, TelemetryPayload>>();

    for (const evt of fresh) {
      let dashMap = byDashboard.get(evt.dashboard_id);
      if (!dashMap) {
        dashMap = new Map();
        byDashboard.set(evt.dashboard_id, dashMap);
      }
      const existing = dashMap.get(evt.key);
      if (!existing || evt.ts > existing.ts) {
        dashMap.set(evt.key, evt);
      }
    }

    // 3. Broadcast per dashboard channel
    let broadcastCount = 0;

    for (const [dashboardId, keyMap] of byDashboard) {
      const channelName = `dashboard:${dashboardId}`;
      const channel = supabase.channel(channelName);

      for (const [, evt] of keyMap) {
        await channel.send({
          type: "broadcast",
          event: "DATA_UPDATE",
          payload: {
            key: evt.key,
            type: evt.type,
            data: evt.data,
            ts: evt.ts,
          },
        });
        broadcastCount++;
      }

      // Cleanup channel subscription
      await supabase.removeChannel(channel);
    }

    return jsonResponse({
      processed: events.length,
      deduped: events.length - fresh.length,
      coalesced: fresh.length - broadcastCount,
      broadcast: broadcastCount,
    });
  } catch (err) {
    console.error("reactor error:", err);
    return jsonResponse(
      { error: err instanceof Error ? err.message : String(err) },
      500,
    );
  }
});

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
