
-- ============ FX rates ============
CREATE TABLE public.fx_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  from_currency TEXT NOT NULL,
  to_currency TEXT NOT NULL,
  rate NUMERIC(18,8) NOT NULL,
  rate_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, from_currency, to_currency, rate_date)
);
ALTER TABLE public.fx_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY fx_select ON public.fx_rates FOR SELECT TO authenticated USING (is_org_member(organization_id, auth.uid()));
CREATE POLICY fx_insert ON public.fx_rates FOR INSERT TO authenticated WITH CHECK (has_org_role(organization_id, auth.uid(), ARRAY['owner','admin','accountant']::org_role[]));
CREATE POLICY fx_update ON public.fx_rates FOR UPDATE TO authenticated USING (has_org_role(organization_id, auth.uid(), ARRAY['owner','admin','accountant']::org_role[]));
CREATE POLICY fx_delete ON public.fx_rates FOR DELETE TO authenticated USING (has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::org_role[]));

ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(18,8) NOT NULL DEFAULT 1;
ALTER TABLE public.bills    ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(18,8) NOT NULL DEFAULT 1;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(18,8) NOT NULL DEFAULT 1;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(18,8) NOT NULL DEFAULT 1;

-- ============ Bill payments ============
CREATE TABLE public.bill_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  vendor_id UUID,
  amount NUMERIC(14,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  exchange_rate NUMERIC(18,8) NOT NULL DEFAULT 1,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  method payment_method NOT NULL DEFAULT 'bank_transfer',
  reference TEXT,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.bill_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY bp_select ON public.bill_payments FOR SELECT TO authenticated USING (is_org_member(organization_id, auth.uid()));
CREATE POLICY bp_insert ON public.bill_payments FOR INSERT TO authenticated WITH CHECK (has_org_role(organization_id, auth.uid(), ARRAY['owner','admin','accountant']::org_role[]));
CREATE POLICY bp_update ON public.bill_payments FOR UPDATE TO authenticated USING (has_org_role(organization_id, auth.uid(), ARRAY['owner','admin','accountant']::org_role[]));
CREATE POLICY bp_delete ON public.bill_payments FOR DELETE TO authenticated USING (has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::org_role[]));

CREATE TABLE public.bill_payment_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  bill_payment_id UUID NOT NULL,
  bill_id UUID NOT NULL,
  applied_amount NUMERIC(14,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.bill_payment_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY bpl_select ON public.bill_payment_links FOR SELECT TO authenticated USING (is_org_member(organization_id, auth.uid()));
CREATE POLICY bpl_insert ON public.bill_payment_links FOR INSERT TO authenticated WITH CHECK (has_org_role(organization_id, auth.uid(), ARRAY['owner','admin','accountant']::org_role[]));
CREATE POLICY bpl_update ON public.bill_payment_links FOR UPDATE TO authenticated USING (has_org_role(organization_id, auth.uid(), ARRAY['owner','admin','accountant']::org_role[]));
CREATE POLICY bpl_delete ON public.bill_payment_links FOR DELETE TO authenticated USING (has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::org_role[]));

-- Recompute bills.amount_paid + status on link change
CREATE OR REPLACE FUNCTION public.tg_recompute_bill_paid()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE b UUID := COALESCE(NEW.bill_id, OLD.bill_id); v_paid NUMERIC(14,2); v_total NUMERIC(14,2); v_status bill_status;
BEGIN
  SELECT COALESCE(SUM(applied_amount),0) INTO v_paid FROM public.bill_payment_links WHERE bill_id = b;
  SELECT total INTO v_total FROM public.bills WHERE id = b;
  IF v_paid <= 0 THEN v_status := 'open';
  ELSIF v_paid >= v_total THEN v_status := 'paid';
  ELSE v_status := 'partial';
  END IF;
  UPDATE public.bills SET amount_paid = v_paid,
    status = CASE WHEN status = 'void' THEN 'void' ELSE v_status END,
    updated_at = now() WHERE id = b;
  RETURN NULL;
END $$;

