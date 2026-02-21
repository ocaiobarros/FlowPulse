
-- =========================================
-- 0) PRE-REQ: garantir composite unique em flow_map_links
-- =========================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'uq_fml_id_tenant'
      AND conrelid = 'public.flow_map_links'::regclass
  ) THEN
    ALTER TABLE public.flow_map_links
      ADD CONSTRAINT uq_fml_id_tenant UNIQUE (id, tenant_id);
  END IF;
END $$;

-- =========================================
-- 1) flow_map_link_items (normalized metric association)
-- =========================================
CREATE TABLE IF NOT EXISTS public.flow_map_link_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  link_id uuid NOT NULL,

  side text NOT NULL CHECK (side IN ('A','B')),
  direction text NOT NULL CHECK (direction IN ('IN','OUT')),
  metric text NOT NULL CHECK (metric IN ('BPS','PPS','STATUS','UTIL','ERRORS')),

  zabbix_host_id text NOT NULL,
  zabbix_item_id text NOT NULL,

  key_ text NOT NULL DEFAULT '',
  name text NOT NULL DEFAULT '',

  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT fk_fmli_link
    FOREIGN KEY (link_id, tenant_id)
    REFERENCES public.flow_map_links(id, tenant_id)
    ON DELETE CASCADE
);

-- Anti-duplicidade: mesmo item no mesmo link
CREATE UNIQUE INDEX IF NOT EXISTS idx_fmli_unique_item_per_link
ON public.flow_map_link_items (tenant_id, link_id, zabbix_item_id);

-- Anti-duplicidade lógica: mesma métrica no mesmo lado
CREATE UNIQUE INDEX IF NOT EXISTS idx_fmli_unique_metric_per_side
ON public.flow_map_link_items (tenant_id, link_id, side, direction, metric);

-- Performance
CREATE INDEX IF NOT EXISTS idx_fmli_link   ON public.flow_map_link_items (link_id);
CREATE INDEX IF NOT EXISTS idx_fmli_tenant ON public.flow_map_link_items (tenant_id);
CREATE INDEX IF NOT EXISTS idx_fmli_item   ON public.flow_map_link_items (zabbix_item_id);

-- RLS
ALTER TABLE public.flow_map_link_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='flow_map_link_items' AND policyname='fmli_select') THEN
    CREATE POLICY "fmli_select"
    ON public.flow_map_link_items FOR SELECT
    USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='flow_map_link_items' AND policyname='fmli_manage') THEN
    CREATE POLICY "fmli_manage"
    ON public.flow_map_link_items FOR ALL
    USING (
      (tenant_id = get_user_tenant_id(auth.uid())
        AND (has_role(auth.uid(), tenant_id, 'admin') OR has_role(auth.uid(), tenant_id, 'editor')))
      OR is_super_admin(auth.uid())
    )
    WITH CHECK (
      (tenant_id = get_user_tenant_id(auth.uid())
        AND (has_role(auth.uid(), tenant_id, 'admin') OR has_role(auth.uid(), tenant_id, 'editor')))
      OR is_super_admin(auth.uid())
    );
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.flow_map_link_items TO authenticated;

-- =========================================
-- 2) flow_map_links enhancements
-- =========================================

-- Capacity
ALTER TABLE public.flow_map_links
ADD COLUMN IF NOT EXISTS capacity_mbps integer NOT NULL DEFAULT 1000;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_capacity_positive'
      AND conrelid = 'public.flow_map_links'::regclass
  ) THEN
    ALTER TABLE public.flow_map_links
      ADD CONSTRAINT chk_capacity_positive CHECK (capacity_mbps > 0);
  END IF;
END $$;

-- Status strategy
ALTER TABLE public.flow_map_links
ADD COLUMN IF NOT EXISTS status_strategy text NOT NULL DEFAULT 'AUTO';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_status_strategy'
      AND conrelid = 'public.flow_map_links'::regclass
  ) THEN
    ALTER TABLE public.flow_map_links
      ADD CONSTRAINT chk_status_strategy
      CHECK (status_strategy IN ('AUTO','TRIGGER_ONLY','INTERFACE_ONLY','ICMP_ONLY'));
  END IF;
END $$;

-- Topological roles
ALTER TABLE public.flow_map_links
ADD COLUMN IF NOT EXISTS origin_role text NOT NULL DEFAULT 'CORE';

ALTER TABLE public.flow_map_links
ADD COLUMN IF NOT EXISTS dest_role text NOT NULL DEFAULT 'EDGE';

-- Engine state
ALTER TABLE public.flow_map_links
ADD COLUMN IF NOT EXISTS current_status text NOT NULL DEFAULT 'UNKNOWN';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_current_status'
      AND conrelid = 'public.flow_map_links'::regclass
  ) THEN
    ALTER TABLE public.flow_map_links
      ADD CONSTRAINT chk_current_status
      CHECK (current_status IN ('UP','DOWN','DEGRADED','UNKNOWN'));
  END IF;
END $$;

ALTER TABLE public.flow_map_links
ADD COLUMN IF NOT EXISTS last_status_change timestamptz;
