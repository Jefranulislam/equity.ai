-- Bill status enum
DO $$ BEGIN
  CREATE TYPE public.bill_status AS ENUM ('draft','open','partial','paid','void');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- VENDORS
CREATE TABLE public.vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  tax_id TEXT,
  currency TEXT NOT NULL DEFAULT 'USD',
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_vendors_org ON public.vendors(organization_id);
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
CREATE POLICY vendors_select ON public.vendors FOR SELECT TO authenticated USING (is_org_member(organization_id, auth.uid()));
CREATE POLICY vendors_insert ON public.vendors FOR INSERT TO authenticated WITH CHECK (has_org_role(organization_id, auth.uid(), ARRAY['owner','admin','accountant']::org_role[]));
CREATE POLICY vendors_update ON public.vendors FOR UPDATE TO authenticated USING (has_org_role(organization_id, auth.uid(), ARRAY['owner','admin','accountant']::org_role[]));
CREATE POLICY vendors_delete ON public.vendors FOR DELETE TO authenticated USING (has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::org_role[]));
CREATE TRIGGER vendors_updated_at BEFORE UPDATE ON public.vendors FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- BILLS
CREATE TABLE public.bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
  bill_number TEXT NOT NULL,
  vendor_reference TEXT,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  status public.bill_status NOT NULL DEFAULT 'open',
  currency TEXT NOT NULL DEFAULT 'USD',
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  total NUMERIC(14,2) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(14,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_bills_org ON public.bills(organization_id);
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
CREATE POLICY bills_select ON public.bills FOR SELECT TO authenticated USING (is_org_member(organization_id, auth.uid()));
CREATE POLICY bills_insert ON public.bills FOR INSERT TO authenticated WITH CHECK (has_org_role(organization_id, auth.uid(), ARRAY['owner','admin','accountant']::org_role[]));
CREATE POLICY bills_update ON public.bills FOR UPDATE TO authenticated USING (has_org_role(organization_id, auth.uid(), ARRAY['owner','admin','accountant']::org_role[]));
CREATE POLICY bills_delete ON public.bills FOR DELETE TO authenticated USING (has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::org_role[]));
CREATE TRIGGER bills_updated_at BEFORE UPDATE ON public.bills FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- BILL LINES
CREATE TABLE public.bill_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id UUID NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  position INT NOT NULL DEFAULT 0,
  description TEXT NOT NULL,
  quantity NUMERIC(14,3) NOT NULL DEFAULT 1,
  unit_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(6,3) NOT NULL DEFAULT 0,
  line_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_bill_lines_bill ON public.bill_lines(bill_id);
ALTER TABLE public.bill_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY bl_select ON public.bill_lines FOR SELECT TO authenticated USING (is_org_member(organization_id, auth.uid()));
CREATE POLICY bl_insert ON public.bill_lines FOR INSERT TO authenticated WITH CHECK (has_org_role(organization_id, auth.uid(), ARRAY['owner','admin','accountant']::org_role[]));
CREATE POLICY bl_update ON public.bill_lines FOR UPDATE TO authenticated USING (has_org_role(organization_id, auth.uid(), ARRAY['owner','admin','accountant']::org_role[]));
CREATE POLICY bl_delete ON public.bill_lines FOR DELETE TO authenticated USING (has_org_role(organization_id, auth.uid(), ARRAY['owner','admin','accountant']::org_role[]));

-- Bill numbering
CREATE OR REPLACE FUNCTION public.tg_bill_number()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE next_seq INT; yr TEXT := to_char(now(),'YYYY');
BEGIN
  IF NEW.bill_number IS NULL OR NEW.bill_number = '' THEN
    SELECT COALESCE(MAX(NULLIF(regexp_replace(bill_number,'^BILL-\d{4}-',''),'')::INT),0)+1
      INTO next_seq FROM public.bills
      WHERE organization_id = NEW.organization_id AND bill_number LIKE 'BILL-'||yr||'-%';
    NEW.bill_number := 'BILL-'||yr||'-'||lpad(next_seq::TEXT,4,'0');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_bill_number BEFORE INSERT ON public.bills FOR EACH ROW EXECUTE FUNCTION public.tg_bill_number();