CREATE TRIGGER trg_bpl_recompute AFTER INSERT OR UPDATE OR DELETE ON public.bill_payment_links
FOR EACH ROW EXECUTE FUNCTION public.tg_recompute_bill_paid();

-- ============ Attachments ============
CREATE TABLE public.attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  entity_type TEXT NOT NULL,  -- 'invoice','bill','expense','payment'
  entity_id UUID NOT NULL,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY att_select ON public.attachments FOR SELECT TO authenticated USING (is_org_member(organization_id, auth.uid()));
CREATE POLICY att_insert ON public.attachments FOR INSERT TO authenticated WITH CHECK (is_org_member(organization_id, auth.uid()) AND uploaded_by = auth.uid());
CREATE POLICY att_delete ON public.attachments FOR DELETE TO authenticated USING (has_org_role(organization_id, auth.uid(), ARRAY['owner','admin','accountant']::org_role[]));

INSERT INTO storage.buckets (id, name, public) VALUES ('attachments', 'attachments', false) ON CONFLICT (id) DO NOTHING;

CREATE POLICY att_storage_select ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'attachments' AND EXISTS (
  SELECT 1 FROM public.attachments a WHERE a.storage_path = name AND is_org_member(a.organization_id, auth.uid())
));
CREATE POLICY att_storage_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'attachments' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY att_storage_delete ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'attachments' AND EXISTS (
  SELECT 1 FROM public.attachments a WHERE a.storage_path = name AND has_org_role(a.organization_id, auth.uid(), ARRAY['owner','admin','accountant']::org_role[])
));

-- ============ Quotes ============
CREATE TYPE quote_status AS ENUM ('draft','sent','accepted','rejected','expired','converted');
CREATE TABLE public.quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  customer_id UUID,
  quote_number TEXT NOT NULL,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expiry_date DATE,
  status quote_status NOT NULL DEFAULT 'draft',
  currency TEXT NOT NULL DEFAULT 'USD',
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  total NUMERIC(14,2) NOT NULL DEFAULT 0,
  notes TEXT,
  converted_invoice_id UUID,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.quote_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  quote_id UUID NOT NULL,
  position INT NOT NULL DEFAULT 0,
  description TEXT NOT NULL,
  quantity NUMERIC(14,3) NOT NULL DEFAULT 1,
  unit_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  line_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY q_select ON public.quotes FOR SELECT TO authenticated USING (is_org_member(organization_id, auth.uid()));
CREATE POLICY q_ins ON public.quotes FOR INSERT TO authenticated WITH CHECK (has_org_role(organization_id, auth.uid(), ARRAY['owner','admin','accountant','sales']::org_role[]));
CREATE POLICY q_upd ON public.quotes FOR UPDATE TO authenticated USING (has_org_role(organization_id, auth.uid(), ARRAY['owner','admin','accountant','sales']::org_role[]));
CREATE POLICY q_del ON public.quotes FOR DELETE TO authenticated USING (has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::org_role[]));
CREATE POLICY ql_select ON public.quote_lines FOR SELECT TO authenticated USING (is_org_member(organization_id, auth.uid()));
CREATE POLICY ql_ins ON public.quote_lines FOR INSERT TO authenticated WITH CHECK (has_org_role(organization_id, auth.uid(), ARRAY['owner','admin','accountant','sales']::org_role[]));
CREATE POLICY ql_upd ON public.quote_lines FOR UPDATE TO authenticated USING (has_org_role(organization_id, auth.uid(), ARRAY['owner','admin','accountant','sales']::org_role[]));
CREATE POLICY ql_del ON public.quote_lines FOR DELETE TO authenticated USING (has_org_role(organization_id, auth.uid(), ARRAY['owner','admin','accountant','sales']::org_role[]));

