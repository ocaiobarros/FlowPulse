
-- Sanitizar enquanto ainda é TEXT (antes de qualquer ENUM)
UPDATE public.flow_map_links SET current_status = 'UNKNOWN' WHERE current_status NOT IN ('UP','DOWN','DEGRADED','UNKNOWN');
UPDATE public.flow_map_link_events SET status = 'UNKNOWN' WHERE status NOT IN ('UP','DOWN','DEGRADED','UNKNOWN');
