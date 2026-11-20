-- Root-cause fix for the broken embedded selects.
--
-- The sales/purchasing documents created in
-- 20260519201059_5c70fc10-4cc0-49fe-9237-fa42c3713787.sql were declared
-- WITHOUT foreign keys, so PostgREST cannot resolve relationships such as
-- `quotes -> customers`. Requests like
--
--   GET /rest/v1/quotes?select=id,customer:customers(billing_name)
--
-- fail with PGRST200 "Could not find a relationship between 'quotes' and
-- 'customers' in the schema cache", which surfaced as "Failed to load quotes"
-- in the UI.
--
-- Add the missing constraints. Any orphan references are nulled first so the
-- constraint can always be applied to an existing database.

DO $$
BEGIN
  -- ================= quotes =================
  UPDATE public.quotes q SET customer_id = NULL
    WHERE customer_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.customers c WHERE c.id = q.customer_id);
  UPDATE public.quotes q SET converted_invoice_id = NULL
    WHERE converted_invoice_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = q.converted_invoice_id);

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.quotes'::regclass AND conname = 'quotes_customer_id_fkey'
  ) THEN
    ALTER TABLE public.quotes
      ADD CONSTRAINT quotes_customer_id_fkey FOREIGN KEY (customer_id)
      REFERENCES public.customers (id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.quotes'::regclass AND conname = 'quotes_converted_invoice_id_fkey'
  ) THEN
    ALTER TABLE public.quotes
      ADD CONSTRAINT quotes_converted_invoice_id_fkey FOREIGN KEY (converted_invoice_id)
      REFERENCES public.invoices (id) ON DELETE SET NULL;
  END IF;

  -- ================= credit_notes =================
  UPDATE public.credit_notes cn SET customer_id = NULL
    WHERE customer_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.customers c WHERE c.id = cn.customer_id);
  UPDATE public.credit_notes cn SET invoice_id = NULL
    WHERE invoice_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = cn.invoice_id);

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.credit_notes'::regclass AND conname = 'credit_notes_customer_id_fkey'
  ) THEN
    ALTER TABLE public.credit_notes
      ADD CONSTRAINT credit_notes_customer_id_fkey FOREIGN KEY (customer_id)
      REFERENCES public.customers (id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.credit_notes'::regclass AND conname = 'credit_notes_invoice_id_fkey'
  ) THEN
    ALTER TABLE public.credit_notes
      ADD CONSTRAINT credit_notes_invoice_id_fkey FOREIGN KEY (invoice_id)
      REFERENCES public.invoices (id) ON DELETE SET NULL;
  END IF;

  -- ================= purchase_orders =================
  UPDATE public.purchase_orders po SET vendor_id = NULL
    WHERE vendor_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = po.vendor_id);
  UPDATE public.purchase_orders po SET converted_bill_id = NULL
    WHERE converted_bill_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.bills b WHERE b.id = po.converted_bill_id);

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.purchase_orders'::regclass AND conname = 'purchase_orders_vendor_id_fkey'
  ) THEN
    ALTER TABLE public.purchase_orders
      ADD CONSTRAINT purchase_orders_vendor_id_fkey FOREIGN KEY (vendor_id)
      REFERENCES public.vendors (id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.purchase_orders'::regclass AND conname = 'purchase_orders_converted_bill_id_fkey'
  ) THEN
    ALTER TABLE public.purchase_orders
      ADD CONSTRAINT purchase_orders_converted_bill_id_fkey FOREIGN KEY (converted_bill_id)
      REFERENCES public.bills (id) ON DELETE SET NULL;
  END IF;

  -- ================= bill_payments =================
  UPDATE public.bill_payments bp SET vendor_id = NULL
    WHERE vendor_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = bp.vendor_id);

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.bill_payments'::regclass AND conname = 'bill_payments_vendor_id_fkey'
  ) THEN
    ALTER TABLE public.bill_payments
      ADD CONSTRAINT bill_payments_vendor_id_fkey FOREIGN KEY (vendor_id)
      REFERENCES public.vendors (id) ON DELETE SET NULL;
  END IF;
END $$;