-- ============ Purchase Orders ============
CREATE TYPE po_status AS ENUM ('draft','sent','received','closed','cancelled');
CREATE TABLE public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  vendor_id UUID,
  po_number TEXT NOT NULL,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_date DATE,
  status po_status NOT NULL DEFAULT 'draft',
  currency TEXT NOT NULL DEFAULT 'USD',
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  total NUMERIC(14,2) NOT NULL DEFAULT 0,
  notes TEXT,
  converted_bill_id UUID,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.po_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  po_id UUID NOT NULL,
  position INT NOT NULL DEFAULT 0,
  product_id UUID,
  description TEXT NOT NULL,
  quantity NUMERIC(14,3) NOT NULL DEFAULT 1,
  unit_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  line_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.po_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY po_select ON public.purchase_orders FOR SELECT TO authenticated USING (is_org_member(organization_id, auth.uid()));
CREATE POLICY po_ins ON public.purchase_orders FOR INSERT TO authenticated WITH CHECK (has_org_role(organization_id, auth.uid(), ARRAY['owner','admin','accountant']::org_role[]));
CREATE POLICY po_upd ON public.purchase_orders FOR UPDATE TO authenticated USING (has_org_role(organization_id, auth.uid(), ARRAY['owner','admin','accountant']::org_role[]));
CREATE POLICY po_del ON public.purchase_orders FOR DELETE TO authenticated USING (has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::org_role[]));
CREATE POLICY pol_select ON public.po_lines FOR SELECT TO authenticated USING (is_org_member(organization_id, auth.uid()));
CREATE POLICY pol_ins ON public.po_lines FOR INSERT TO authenticated WITH CHECK (has_org_role(organization_id, auth.uid(), ARRAY['owner','admin','accountant']::org_role[]));
CREATE POLICY pol_upd ON public.po_lines FOR UPDATE TO authenticated USING (has_org_role(organization_id, auth.uid(), ARRAY['owner','admin','accountant']::org_role[]));
CREATE POLICY pol_del ON public.po_lines FOR DELETE TO authenticated USING (has_org_role(organization_id, auth.uid(), ARRAY['owner','admin','accountant']::org_role[]));

-- ============ Credit Notes ============
CREATE TYPE credit_note_status AS ENUM ('draft','issued','applied','void');
CREATE TABLE public.credit_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  customer_id UUID,
  invoice_id UUID,
  credit_number TEXT NOT NULL,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status credit_note_status NOT NULL DEFAULT 'draft',
  currency TEXT NOT NULL DEFAULT 'USD',
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  total NUMERIC(14,2) NOT NULL DEFAULT 0,
  reason TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.credit_note_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  credit_note_id UUID NOT NULL,
  position INT NOT NULL DEFAULT 0,
  description TEXT NOT NULL,
  quantity NUMERIC(14,3) NOT NULL DEFAULT 1,
  unit_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  line_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.credit_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_note_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY cn_select ON public.credit_notes FOR SELECT TO authenticated USING (is_org_member(organization_id, auth.uid()));
CREATE POLICY cn_ins ON public.credit_notes FOR INSERT TO authenticated WITH CHECK (has_org_role(organization_id, auth.uid(), ARRAY['owner','admin','accountant','sales']::org_role[]));
CREATE POLICY cn_upd ON public.credit_notes FOR UPDATE TO authenticated USING (has_org_role(organization_id, auth.uid(), ARRAY['owner','admin','accountant','sales']::org_role[]));
CREATE POLICY cn_del ON public.credit_notes FOR DELETE TO authenticated USING (has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::org_role[]));
CREATE POLICY cnl_select ON public.credit_note_lines FOR SELECT TO authenticated USING (is_org_member(organization_id, auth.uid()));
CREATE POLICY cnl_ins ON public.credit_note_lines FOR INSERT TO authenticated WITH CHECK (has_org_role(organization_id, auth.uid(), ARRAY['owner','admin','accountant','sales']::org_role[]));
CREATE POLICY cnl_upd ON public.credit_note_lines FOR UPDATE TO authenticated USING (has_org_role(organization_id, auth.uid(), ARRAY['owner','admin','accountant','sales']::org_role[]));
CREATE POLICY cnl_del ON public.credit_note_lines FOR DELETE TO authenticated USING (has_org_role(organization_id, auth.uid(), ARRAY['owner','admin','accountant','sales']::org_role[]));

