
-- FlowFinance: Enums for scenario and transaction type
CREATE TYPE public.finance_scenario AS ENUM ('PREVISTO', 'REALIZADO');
CREATE TYPE public.finance_type AS ENUM ('PAGAR', 'RECEBER');

-- Main table
CREATE TABLE public.financial_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  transaction_date date NOT NULL,
  scenario public.finance_scenario NOT NULL,
  type public.finance_type NOT NULL,
  amount numeric(15,2) NOT NULL DEFAULT 0,
  month_reference date NOT NULL,
  description text DEFAULT '',
  category text DEFAULT '',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_ft_tenant ON public.financial_transactions(tenant_id);
CREATE INDEX idx_ft_month ON public.financial_transactions(tenant_id, month_reference);
CREATE INDEX idx_ft_scenario ON public.financial_transactions(tenant_id, scenario);

-- Auto-update updated_at
CREATE TRIGGER trg_ft_updated_at
  BEFORE UPDATE ON public.financial_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;

-- Select: all tenant users
CREATE POLICY ft_select ON public.financial_transactions
  FOR SELECT TO authenticated
  USING (tenant_id = public.jwt_tenant_id());

-- Insert: admin + editor
CREATE POLICY ft_insert ON public.financial_transactions
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.jwt_tenant_id()
    AND (
      public.has_role(auth.uid(), tenant_id, 'admin'::app_role)
      OR public.has_role(auth.uid(), tenant_id, 'editor'::app_role)
    )
  );

-- Update: admin + editor
CREATE POLICY ft_update ON public.financial_transactions
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.jwt_tenant_id()
    AND (
      public.has_role(auth.uid(), tenant_id, 'admin'::app_role)
      OR public.has_role(auth.uid(), tenant_id, 'editor'::app_role)
    )
  )
  WITH CHECK (tenant_id = public.jwt_tenant_id());

-- Delete: admin only
CREATE POLICY ft_delete ON public.financial_transactions
  FOR DELETE TO authenticated
  USING (
    tenant_id = public.jwt_tenant_id()
    AND public.has_role(auth.uid(), tenant_id, 'admin'::app_role)
  );
