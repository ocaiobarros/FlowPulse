
CREATE OR REPLACE FUNCTION public.check_viability(
  p_lat DOUBLE PRECISION,
  p_lon DOUBLE PRECISION,
  p_tenant_id UUID,
  p_map_id UUID
)
RETURNS TABLE (
  cto_id UUID,
  cto_name TEXT,
  distance_m DOUBLE PRECISION,
  capacity TEXT,
  occupied_ports INT,
  free_ports INT,
  status_calculated TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
  SELECT * FROM (
    SELECT
      c.id AS cto_id,
      c.name AS cto_name,
      (6371000.0 * acos(
        LEAST(1.0, GREATEST(-1.0,
          cos(radians(p_lat)) * cos(radians(c.lat)) *
          cos(radians(c.lon) - radians(p_lon)) +
          sin(radians(p_lat)) * sin(radians(c.lat))
        ))
      )) AS distance_m,
      c.capacity::TEXT AS capacity,
      c.occupied_ports,
      (c.capacity::TEXT::INT - c.occupied_ports) AS free_ports,
      c.status_calculated::TEXT AS status_calculated
    FROM public.flow_map_ctos c
    WHERE c.tenant_id = p_tenant_id
      AND c.map_id = p_map_id
      AND abs(c.lat - p_lat) < 0.002
      AND abs(c.lon - p_lon) < 0.003
  ) sub
  WHERE sub.distance_m <= 200
  ORDER BY sub.distance_m ASC
  LIMIT 5;
$$;

GRANT EXECUTE ON FUNCTION public.check_viability TO authenticated;
