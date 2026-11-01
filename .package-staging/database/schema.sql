-- =============================================================================
-- Equity.AI â€” Database schema (creates the database from scratch)
-- =============================================================================
-- Generated from supabase/migrations/*.sql in timestamp order.
--
-- HOW TO RUN:
--   Supabase:      Open the SQL Editor and paste this whole file, then run it.
--   Plain psql:    psql "$DATABASE_URL" -f schema.sql
--                  (requires a Supabase-compatible Postgres: the schema
--                  references auth.users, auth.uid() and the storage schema,
--                  which exist in every Supabase project.)
--
-- After this script, run seed.sql to create demo data.
-- =============================================================================

-- ----------------------------------------------------------
-- Migration: 20260519180539_ b0b0ed7-01f5-4693-b0e7-e22414a449b7
-- ----------------------------------------------------------

-- Enums
CREATE TYPE public.org_role AS ENUM ('owner','admin','accountant','sales','viewer');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_self" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_update_self" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_insert_self" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Organizations
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'US',
  currency TEXT NOT NULL DEFAULT 'USD',
  tax_regime TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Org members
CREATE TABLE public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.org_role NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, user_id)
);
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- Security definer helpers (avoid recursive RLS)
CREATE OR REPLACE FUNCTION public.is_org_member(_org UUID, _user UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.organization_members WHERE organization_id = _org AND user_id = _user);
$$;

CREATE OR REPLACE FUNCTION public.has_org_role(_org UUID, _user UUID, _roles public.org_role[])
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.organization_members WHERE organization_id = _org AND user_id = _user AND role = ANY(_roles));
$$;

-- Org policies
CREATE POLICY "org_select_members" ON public.organizations FOR SELECT TO authenticated
  USING (public.is_org_member(id, auth.uid()));
CREATE POLICY "org_insert_self" ON public.organizations FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
CREATE POLICY "org_update_admins" ON public.organizations FOR UPDATE TO authenticated
  USING (public.has_org_role(id, auth.uid(), ARRAY['owner','admin']::public.org_role[]));
CREATE POLICY "org_delete_owners" ON public.organizations FOR DELETE TO authenticated
  USING (public.has_org_role(id, auth.uid(), ARRAY['owner']::public.org_role[]));

-- Member policies
CREATE POLICY "members_select_same_org" ON public.organization_members FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "members_insert_admins_or_self" ON public.organization_members FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() OR public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::public.org_role[])
  );
CREATE POLICY "members_update_admins" ON public.organization_members FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::public.org_role[]));
CREATE POLICY "members_delete_admins" ON public.organization_members FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::public.org_role[]));

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER organizations_updated_at BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- On new user: create profile + personal org + owner membership
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_org_id UUID;
  display_name TEXT;
BEGIN
  display_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));

  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, display_name);

  INSERT INTO public.organizations (name, created_by)
  VALUES (display_name || '''s Workspace', NEW.id)
  RETURNING id INTO new_org_id;

  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (new_org_id, NEW.id, 'owner');

  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ----------------------------------------------------------
-- Migration: 20260519180646_ e866af2-358a-49cb-8aa9-5cf2228d9100
-- ----------------------------------------------------------

CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

REVOKE EXECUTE ON FUNCTION public.is_org_member(UUID, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_org_role(UUID, UUID, public.org_role[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_member(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_org_role(UUID, UUID, public.org_role[]) TO authenticated;


-- ----------------------------------------------------------
-- Migration: 20260519181254_ 9fe55aa-9249-46cb-9c31-3be39f150519
-- ----------------------------------------------------------

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


-- ----------------------------------------------------------
-- Migration: 20260519182437_ 20ae2a0-54b1-4fee-a811-00caa74fd6a2
-- ----------------------------------------------------------
ALTER TYPE public.org_role ADD VALUE IF NOT EXISTS 'inventory';

-- ----------------------------------------------------------
-- Migration: 20260519182525_ 399dbd7-20c3-449d-bc91-e9d725daa886
-- ----------------------------------------------------------
-- Movement type enum
DO $$ BEGIN
  CREATE TYPE public.inv_movement_type AS ENUM ('receipt','issue','adjustment','transfer_in','transfer_out');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- PRODUCTS
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sku TEXT,
  name TEXT NOT NULL,
  description TEXT,
  unit TEXT NOT NULL DEFAULT 'unit',
  sale_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  cost_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(6,3) NOT NULL DEFAULT 0,
  track_inventory BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, sku)
);
CREATE INDEX idx_products_org ON public.products(organization_id);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY products_select ON public.products FOR SELECT TO authenticated USING (is_org_member(organization_id, auth.uid()));
CREATE POLICY products_insert ON public.products FOR INSERT TO authenticated WITH CHECK (has_org_role(organization_id, auth.uid(), ARRAY['owner','admin','accountant','inventory']::org_role[]));
CREATE POLICY products_update ON public.products FOR UPDATE TO authenticated USING (has_org_role(organization_id, auth.uid(), ARRAY['owner','admin','accountant','inventory']::org_role[]));
CREATE POLICY products_delete ON public.products FOR DELETE TO authenticated USING (has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::org_role[]));
CREATE TRIGGER products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- LOCATIONS
CREATE TABLE public.inventory_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_invloc_org ON public.inventory_locations(organization_id);
ALTER TABLE public.inventory_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY invloc_select ON public.inventory_locations FOR SELECT TO authenticated USING (is_org_member(organization_id, auth.uid()));
CREATE POLICY invloc_insert ON public.inventory_locations FOR INSERT TO authenticated WITH CHECK (has_org_role(organization_id, auth.uid(), ARRAY['owner','admin','inventory']::org_role[]));
CREATE POLICY invloc_update ON public.inventory_locations FOR UPDATE TO authenticated USING (has_org_role(organization_id, auth.uid(), ARRAY['owner','admin','inventory']::org_role[]));
CREATE POLICY invloc_delete ON public.inventory_locations FOR DELETE TO authenticated USING (has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::org_role[]));

-- STOCK
CREATE TABLE public.inventory_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.inventory_locations(id) ON DELETE CASCADE,
  quantity NUMERIC(14,3) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_id, location_id)
);
CREATE INDEX idx_stock_org ON public.inventory_stock(organization_id);
ALTER TABLE public.inventory_stock ENABLE ROW LEVEL SECURITY;
CREATE POLICY stock_select ON public.inventory_stock FOR SELECT TO authenticated USING (is_org_member(organization_id, auth.uid()));
CREATE POLICY stock_insert ON public.inventory_stock FOR INSERT TO authenticated WITH CHECK (has_org_role(organization_id, auth.uid(), ARRAY['owner','admin','accountant','inventory']::org_role[]));
CREATE POLICY stock_update ON public.inventory_stock FOR UPDATE TO authenticated USING (has_org_role(organization_id, auth.uid(), ARRAY['owner','admin','accountant','inventory']::org_role[]));

-- MOVEMENTS (ledger)
CREATE TABLE public.inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.inventory_locations(id) ON DELETE CASCADE,
  movement_type public.inv_movement_type NOT NULL,
  quantity NUMERIC(14,3) NOT NULL,
  unit_cost NUMERIC(14,2),
  reference TEXT,
  notes TEXT,
  movement_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_mov_org ON public.inventory_movements(organization_id);
CREATE INDEX idx_mov_product ON public.inventory_movements(product_id);
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY mov_select ON public.inventory_movements FOR SELECT TO authenticated USING (is_org_member(organization_id, auth.uid()));
CREATE POLICY mov_insert ON public.inventory_movements FOR INSERT TO authenticated WITH CHECK (has_org_role(organization_id, auth.uid(), ARRAY['owner','admin','accountant','inventory']::org_role[]));
CREATE POLICY mov_delete ON public.inventory_movements FOR DELETE TO authenticated USING (has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::org_role[]));

-- Trigger: apply movement -> upsert stock
CREATE OR REPLACE FUNCTION public.tg_apply_inventory_movement()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE delta NUMERIC(14,3);
BEGIN
  delta := CASE NEW.movement_type
    WHEN 'receipt' THEN NEW.quantity
    WHEN 'transfer_in' THEN NEW.quantity
    WHEN 'adjustment' THEN NEW.quantity
    WHEN 'issue' THEN -NEW.quantity
    WHEN 'transfer_out' THEN -NEW.quantity
  END;
  INSERT INTO public.inventory_stock (organization_id, product_id, location_id, quantity)
  VALUES (NEW.organization_id, NEW.product_id, NEW.location_id, delta)
  ON CONFLICT (product_id, location_id)
  DO UPDATE SET quantity = public.inventory_stock.quantity + delta, updated_at = now();
  RETURN NEW;
END $$;
CREATE TRIGGER trg_apply_movement AFTER INSERT ON public.inventory_movements
FOR EACH ROW EXECUTE FUNCTION public.tg_apply_inventory_movement();

-- Trigger: auto-create default location on org create
CREATE OR REPLACE FUNCTION public.tg_create_default_location()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.inventory_locations (organization_id, name, is_default)
  VALUES (NEW.id, 'Main', true);
  RETURN NEW;
END $$;
CREATE TRIGGER trg_default_location AFTER INSERT ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.tg_create_default_location();

-- Backfill default location for existing orgs
INSERT INTO public.inventory_locations (organization_id, name, is_default)
SELECT o.id, 'Main', true FROM public.organizations o
WHERE NOT EXISTS (SELECT 1 FROM public.inventory_locations l WHERE l.organization_id = o.id);

-- ----------------------------------------------------------
-- Migration: 20260519182553_ f720d70-b56b-4b6c-98ed-ac4525c3f090
-- ----------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.tg_create_default_location() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_apply_inventory_movement() FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------
-- Migration: 20260519183214_ d4c7fbd-b660-4e2d-9460-e69172aa626b
-- ----------------------------------------------------------
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

-- ----------------------------------------------------------
-- Migration: 20260519184658_ 6ed90d2-c0d6-40df-a47a-32dc82962aff
-- ----------------------------------------------------------

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


-- ----------------------------------------------------------
-- Migration: 20260519191901_ abdb3d1-70c6-468a-8c85-3940f2c12534
-- ----------------------------------------------------------
-- Allow org members to view each other's profiles (needed for team management UI)
CREATE POLICY "profiles_select_org_peers"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.organization_members m1
    JOIN public.organization_members m2 ON m1.organization_id = m2.organization_id
    WHERE m1.user_id = auth.uid() AND m2.user_id = public.profiles.id
  )
);

-- ----------------------------------------------------------
-- Migration: 20260519201059_ c70fc10-4cc0-49fe-9237-fa42c3713787
-- ----------------------------------------------------------

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


-- ----------------------------------------------------------
-- Migration: 20260617000000_ ix_handle_new_user_ownership
-- ----------------------------------------------------------

-- Ensure handle_new_user runs as postgres (superuser Ã¢â€ â€™ BYPASSRLS).
-- Without this, SECURITY DEFINER on a non-superuser owner doesn't bypass RLS,
-- causing auth.uid() = NULL inside the trigger to fail the org insert policy.
ALTER FUNCTION public.handle_new_user() OWNER TO postgres;


-- ----------------------------------------------------------
-- Migration: 20260617000001_ rigger_profile_only
-- ----------------------------------------------------------

-- Remove auto-org creation from signup trigger.
-- Org setup is handled by the onboarding flow instead.
-- Trigger still creates the profile so auth context works immediately.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  display_name TEXT;
BEGIN
  display_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));

  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, display_name)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END $$;

ALTER FUNCTION public.handle_new_user() OWNER TO postgres;



-- -----------------------------------------------------------------------------
-- invite_member RPC (from supabase/migrations/20260617000002_invite_member_rpc.sql)
-- SECURITY DEFINER RPC for inviting team members without service-role privileges.
-- Lets the client call supabase.rpc('invite_member', ...) -- required on static
-- deployments where TanStack server functions are not available.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.invite_member(p_email TEXT, p_role public.org_role, p_org UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user UUID;
  v_caller_ok BOOLEAN;
BEGIN
  -- Caller must be owner/admin of the org
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = p_org AND user_id = auth.uid() AND role IN ('owner','admin')
  ) INTO v_caller_ok;
  IF NOT v_caller_ok THEN
    RAISE EXCEPTION 'Only owners/admins can invite members';
  END IF;

  -- Look up the target user by email inside auth.users
  SELECT id INTO v_user FROM auth.users WHERE lower(email) = lower(p_email) LIMIT 1;
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'No user found with that email. Ask them to sign up first.';
  END IF;

  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (p_org, v_user, p_role)
  ON CONFLICT (organization_id, user_id) DO NOTHING;
END $$;

REVOKE ALL ON FUNCTION public.invite_member(TEXT, public.org_role, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.invite_member(TEXT, public.org_role, UUID) TO authenticated;


-- -----------------------------------------------------------------------------
-- create_workspace RPC (from supabase/migrations/20261025000000_create_workspace_rpc.sql)
-- SECURITY DEFINER RPC for workspace creation on static deployments where server
-- functions are unavailable. Bypasses RLS for the org + owner-membership inserts;
-- default location/account/expense-category seeding happens via AFTER INSERT triggers.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_workspace(
  p_name TEXT, p_country TEXT, p_currency TEXT, p_tax_regime TEXT DEFAULT NULL
)
RETURNS TABLE (id UUID, name TEXT, currency TEXT, country TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  v_uid UUID;
  v_org_id UUID;
BEGIN
  SELECT auth.uid() INTO v_uid;
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;

  -- Self-service provisioning only: caller must not have any org membership yet.
  IF EXISTS (SELECT 1 FROM public.organization_members WHERE user_id = v_uid) THEN
    RAISE EXCEPTION 'You already have a workspace. Use the workspace switcher.';
  END IF;

  INSERT INTO public.organizations (name, country, currency, tax_regime, created_by)
  VALUES (p_name, p_country, p_currency, p_tax_regime, v_uid)
  RETURNING public.organizations.id INTO v_org_id;

  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_org_id, v_uid, 'owner');

  RETURN QUERY
  SELECT o.id, o.name, o.currency, o.country
  FROM public.organizations o
  WHERE o.id = v_org_id;
END $$;

-- Owner must be the table owner so SECURITY DEFINER reliably bypasses RLS.
ALTER FUNCTION public.create_workspace(TEXT, TEXT, TEXT, TEXT) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.create_workspace(TEXT, TEXT, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_workspace(TEXT, TEXT, TEXT, TEXT) TO authenticated;