-- ============ Recurring Invoices ============
CREATE TABLE public.recurring_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  customer_id UUID,
  name TEXT NOT NULL,
  frequency TEXT NOT NULL,           -- weekly, monthly, quarterly, yearly
  next_run_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  currency TEXT NOT NULL DEFAULT 'USD',
  template JSONB NOT NULL,           -- {lines:[{description,quantity,unit_price,tax_rate}], notes}
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.recurring_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY ri_select ON public.recurring_invoices FOR SELECT TO authenticated USING (is_org_member(organization_id, auth.uid()));
CREATE POLICY ri_ins ON public.recurring_invoices FOR INSERT TO authenticated WITH CHECK (has_org_role(organization_id, auth.uid(), ARRAY['owner','admin','accountant','sales']::org_role[]));
CREATE POLICY ri_upd ON public.recurring_invoices FOR UPDATE TO authenticated USING (has_org_role(organization_id, auth.uid(), ARRAY['owner','admin','accountant','sales']::org_role[]));
CREATE POLICY ri_del ON public.recurring_invoices FOR DELETE TO authenticated USING (has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::org_role[]));

-- ============ Numbering triggers ============
CREATE OR REPLACE FUNCTION public.tg_quote_number() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE next_seq INT; yr TEXT := to_char(now(),'YYYY');
BEGIN
  IF NEW.quote_number IS NULL OR NEW.quote_number = '' THEN
    SELECT COALESCE(MAX(NULLIF(regexp_replace(quote_number,'^Q-\d{4}-',''),'')::INT),0)+1 INTO next_seq
      FROM public.quotes WHERE organization_id = NEW.organization_id AND quote_number LIKE 'Q-'||yr||'-%';
    NEW.quote_number := 'Q-'||yr||'-'||lpad(next_seq::TEXT,4,'0');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_quote_num BEFORE INSERT ON public.quotes FOR EACH ROW EXECUTE FUNCTION public.tg_quote_number();

CREATE OR REPLACE FUNCTION public.tg_po_number() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE next_seq INT; yr TEXT := to_char(now(),'YYYY');
BEGIN
  IF NEW.po_number IS NULL OR NEW.po_number = '' THEN
    SELECT COALESCE(MAX(NULLIF(regexp_replace(po_number,'^PO-\d{4}-',''),'')::INT),0)+1 INTO next_seq
      FROM public.purchase_orders WHERE organization_id = NEW.organization_id AND po_number LIKE 'PO-'||yr||'-%';
    NEW.po_number := 'PO-'||yr||'-'||lpad(next_seq::TEXT,4,'0');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_po_num BEFORE INSERT ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.tg_po_number();

CREATE OR REPLACE FUNCTION public.tg_cn_number() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE next_seq INT; yr TEXT := to_char(now(),'YYYY');
BEGIN
  IF NEW.credit_number IS NULL OR NEW.credit_number = '' THEN
    SELECT COALESCE(MAX(NULLIF(regexp_replace(credit_number,'^CN-\d{4}-',''),'')::INT),0)+1 INTO next_seq
      FROM public.credit_notes WHERE organization_id = NEW.organization_id AND credit_number LIKE 'CN-'||yr||'-%';
    NEW.credit_number := 'CN-'||yr||'-'||lpad(next_seq::TEXT,4,'0');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_cn_num BEFORE INSERT ON public.credit_notes FOR EACH ROW EXECUTE FUNCTION public.tg_cn_number();

-- ============ Line total + totals recompute for quotes/POs/CNs ============
CREATE OR REPLACE FUNCTION public.tg_set_simple_line_total() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN NEW.line_total := NEW.quantity * NEW.unit_price * (1 + NEW.tax_rate/100); RETURN NEW; END $$;
CREATE TRIGGER trg_ql_total BEFORE INSERT OR UPDATE ON public.quote_lines FOR EACH ROW EXECUTE FUNCTION public.tg_set_simple_line_total();
CREATE TRIGGER trg_pol_total BEFORE INSERT OR UPDATE ON public.po_lines FOR EACH ROW EXECUTE FUNCTION public.tg_set_simple_line_total();
CREATE TRIGGER trg_cnl_total BEFORE INSERT OR UPDATE ON public.credit_note_lines FOR EACH ROW EXECUTE FUNCTION public.tg_set_simple_line_total();

