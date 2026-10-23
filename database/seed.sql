-- =============================================================================
-- Equity.AI — Demo seed data
-- =============================================================================
-- Run AFTER schema.sql (Supabase SQL Editor or: psql "$DATABASE_URL" -f seed.sql).
-- Editor/psql run with elevated rights and bypass RLS by design.
--
-- HOW TO USE:
--   1. Sign up in the app once (creates your auth user).
--   2. Replace REVIEWER_EMAIL@example.com below with that email (appears once).
--   3. Run the whole file. It creates workspace "Acme Trading Co." (USD, US
--      country preset) owned by your account, plus 10 months of demo history:
--      paid/partial/unpaid invoices, customer payments, expenses, vendor bills
--      and a vendor payment, quotes, a purchase order, a credit note, a
--      recurring-invoice template, multi-location stock and a manual journal —
--      every report, dashboard and Freya tool then has real, consistent data.
--
-- Safe to re-run for the same owner (skips the workspace/data it already made).
-- =============================================================================

DO $$
DECLARE
  demo_owner_email text := 'REVIEWER_EMAIL@example.com';

  v_org uuid; v_owner uuid; v_member boolean; v_loc_main uuid; v_loc_store uuid;
  v_acc_oe uuid;  -- 6100 Office Expenses
  v_acc_bank uuid; -- 1010 Bank
  v_inv uuid; v_pay uuid; v_total numeric; v_paid numeric;
  v_prod_desk uuid; v_prod_chair uuid; v_prod_paper uuid; v_prod_stapler uuid; v_prod_notebook uuid; v_prod_ink uuid;
  v_cust_a uuid; v_cust_b uuid;
  v_vendor_gx uuid; v_vendor_sf uuid;
  v_cat_office uuid; v_cat_util uuid; v_cat_mkt uuid;
  v_hdr uuid; v_cn uuid;
  v_method public.payment_method;
  v_i int;
  v_rec record;