-- Bill line total
CREATE OR REPLACE FUNCTION public.tg_set_bill_line_total()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.line_total := NEW.quantity * NEW.unit_price * (1 + NEW.tax_rate/100);
  RETURN NEW;
END $$;
CREATE TRIGGER trg_bill_line_total BEFORE INSERT OR UPDATE ON public.bill_lines FOR EACH ROW EXECUTE FUNCTION public.tg_set_bill_line_total();

-- Bill totals recompute
CREATE OR REPLACE FUNCTION public.tg_recompute_bill_totals()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE b UUID := COALESCE(NEW.bill_id, OLD.bill_id); v_sub NUMERIC(14,2); v_tax NUMERIC(14,2);
BEGIN
  SELECT COALESCE(SUM(quantity*unit_price),0), COALESCE(SUM(quantity*unit_price*tax_rate/100),0)
    INTO v_sub, v_tax FROM public.bill_lines WHERE bill_id = b;
  UPDATE public.bills SET subtotal = v_sub, tax_total = v_tax, total = v_sub + v_tax, updated_at = now()
    WHERE id = b;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_recompute_bill_totals AFTER INSERT OR UPDATE OR DELETE ON public.bill_lines FOR EACH ROW EXECUTE FUNCTION public.tg_recompute_bill_totals();

REVOKE EXECUTE ON FUNCTION public.tg_bill_number() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_set_bill_line_total() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_recompute_bill_totals() FROM PUBLIC, anon, authenticated;

-- EXPENSE CATEGORIES
CREATE TABLE public.expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY ec_select ON public.expense_categories FOR SELECT TO authenticated USING (is_org_member(organization_id, auth.uid()));
CREATE POLICY ec_insert ON public.expense_categories FOR INSERT TO authenticated WITH CHECK (has_org_role(organization_id, auth.uid(), ARRAY['owner','admin','accountant']::org_role[]));
CREATE POLICY ec_delete ON public.expense_categories FOR DELETE TO authenticated USING (has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::org_role[]));

-- EXPENSES
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
  category_id UUID REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  tax_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  payment_method public.payment_method NOT NULL DEFAULT 'bank_transfer',
  reference TEXT,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_expenses_org ON public.expenses(organization_id);
CREATE INDEX idx_expenses_date ON public.expenses(expense_date);
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY exp_select ON public.expenses FOR SELECT TO authenticated USING (is_org_member(organization_id, auth.uid()));
CREATE POLICY exp_insert ON public.expenses FOR INSERT TO authenticated WITH CHECK (has_org_role(organization_id, auth.uid(), ARRAY['owner','admin','accountant']::org_role[]));
CREATE POLICY exp_update ON public.expenses FOR UPDATE TO authenticated USING (has_org_role(organization_id, auth.uid(), ARRAY['owner','admin','accountant']::org_role[]));
CREATE POLICY exp_delete ON public.expenses FOR DELETE TO authenticated USING (has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::org_role[]));
CREATE TRIGGER expenses_updated_at BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Seed default expense categories for existing orgs and new orgs
CREATE OR REPLACE FUNCTION public.tg_seed_expense_categories()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.expense_categories (organization_id, name) VALUES
    (NEW.id, 'Office'), (NEW.id, 'Travel'), (NEW.id, 'Software'),
    (NEW.id, 'Meals'), (NEW.id, 'Marketing'), (NEW.id, 'Utilities')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_seed_expense_categories AFTER INSERT ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.tg_seed_expense_categories();
REVOKE EXECUTE ON FUNCTION public.tg_seed_expense_categories() FROM PUBLIC, anon, authenticated;

INSERT INTO public.expense_categories (organization_id, name)
SELECT o.id, c.name FROM public.organizations o
CROSS JOIN (VALUES ('Office'),('Travel'),('Software'),('Meals'),('Marketing'),('Utilities')) AS c(name)
ON CONFLICT DO NOTHING;