CREATE OR REPLACE FUNCTION public.tg_recompute_quote_totals() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE q UUID := COALESCE(NEW.quote_id, OLD.quote_id); v_sub NUMERIC(14,2); v_tax NUMERIC(14,2);
BEGIN
  SELECT COALESCE(SUM(quantity*unit_price),0), COALESCE(SUM(quantity*unit_price*tax_rate/100),0)
    INTO v_sub, v_tax FROM public.quote_lines WHERE quote_id = q;
  UPDATE public.quotes SET subtotal=v_sub, tax_total=v_tax, total=v_sub+v_tax, updated_at=now() WHERE id=q;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_ql_recompute AFTER INSERT OR UPDATE OR DELETE ON public.quote_lines FOR EACH ROW EXECUTE FUNCTION public.tg_recompute_quote_totals();

CREATE OR REPLACE FUNCTION public.tg_recompute_po_totals() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE q UUID := COALESCE(NEW.po_id, OLD.po_id); v_sub NUMERIC(14,2); v_tax NUMERIC(14,2);
BEGIN
  SELECT COALESCE(SUM(quantity*unit_price),0), COALESCE(SUM(quantity*unit_price*tax_rate/100),0)
    INTO v_sub, v_tax FROM public.po_lines WHERE po_id = q;
  UPDATE public.purchase_orders SET subtotal=v_sub, tax_total=v_tax, total=v_sub+v_tax, updated_at=now() WHERE id=q;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_pol_recompute AFTER INSERT OR UPDATE OR DELETE ON public.po_lines FOR EACH ROW EXECUTE FUNCTION public.tg_recompute_po_totals();

CREATE OR REPLACE FUNCTION public.tg_recompute_cn_totals() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE q UUID := COALESCE(NEW.credit_note_id, OLD.credit_note_id); v_sub NUMERIC(14,2); v_tax NUMERIC(14,2);
BEGIN
  SELECT COALESCE(SUM(quantity*unit_price),0), COALESCE(SUM(quantity*unit_price*tax_rate/100),0)
    INTO v_sub, v_tax FROM public.credit_note_lines WHERE credit_note_id = q;
  UPDATE public.credit_notes SET subtotal=v_sub, tax_total=v_tax, total=v_sub+v_tax, updated_at=now() WHERE id=q;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_cnl_recompute AFTER INSERT OR UPDATE OR DELETE ON public.credit_note_lines FOR EACH ROW EXECUTE FUNCTION public.tg_recompute_cn_totals();

-- ============ Auto GL posting helper ============
CREATE OR REPLACE FUNCTION public.get_account_id(_org UUID, _code TEXT) RETURNS UUID LANGUAGE sql STABLE SET search_path=public AS $$
  SELECT id FROM public.accounts WHERE organization_id = _org AND code = _code LIMIT 1;
$$;

-- Post invoice: DR AR, CR Revenue, CR Tax Payable
CREATE OR REPLACE FUNCTION public.tg_post_invoice_je() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE je UUID; ar UUID; rev UUID; tax UUID; v_total NUMERIC(14,2); v_sub NUMERIC(14,2); v_tax NUMERIC(14,2);
BEGIN
  SELECT subtotal, tax_total, total INTO v_sub, v_tax, v_total FROM public.invoices WHERE id = NEW.id;
  IF COALESCE(v_total,0) = 0 THEN RETURN NEW; END IF;
  ar  := public.get_account_id(NEW.organization_id, '1200');
  rev := public.get_account_id(NEW.organization_id, '4000');
  tax := public.get_account_id(NEW.organization_id, '2100');
  IF ar IS NULL OR rev IS NULL OR tax IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.journal_entries (organization_id, entry_date, reference, memo, is_posted, created_by)
    VALUES (NEW.organization_id, NEW.issue_date, NEW.invoice_number, 'Auto: invoice '||NEW.invoice_number, false, NEW.created_by)
    RETURNING id INTO je;
  INSERT INTO public.journal_lines (organization_id, entry_id, account_id, debit, credit, position, description) VALUES
    (NEW.organization_id, je, ar,  v_total, 0, 1, 'AR'),
    (NEW.organization_id, je, rev, 0, v_sub, 2, 'Revenue'),
    (NEW.organization_id, je, tax, 0, v_tax, 3, 'Tax Payable');
  UPDATE public.journal_entries SET is_posted = true WHERE id = je;
  RETURN NEW;
