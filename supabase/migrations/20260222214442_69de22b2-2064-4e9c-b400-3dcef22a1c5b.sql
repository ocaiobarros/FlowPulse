
-- Fix: occupied_ports column (may already exist from partial apply)
ALTER TABLE public.flow_map_ctos
  ADD COLUMN IF NOT EXISTS occupied_ports integer NOT NULL DEFAULT 0;

-- CHECK using text cast to integer for enum comparison
ALTER TABLE public.flow_map_ctos
  DROP CONSTRAINT IF EXISTS chk_cto_occupied_ports;

ALTER TABLE public.flow_map_ctos
  ADD CONSTRAINT chk_cto_occupied_ports CHECK (occupied_ports >= 0 AND occupied_ports <= (capacity::text)::integer);
