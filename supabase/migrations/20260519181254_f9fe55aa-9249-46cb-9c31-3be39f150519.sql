
CREATE TYPE public.invoice_status AS ENUM ('draft','sent','partial','paid','void');
CREATE TYPE public.payment_method AS ENUM ('cash','bank_transfer','card','upi','cheque','other');

CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  billing_name TEXT NOT NULL,
  email TEXT, phone TEXT, billing_address TEXT, tax_id TEXT,
  currency TEXT NOT NULL DEFAULT 'USD',
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_customers_org ON public.customers(organization_id);
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "customers_select" ON public.customers FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "customers_insert" ON public.customers FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin','accountant','sales']::org_role[]));
CREATE POLICY "customers_update" ON public.customers FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin','accountant','sales']::org_role[]));
CREATE POLICY "customers_delete" ON public.customers FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::org_role[]));
CREATE TRIGGER customers_updated BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  invoice_number TEXT NOT NULL,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  status public.invoice_status NOT NULL DEFAULT 'draft',
  currency TEXT NOT NULL DEFAULT 'USD',
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  total NUMERIC(14,2) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(14,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, invoice_number)
);
CREATE INDEX idx_invoices_org ON public.invoices(organization_id);
CREATE INDEX idx_invoices_customer ON public.invoices(customer_id);
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invoices_select" ON public.invoices FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "invoices_insert" ON public.invoices FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin','accountant','sales']::org_role[]));
CREATE POLICY "invoices_update" ON public.invoices FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin','accountant','sales']::org_role[]));
CREATE POLICY "invoices_delete" ON public.invoices FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::org_role[]));
CREATE TRIGGER invoices_updated BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE OR REPLACE FUNCTION public.tg_invoice_number()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  next_seq INT;
  yr TEXT := to_char(now(),'YYYY');
BEGIN
  IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
    SELECT COALESCE(MAX(NULLIF(regexp_replace(invoice_number,'^INV-\d{4}-',''),'')::INT),0)+1
      INTO next_seq
      FROM public.invoices
      WHERE organization_id = NEW.organization_id
        AND invoice_number LIKE 'INV-'||yr||'-%';
    NEW.invoice_number := 'INV-'||yr||'-'||lpad(next_seq::TEXT,4,'0');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER invoices_set_number BEFORE INSERT ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.tg_invoice_number();

CREATE TABLE public.invoice_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  position INT NOT NULL DEFAULT 0,
  description TEXT NOT NULL,
  quantity NUMERIC(14,3) NOT NULL DEFAULT 1,
  unit_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(6,3) NOT NULL DEFAULT 0,
  line_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_lines_invoice ON public.invoice_lines(invoice_id);
ALTER TABLE public.invoice_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lines_select" ON public.invoice_lines FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "lines_insert" ON public.invoice_lines FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin','accountant','sales']::org_role[]));
CREATE POLICY "lines_update" ON public.invoice_lines FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin','accountant','sales']::org_role[]));
CREATE POLICY "lines_delete" ON public.invoice_lines FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin','accountant','sales']::org_role[]));

CREATE OR REPLACE FUNCTION public.tg_recompute_invoice_totals()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  inv UUID := COALESCE(NEW.invoice_id, OLD.invoice_id);
  v_sub NUMERIC(14,2); v_tax NUMERIC(14,2);
BEGIN
  SELECT
    COALESCE(SUM(quantity*unit_price),0),
    COALESCE(SUM(quantity*unit_price*tax_rate/100),0)
  INTO v_sub, v_tax
  FROM public.invoice_lines WHERE invoice_id = inv;
  UPDATE public.invoices
    SET subtotal = v_sub, tax_total = v_tax, total = v_sub + v_tax, updated_at = now()
    WHERE id = inv;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.tg_set_line_total()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.line_total := NEW.quantity * NEW.unit_price * (1 + NEW.tax_rate/100);
  RETURN NEW;
END $$;

CREATE TRIGGER lines_set_total BEFORE INSERT OR UPDATE ON public.invoice_lines
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_line_total();
CREATE TRIGGER lines_recompute AFTER INSERT OR UPDATE OR DELETE ON public.invoice_lines
  FOR EACH ROW EXECUTE FUNCTION public.tg_recompute_invoice_totals();

CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  amount NUMERIC(14,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  method public.payment_method NOT NULL DEFAULT 'bank_transfer',
  reference TEXT, notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_payments_org ON public.payments(organization_id);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payments_select" ON public.payments FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "payments_insert" ON public.payments FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin','accountant','sales']::org_role[]));
CREATE POLICY "payments_update" ON public.payments FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin','accountant','sales']::org_role[]));
CREATE POLICY "payments_delete" ON public.payments FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::org_role[]));
CREATE TRIGGER payments_updated BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.payment_invoice_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  applied_amount NUMERIC(14,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(payment_id, invoice_id)
);
CREATE INDEX idx_pil_inv ON public.payment_invoice_links(invoice_id);
ALTER TABLE public.payment_invoice_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pil_select" ON public.payment_invoice_links FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "pil_insert" ON public.payment_invoice_links FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin','accountant','sales']::org_role[]));
CREATE POLICY "pil_update" ON public.payment_invoice_links FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin','accountant','sales']::org_role[]));
CREATE POLICY "pil_delete" ON public.payment_invoice_links FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::org_role[]));

CREATE OR REPLACE FUNCTION public.tg_recompute_invoice_paid()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  inv UUID := COALESCE(NEW.invoice_id, OLD.invoice_id);
  v_paid NUMERIC(14,2); v_total NUMERIC(14,2); v_status public.invoice_status;
BEGIN
  SELECT COALESCE(SUM(applied_amount),0) INTO v_paid
    FROM public.payment_invoice_links WHERE invoice_id = inv;
  SELECT total INTO v_total FROM public.invoices WHERE id = inv;
  IF v_paid <= 0 THEN v_status := 'draft';
  ELSIF v_paid >= v_total THEN v_status := 'paid';
  ELSE v_status := 'partial';
  END IF;
  UPDATE public.invoices
    SET amount_paid = v_paid,
        status = CASE WHEN status = 'void' THEN 'void' ELSE v_status END,
        updated_at = now()
    WHERE id = inv;
  RETURN NULL;
END $$;
CREATE TRIGGER pil_recompute AFTER INSERT OR UPDATE OR DELETE ON public.payment_invoice_links
  FOR EACH ROW EXECUTE FUNCTION public.tg_recompute_invoice_paid();