END $$;

-- Post bill: DR Expense, DR Tax Payable, CR AP
CREATE OR REPLACE FUNCTION public.tg_post_bill_je() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE je UUID; ap UUID; exp UUID; tax UUID; v_sub NUMERIC(14,2); v_tax NUMERIC(14,2); v_total NUMERIC(14,2);
BEGIN
  SELECT subtotal, tax_total, total INTO v_sub, v_tax, v_total FROM public.bills WHERE id = NEW.id;
  IF COALESCE(v_total,0) = 0 THEN RETURN NEW; END IF;
  ap  := public.get_account_id(NEW.organization_id, '2000');
  exp := public.get_account_id(NEW.organization_id, '6000');
  tax := public.get_account_id(NEW.organization_id, '2100');
  IF ap IS NULL OR exp IS NULL OR tax IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.journal_entries (organization_id, entry_date, reference, memo, is_posted, created_by)
    VALUES (NEW.organization_id, NEW.issue_date, NEW.bill_number, 'Auto: bill '||NEW.bill_number, false, NEW.created_by)
    RETURNING id INTO je;
  INSERT INTO public.journal_lines (organization_id, entry_id, account_id, debit, credit, position, description) VALUES
    (NEW.organization_id, je, exp, v_sub, 0, 1, 'Expense'),
    (NEW.organization_id, je, tax, v_tax, 0, 2, 'Tax'),
    (NEW.organization_id, je, ap,  0, v_total, 3, 'AP');
  UPDATE public.journal_entries SET is_posted = true WHERE id = je;
  RETURN NEW;
END $$;

-- Post customer payment: DR Bank, CR AR
CREATE OR REPLACE FUNCTION public.tg_post_payment_je() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE je UUID; bank UUID; ar UUID;
BEGIN
  bank := public.get_account_id(NEW.organization_id, '1010');
  ar   := public.get_account_id(NEW.organization_id, '1200');
  IF bank IS NULL OR ar IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.journal_entries (organization_id, entry_date, reference, memo, is_posted, created_by)
    VALUES (NEW.organization_id, NEW.payment_date, NEW.reference, 'Auto: customer payment', false, NEW.created_by)
    RETURNING id INTO je;
  INSERT INTO public.journal_lines (organization_id, entry_id, account_id, debit, credit, position, description) VALUES
    (NEW.organization_id, je, bank, NEW.amount, 0, 1, 'Bank'),
    (NEW.organization_id, je, ar,   0, NEW.amount, 2, 'AR');
  UPDATE public.journal_entries SET is_posted = true WHERE id = je;
  RETURN NEW;
END $$;

-- Post bill payment: DR AP, CR Bank
CREATE OR REPLACE FUNCTION public.tg_post_bill_payment_je() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE je UUID; bank UUID; ap UUID;
BEGIN
  bank := public.get_account_id(NEW.organization_id, '1010');
  ap   := public.get_account_id(NEW.organization_id, '2000');
  IF bank IS NULL OR ap IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.journal_entries (organization_id, entry_date, reference, memo, is_posted, created_by)
    VALUES (NEW.organization_id, NEW.payment_date, NEW.reference, 'Auto: vendor payment', false, NEW.created_by)
    RETURNING id INTO je;
  INSERT INTO public.journal_lines (organization_id, entry_id, account_id, debit, credit, position, description) VALUES
    (NEW.organization_id, je, ap,   NEW.amount, 0, 1, 'AP'),
    (NEW.organization_id, je, bank, 0, NEW.amount, 2, 'Bank');
  UPDATE public.journal_entries SET is_posted = true WHERE id = je;
  RETURN NEW;
