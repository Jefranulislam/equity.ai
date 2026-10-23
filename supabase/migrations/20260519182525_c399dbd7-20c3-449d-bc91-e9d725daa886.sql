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