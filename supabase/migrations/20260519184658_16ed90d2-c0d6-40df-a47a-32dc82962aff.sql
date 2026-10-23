
-- Account type enum
DO $$ BEGIN
  CREATE TYPE public.account_type AS ENUM ('asset','liability','equity','income','expense');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Chart of accounts
CREATE TABLE public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  type public.account_type NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, code)
);
CREATE INDEX idx_accounts_org ON public.accounts(organization_id);

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY acc_select ON public.accounts FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY acc_insert ON public.accounts FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin','accountant']::org_role[]));
CREATE POLICY acc_update ON public.accounts FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin','accountant']::org_role[]));
CREATE POLICY acc_delete ON public.accounts FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::org_role[]));

CREATE TRIGGER trg_accounts_updated BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Journal entries
CREATE TABLE public.journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  memo TEXT,
  reference TEXT,
  is_posted BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_je_org ON public.journal_entries(organization_id, entry_date DESC);

ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY je_select ON public.journal_entries FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY je_insert ON public.journal_entries FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin','accountant']::org_role[]));
CREATE POLICY je_update ON public.journal_entries FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin','accountant']::org_role[]));
CREATE POLICY je_delete ON public.journal_entries FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::org_role[]));

CREATE TRIGGER trg_je_updated BEFORE UPDATE ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Journal lines
CREATE TABLE public.journal_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  entry_id UUID NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id),
  position INT NOT NULL DEFAULT 0,
  debit NUMERIC(14,2) NOT NULL DEFAULT 0,
  credit NUMERIC(14,2) NOT NULL DEFAULT 0,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (debit >= 0 AND credit >= 0),
  CHECK (NOT (debit > 0 AND credit > 0))
);
CREATE INDEX idx_jl_entry ON public.journal_lines(entry_id);
CREATE INDEX idx_jl_account ON public.journal_lines(account_id);

ALTER TABLE public.journal_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY jl_select ON public.journal_lines FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY jl_insert ON public.journal_lines FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin','accountant']::org_role[]));
CREATE POLICY jl_update ON public.journal_lines FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin','accountant']::org_role[]));
CREATE POLICY jl_delete ON public.journal_lines FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin','accountant']::org_role[]));

-- Balanced check on post
CREATE OR REPLACE FUNCTION public.tg_check_journal_balanced()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_d NUMERIC(14,2); v_c NUMERIC(14,2);
BEGIN
  IF NEW.is_posted AND (OLD.is_posted IS DISTINCT FROM NEW.is_posted) THEN
    SELECT COALESCE(SUM(debit),0), COALESCE(SUM(credit),0)
      INTO v_d, v_c FROM public.journal_lines WHERE entry_id = NEW.id;
    IF v_d <> v_c OR v_d = 0 THEN
      RAISE EXCEPTION 'Journal entry % is not balanced (debit % vs credit %)', NEW.id, v_d, v_c;
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_je_balanced BEFORE UPDATE ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.tg_check_journal_balanced();

-- Seed default chart of accounts on org creation
CREATE OR REPLACE FUNCTION public.tg_seed_accounts()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.accounts (organization_id, code, name, type) VALUES
    (NEW.id, '1000', 'Cash', 'asset'),
    (NEW.id, '1010', 'Bank', 'asset'),
    (NEW.id, '1200', 'Accounts Receivable', 'asset'),
    (NEW.id, '1400', 'Inventory', 'asset'),
    (NEW.id, '1500', 'Fixed Assets', 'asset'),
    (NEW.id, '2000', 'Accounts Payable', 'liability'),
    (NEW.id, '2100', 'Tax Payable', 'liability'),
    (NEW.id, '3000', 'Owner Equity', 'equity'),
    (NEW.id, '3900', 'Retained Earnings', 'equity'),
    (NEW.id, '4000', 'Sales Revenue', 'income'),
    (NEW.id, '4100', 'Other Income', 'income'),
    (NEW.id, '5000', 'Cost of Goods Sold', 'expense'),
    (NEW.id, '6000', 'Operating Expenses', 'expense'),
    (NEW.id, '6100', 'Office Expenses', 'expense'),
    (NEW.id, '6200', 'Travel', 'expense'),
    (NEW.id, '6300', 'Software & Subscriptions', 'expense'),
    (NEW.id, '6400', 'Marketing', 'expense'),
    (NEW.id, '6500', 'Utilities', 'expense')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_seed_accounts AFTER INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.tg_seed_accounts();

-- Backfill existing orgs
INSERT INTO public.accounts (organization_id, code, name, type)
SELECT o.id, x.code, x.name, x.type::public.account_type
FROM public.organizations o
CROSS JOIN (VALUES
  ('1000','Cash','asset'),('1010','Bank','asset'),('1200','Accounts Receivable','asset'),
  ('1400','Inventory','asset'),('1500','Fixed Assets','asset'),
  ('2000','Accounts Payable','liability'),('2100','Tax Payable','liability'),
  ('3000','Owner Equity','equity'),('3900','Retained Earnings','equity'),
  ('4000','Sales Revenue','income'),('4100','Other Income','income'),
  ('5000','Cost of Goods Sold','expense'),('6000','Operating Expenses','expense'),
  ('6100','Office Expenses','expense'),('6200','Travel','expense'),
  ('6300','Software & Subscriptions','expense'),('6400','Marketing','expense'),
  ('6500','Utilities','expense')
) AS x(code,name,type)
ON CONFLICT DO NOTHING;