END $$;

-- Post expense: DR Expense, CR Bank
CREATE OR REPLACE FUNCTION public.tg_post_expense_je() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE je UUID; bank UUID; exp UUID;
BEGIN
  bank := public.get_account_id(NEW.organization_id, '1010');
  exp  := public.get_account_id(NEW.organization_id, '6000');
  IF bank IS NULL OR exp IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.journal_entries (organization_id, entry_date, reference, memo, is_posted, created_by)
    VALUES (NEW.organization_id, NEW.expense_date, NEW.reference, COALESCE('Auto: '||NEW.description,'Auto: expense'), false, NEW.created_by)
    RETURNING id INTO je;
  INSERT INTO public.journal_lines (organization_id, entry_id, account_id, debit, credit, position, description) VALUES
    (NEW.organization_id, je, exp,  NEW.amount + NEW.tax_amount, 0, 1, 'Expense'),
    (NEW.organization_id, je, bank, 0, NEW.amount + NEW.tax_amount, 2, 'Bank');
  UPDATE public.journal_entries SET is_posted = true WHERE id = je;
  RETURN NEW;
END $$;

-- Fire posting AFTER totals settle. Invoices/bills fire on UPDATE of subtotal/total too late from line triggers,
-- so we post on first INSERT and re-post (delete prior auto) when totals change is acceptable simple impl: skip re-post.
CREATE TRIGGER trg_post_invoice_je AFTER INSERT ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.tg_post_invoice_je();
CREATE TRIGGER trg_post_bill_je    AFTER INSERT ON public.bills    FOR EACH ROW EXECUTE FUNCTION public.tg_post_bill_je();
CREATE TRIGGER trg_post_payment_je AFTER INSERT ON public.payments FOR EACH ROW EXECUTE FUNCTION public.tg_post_payment_je();
CREATE TRIGGER trg_post_bp_je      AFTER INSERT ON public.bill_payments FOR EACH ROW EXECUTE FUNCTION public.tg_post_bill_payment_je();
CREATE TRIGGER trg_post_exp_je     AFTER INSERT ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.tg_post_expense_je();

-- Re-post when invoice/bill totals change (delete prior auto JE for same reference, repost)
CREATE OR REPLACE FUNCTION public.tg_repost_invoice_je() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.total IS DISTINCT FROM OLD.total THEN
    DELETE FROM public.journal_entries WHERE organization_id=NEW.organization_id AND reference=NEW.invoice_number AND memo LIKE 'Auto: invoice%';
    PERFORM public.tg_post_invoice_je_manual(NEW.id);
  END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.tg_post_invoice_je_manual(_id UUID) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r record; je UUID; ar UUID; rev UUID; tax UUID;
BEGIN
  SELECT * INTO r FROM public.invoices WHERE id=_id;
  IF r.total = 0 THEN RETURN; END IF;
  ar := public.get_account_id(r.organization_id,'1200');
  rev:= public.get_account_id(r.organization_id,'4000');
  tax:= public.get_account_id(r.organization_id,'2100');
  IF ar IS NULL OR rev IS NULL OR tax IS NULL THEN RETURN; END IF;
  INSERT INTO public.journal_entries (organization_id, entry_date, reference, memo, is_posted, created_by)
    VALUES (r.organization_id, r.issue_date, r.invoice_number, 'Auto: invoice '||r.invoice_number, false, r.created_by)
    RETURNING id INTO je;
  INSERT INTO public.journal_lines (organization_id, entry_id, account_id, debit, credit, position, description) VALUES
    (r.organization_id, je, ar, r.total, 0, 1, 'AR'),
    (r.organization_id, je, rev, 0, r.subtotal, 2, 'Revenue'),
    (r.organization_id, je, tax, 0, r.tax_total, 3, 'Tax');
  UPDATE public.journal_entries SET is_posted=true WHERE id=je;