BEGIN
  --------------------------------------------------------------- owner / org
  SELECT u.id INTO v_owner FROM auth.users u
  WHERE u.email = demo_owner_email
  ORDER BY u.created_at LIMIT 1;

  IF v_owner IS NULL THEN
    -- fallback: newest profile (works even if the placeholder email is unchanged)
    SELECT u.id INTO v_owner
    FROM auth.users u JOIN public.profiles p ON p.id = u.id
    ORDER BY u.created_at DESC LIMIT 1;
  END IF;

  IF v_owner IS NULL THEN
    RAISE NOTICE 'SEED SKIPPED: no user found — sign up in the app first, then run this seed with your email.';
    RETURN;
  END IF;

  SELECT id INTO v_org FROM public.organizations WHERE name = 'Acme Trading Co.' LIMIT 1;
  IF v_org IS NOT NULL THEN
    RAISE NOTICE 'SEED SKIPPED: demo workspace "Acme Trading Co." already exists.';
    RETURN;
  END IF;

  INSERT INTO public.organizations (name, country, currency, tax_regime, created_by)
    VALUES ('Acme Trading Co.', 'US', 'USD', 'US-GAAP', v_owner)
    RETURNING id INTO v_org;

  INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES (v_org, v_owner, 'owner');

  ------------------------------------------------------- locations & accounts
  -- default "Main Warehouse" was auto-created by trg_default_location
  SELECT id INTO v_loc_main FROM public.inventory_locations
    WHERE organization_id = v_org AND is_default LIMIT 1;

  INSERT INTO public.inventory_locations (organization_id, name)
    VALUES (v_org, 'Secondary Warehouse')
    RETURNING id INTO v_loc_store;

  SELECT a.id INTO v_acc_oe   FROM public.accounts a WHERE a.organization_id = v_org AND a.code = '6100';
  SELECT a.id INTO v_acc_bank FROM public.accounts a WHERE a.organization_id = v_org AND a.code = '1010';

  --------------------------------------------------------- expense categories
  -- Office, Travel, Software, Meals, Marketing, Utilities are seeded by trigger
  SELECT id INTO v_cat_office FROM public.expense_categories WHERE organization_id = v_org AND name = 'Office';
  SELECT id INTO v_cat_util   FROM public.expense_categories WHERE organization_id = v_org AND name = 'Utilities';
  SELECT id INTO v_cat_mkt    FROM public.expense_categories WHERE organization_id = v_org AND name = 'Marketing';

  ------------------------------------------------------------------ products
  INSERT INTO public.products (organization_id, sku, name, unit, cost_price, sale_price, tax_rate, track_inventory, created_by)
  VALUES
    (v_org, 'SKU-DESK-01',  'Office Desk 120cm',       'pcs',  85.00, 169.00, 7.5, true, v_owner),
    (v_org, 'SKU-CHAIR-1',  'Ergonomic Office Chair',  'pcs', 110.00, 229.00, 7.5, true, v_owner),
    (v_org, 'SKU-PAPER-1',  'A4 Copy Paper (500 sh)',  'pack',  2.60,   5.40, 7.5, true, v_owner),
    (v_org, 'SKU-STPL-01',  'Heavy-Duty Stapler',      'pcs',  12.50,  24.90, 7.5, true, v_owner),
    (v_org, 'SKU-NOTE-02',  'A4 Notebook (200 pages)', 'pcs',   1.80,   4.50, 7.5, true, v_owner),
    (v_org, 'SKU-INK-01',   'Printer Ink Cartridge',   'pcs',  15.20,  31.90, 7.5, true, v_owner);

  SELECT id INTO v_prod_desk     FROM public.products WHERE organization_id = v_org AND sku = 'SKU-DESK-01';
  SELECT id INTO v_prod_chair    FROM public.products WHERE organization_id = v_org AND sku = 'SKU-CHAIR-1';
  SELECT id INTO v_prod_paper    FROM public.products WHERE organization_id = v_org AND sku = 'SKU-PAPER-1';
  SELECT id INTO v_prod_stapler  FROM public.products WHERE organization_id = v_org AND sku = 'SKU-STPL-01';
  SELECT id INTO v_prod_notebook FROM public.products WHERE organization_id = v_org AND sku = 'SKU-NOTE-02';
  SELECT id INTO v_prod_ink      FROM public.products WHERE organization_id = v_org AND sku = 'SKU-INK-01';

  -- opening stock (ink intentionally low → demo low-stock alert)
  INSERT INTO public.inventory_movements (organization_id, product_id, location_id, movement_type, quantity, unit_cost, created_by)
  VALUES
    (v_org, v_prod_desk,     v_loc_main, 'receipt',  200,  85.00, v_owner),
    (v_org, v_prod_chair,    v_loc_main, 'receipt',  150, 110.00, v_owner),
    (v_org, v_prod_paper,    v_loc_main, 'receipt',  800,   2.60, v_owner),
    (v_org, v_prod_stapler,  v_loc_main, 'receipt',  120,  12.50, v_owner),
    (v_org, v_prod_notebook, v_loc_main, 'receipt',  120,   1.80, v_owner),
    (v_org, v_prod_ink,      v_loc_main, 'receipt',    4,  15.20, v_owner),
    (v_org, v_prod_notebook, v_loc_store,'transfer_in', 50, 1.80, v_owner);

  ------------------------------------------------------------- customers/vendors
  INSERT INTO public.customers (organization_id, billing_name, tax_id, email, billing_address, created_by)
  VALUES
    (v_org, 'Northwind Interiors Ltd.', 'US-8472-110', 'accounts@northwind.example', '14 Maple Ave, Suite 301, Chicago, IL', v_owner),
    (v_org, 'Braavos Freight Co.',      'US-9931-220', 'billing@braavos.example',    '2 Harbour Road, Boston, MA',           v_owner);

  SELECT id INTO v_cust_a FROM public.customers WHERE organization_id = v_org AND billing_name LIKE 'Northwind%';
  SELECT id INTO v_cust_b FROM public.customers WHERE organization_id = v_org AND billing_name LIKE 'Braavos%';

  INSERT INTO public.vendors (organization_id, name, tax_id, email, created_by)
  VALUES
    (v_org, 'Globex Paper Supply',       'US-5511-330', 'orders@globex.example', v_owner),
    (v_org, 'Stark Office Furniture',    'US-7722-440', 'sales@starkfurniture.example', v_owner);

  SELECT id INTO v_vendor_gx FROM public.vendors WHERE organization_id = v_org AND name = 'Globex Paper Supply';
  SELECT id INTO v_vendor_sf FROM public.vendors WHERE organization_id = v_org AND name = 'Stark Office Furniture';

  ------------------------------------------------------------------- invoices
  -- 10 paid (1/month), 5 partial (older months), 1 sent-unpaid (most recent).
  -- Payment/link inserts happen per invoice right after its lines, so the
  -- tg_recompute_invoice_paid trigger drives correct paid/partial statuses.
  FOR v_i IN 1..10 LOOP
    v_method := (ARRAY['bank_transfer','cash','card','cheque'])[1 + (v_i % 4)];

    ---------------- fully paid invoice ----------------
    INSERT INTO public.invoices (organization_id, customer_id, issue_date, due_date, notes, created_by)
      VALUES (v_org,
              CASE WHEN v_i % 2 = 0 THEN v_cust_a ELSE v_cust_b END,
              CURRENT_DATE - (v_i || ' months')::interval + 3,
              CURRENT_DATE - (v_i || ' months')::interval + 33,
              'Demo data', v_owner)
      RETURNING id INTO v_inv;
    INSERT INTO public.invoice_lines (invoice_id, organization_id, position, description, product_id, quantity, unit_price, tax_rate)
    VALUES (v_inv, v_org, 1, 'Office Desk 120cm',      v_prod_desk,  1 + (v_i % 3), 169.00, 7.5),
           (v_inv, v_org, 2, 'A4 Copy Paper (500 sh)', v_prod_paper, 3 + (v_i % 5),   5.40, 7.5);
    SELECT total INTO v_total FROM public.invoices WHERE id = v_inv;
    INSERT INTO public.payments (organization_id, customer_id, amount, payment_date, method, reference, notes, created_by)
      VALUES (v_org,
              CASE WHEN v_i % 2 = 0 THEN v_cust_a ELSE v_cust_b END,
              v_total,
              CURRENT_DATE - (v_i || ' months')::interval + 12,
              v_method, 'DEMO-PAY-' || v_i, 'Demo data', v_owner)
      RETURNING id INTO v_pay;
    INSERT INTO public.payment_invoice_links (payment_id, invoice_id, organization_id, applied_amount)
      VALUES (v_pay, v_inv, v_org, v_total);

    ---------------- partially paid invoice (months 1–5) ----------------
    IF v_i <= 5 THEN
      INSERT INTO public.invoices (organization_id, customer_id, issue_date, due_date, notes, created_by)
        VALUES (v_org, v_cust_a,
                CURRENT_DATE - (v_i || ' months')::interval + 10,
                CURRENT_DATE - (v_i || ' months')::interval + 40,
                'Demo data', v_owner)
        RETURNING id INTO v_inv;
      INSERT INTO public.invoice_lines (invoice_id, organization_id, position, description, product_id, quantity, unit_price, tax_rate)
      VALUES (v_inv, v_org, 1, 'Ergonomic Office Chair', v_prod_chair,   1 + (v_i % 2), 229.00, 7.5),
             (v_inv, v_org, 2, 'Heavy-Duty Stapler',     v_prod_stapler, 2,              24.90, 7.5);
      SELECT total INTO v_total FROM public.invoices WHERE id = v_inv;
      v_paid := round(v_total * 0.4, 2);
      INSERT INTO public.payments (organization_id, customer_id, amount, payment_date, method, reference, notes, created_by)
        VALUES (v_org, v_cust_a, v_paid,
                CURRENT_DATE - (v_i || ' months')::interval + 20,
                (ARRAY['card','bank_transfer'])[1 + (v_i % 2)], 'DEMO-PART-' || v_i, 'Demo data', v_owner)
        RETURNING id INTO v_pay;
      INSERT INTO public.payment_invoice_links (payment_id, invoice_id, organization_id, applied_amount)
        VALUES (v_pay, v_inv, v_org, v_paid);
    END IF;
  END LOOP;

  ---------------- one unpaid sent invoice (most recent) ----------------
  INSERT INTO public.invoices (organization_id, customer_id, issue_date, due_date, status, notes, created_by)
    VALUES (v_org, v_cust_b, CURRENT_DATE - 12, CURRENT_DATE + 18, 'sent', 'Demo data', v_owner)
    RETURNING id INTO v_inv;
  INSERT INTO public.invoice_lines (invoice_id, organization_id, position, description, product_id, quantity, unit_price, tax_rate)
  VALUES (v_inv, v_org, 1, 'A4 Notebook (200 pages)', v_prod_notebook, 6, 4.50, 7.5),
         (v_inv, v_org, 2, 'A4 Copy Paper (500 sh)', v_prod_paper,    8, 5.40, 7.5);

  ------------------------------------------------------------------- expenses
  -- 10 months: office supplies, utilities, marketing
  FOR v_i IN 1..10 LOOP
    INSERT INTO public.expenses (organization_id, category_id, expense_date, description, amount, tax_amount, payment_method, notes, created_by)
    VALUES
      (v_org, v_cat_office, CURRENT_DATE - (v_i || ' months')::interval + 4,  'Office supplies (demo month -' || v_i || ')', 78.00 + v_i, round((78.00 + v_i) * 0.075, 2), (ARRAY['cash','card'])[1 + (v_i % 2)], 'Demo data', v_owner),
      (v_org, v_cat_util,   CURRENT_DATE - (v_i || ' months')::interval + 6,  'Office rent & utilities (demo month -' || v_i || ')', 850.00, 0, 'bank_transfer', 'Demo data', v_owner),
      (v_org, v_cat_mkt,    CURRENT_DATE - (v_i || ' months')::interval + 14, 'Digital ads (demo month -' || v_i || ')', 120.00, 0, 'card', 'Demo data', v_owner);
  END LOOP;

  ----------------------------------------------------------------- vendor bills
  -- 4 bills from Globex: months 1–2 fully paid, months 3–4 open
  FOR v_i IN 1..4 LOOP
    INSERT INTO public.bills (organization_id, vendor_id, vendor_reference, issue_date, due_date, notes, created_by)
      VALUES (v_org, v_vendor_gx, 'GPS-' || (9000 + v_i),
              CURRENT_DATE - (v_i || ' months')::interval + 5,
              CURRENT_DATE - (v_i || ' months')::interval + 35,
              'Demo data', v_owner)
      RETURNING id INTO v_inv;
    INSERT INTO public.bill_lines (bill_id, organization_id, position, description, product_id, quantity, unit_price, tax_rate)
    VALUES (v_inv, v_org, 1, 'A4 Copy Paper (500 sh)',    v_prod_paper, 30, 2.60, 7.5),
           (v_inv, v_org, 2, 'Printer Ink Cartridge',    v_prod_ink,   10, 15.20, 7.5);

    IF v_i <= 2 THEN
      SELECT total INTO v_total FROM public.bills WHERE id = v_inv;
      INSERT INTO public.bill_payments (organization_id, vendor_id, amount, payment_date, method, reference, notes, created_by)
        VALUES (v_org, v_vendor_gx, v_total,
                CURRENT_DATE - (v_i || ' months')::interval + 20,
                (ARRAY['bank_transfer','cash'])[1 + (v_i % 2)], 'DEMO-BILLPAY-' || v_i, 'Demo data', v_owner)
        RETURNING id INTO v_pay;
      INSERT INTO public.bill_payment_links (organization_id, bill_payment_id, bill_id, applied_amount)
        VALUES (v_org, v_pay, v_inv, v_total);
    END IF;
  END LOOP;

  ------------------------------------------------- quotes / PO / credit note
  INSERT INTO public.quotes (organization_id, customer_id, issue_date, expiry_date, status, notes, created_by)
    VALUES (v_org, v_cust_a,    CURRENT_DATE - 6, CURRENT_DATE + 14, 'sent',  'Demo data', v_owner)
    RETURNING id INTO v_inv;
  INSERT INTO public.quote_lines (organization_id, quote_id, position, description, quantity, unit_price, tax_rate)
  VALUES (v_org, v_inv, 1, 'Office Desk 120cm (set of 4)', 4, 169.00, 7.5);

  INSERT INTO public.quotes (organization_id, customer_id, issue_date, expiry_date, status, notes, created_by)
    VALUES (v_org, v_cust_b, CURRENT_DATE - 2, CURRENT_DATE + 18, 'draft', 'Demo data', v_owner)
    RETURNING id INTO v_inv;
  INSERT INTO public.quote_lines (organization_id, quote_id, position, description, quantity, unit_price, tax_rate)
  VALUES (v_org, v_inv, 1, 'Ergonomic Office Chair (bulk)', 10, 219.00, 7.5);

  INSERT INTO public.purchase_orders (organization_id, vendor_id, issue_date, expected_date, status, notes, created_by)
    VALUES (v_org, v_vendor_sf, CURRENT_DATE - 4, CURRENT_DATE + 10, 'sent', 'Demo data', v_owner)
    RETURNING id INTO v_inv;
  INSERT INTO public.po_lines (organization_id, po_id, position, product_id, description, quantity, unit_price, tax_rate)
  VALUES (v_org, v_inv, 1, v_prod_chair, 'Ergonomic Office Chair', 10, 110.00, 7.5);

  INSERT INTO public.credit_notes (organization_id, customer_id, issue_date, status, reason, created_by)
    VALUES (v_org, v_cust_a, CURRENT_DATE - 9, 'issued', 'Returned 1 defective stapler (demo)', v_owner)
    RETURNING id INTO v_cn;
  INSERT INTO public.credit_note_lines (organization_id, credit_note_id, position, description, quantity, unit_price, tax_rate)
  VALUES (v_org, v_cn, 1, 'Heavy-Duty Stapler (return)', 1, 24.90, 7.5);

  ----------------------------------------------------------- recurring invoice
  INSERT INTO public.recurring_invoices (organization_id, customer_id, name, frequency, next_run_date, currency, template, created_by)
  VALUES (v_org, v_cust_a, 'Northwind monthly retainer (demo)', 'monthly', CURRENT_DATE + 15, 'USD',
          '{"lines":[{"description":"Bookkeeping retainer","quantity":1,"unit_price":495.00,"tax_rate":7.5}],"notes":"Demo recurring template"}'::jsonb,
          v_owner);

  ------------------------------------------------------------- manual journal
  IF v_acc_oe IS NOT NULL AND v_acc_bank IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.journal_entries WHERE organization_id = v_org AND memo = 'Manual journal (demo)') THEN
      INSERT INTO public.journal_entries (organization_id, entry_date, memo, is_posted, created_by)
        VALUES (v_org, CURRENT_DATE - 20, 'Manual journal (demo)', true, v_owner)
        RETURNING id INTO v_hdr;
      INSERT INTO public.journal_lines (organization_id, entry_id, account_id, debit, credit, position, description)
      VALUES (v_org, v_hdr, v_acc_oe,   1700.00, 0, 1, 'Office expenses — prepaid'),
             (v_org, v_hdr, v_acc_bank, 0, 1700.00, 2, 'Paid from bank');
    END IF;
  END IF;

  RAISE NOTICE 'SEED OK — workspace "Acme Trading Co." created for %. Sign in and switch workspace in the top bar.',
               demo_owner_email;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SEED FAILED: % (%) — rolling back nothing; fix the error and re-run.', SQLERRM, SQLSTATE;
  RAISE;
END $$;