END $$;
CREATE TRIGGER trg_repost_invoice AFTER UPDATE OF total ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.tg_repost_invoice_je();

-- ============ Auto inventory + COGS from invoice lines ============
ALTER TABLE public.invoice_lines ADD COLUMN IF NOT EXISTS product_id UUID;
ALTER TABLE public.bill_lines    ADD COLUMN IF NOT EXISTS product_id UUID;

CREATE OR REPLACE FUNCTION public.tg_invline_inventory() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p record; loc UUID; je UUID; cogs UUID; inv_acc UUID; v_cost NUMERIC(14,2);
BEGIN
  IF NEW.product_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO p FROM public.products WHERE id = NEW.product_id;
  IF NOT FOUND OR NOT p.track_inventory THEN RETURN NEW; END IF;
  SELECT id INTO loc FROM public.inventory_locations WHERE organization_id=NEW.organization_id AND is_default LIMIT 1;
  IF loc IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.inventory_movements (organization_id, product_id, location_id, movement_type, quantity, unit_cost, reference, notes, created_by)
    VALUES (NEW.organization_id, NEW.product_id, loc, 'issue', NEW.quantity, p.cost_price, 'invoice-line', 'Auto from invoice', (SELECT created_by FROM public.invoices WHERE id=NEW.invoice_id));
  -- COGS posting
  v_cost := NEW.quantity * p.cost_price;
  IF v_cost > 0 THEN
    cogs    := public.get_account_id(NEW.organization_id, '5000');
    inv_acc := public.get_account_id(NEW.organization_id, '1400');
    IF cogs IS NOT NULL AND inv_acc IS NOT NULL THEN
      INSERT INTO public.journal_entries (organization_id, entry_date, reference, memo, is_posted, created_by)
        VALUES (NEW.organization_id, CURRENT_DATE, 'cogs-'||NEW.id, 'Auto: COGS', false, (SELECT created_by FROM public.invoices WHERE id=NEW.invoice_id))
        RETURNING id INTO je;
      INSERT INTO public.journal_lines (organization_id, entry_id, account_id, debit, credit, position, description) VALUES
        (NEW.organization_id, je, cogs,    v_cost, 0, 1, 'COGS'),
        (NEW.organization_id, je, inv_acc, 0, v_cost, 2, 'Inventory');
      UPDATE public.journal_entries SET is_posted=true WHERE id=je;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_invline_inventory AFTER INSERT ON public.invoice_lines FOR EACH ROW EXECUTE FUNCTION public.tg_invline_inventory();

CREATE OR REPLACE FUNCTION public.tg_billline_inventory() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p record; loc UUID;
BEGIN
  IF NEW.product_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO p FROM public.products WHERE id = NEW.product_id;
  IF NOT FOUND OR NOT p.track_inventory THEN RETURN NEW; END IF;
  SELECT id INTO loc FROM public.inventory_locations WHERE organization_id=NEW.organization_id AND is_default LIMIT 1;
  IF loc IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.inventory_movements (organization_id, product_id, location_id, movement_type, quantity, unit_cost, reference, notes, created_by)
    VALUES (NEW.organization_id, NEW.product_id, loc, 'receipt', NEW.quantity, NEW.unit_price, 'bill-line', 'Auto from bill', (SELECT created_by FROM public.bills WHERE id=NEW.bill_id));
  RETURN NEW;
END $$;
CREATE TRIGGER trg_billline_inventory AFTER INSERT ON public.bill_lines FOR EACH ROW EXECUTE FUNCTION public.tg_billline_inventory();

-- updated_at triggers
CREATE TRIGGER trg_bp_upd BEFORE UPDATE ON public.bill_payments FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_q_upd BEFORE UPDATE ON public.quotes FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_po_upd BEFORE UPDATE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_cn_upd BEFORE UPDATE ON public.credit_notes FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_ri_upd BEFORE UPDATE ON public.recurring_invoices FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
