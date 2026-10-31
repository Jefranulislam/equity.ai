// SERVER ONLY — never import from browser code.
// One-click demo account: provisions (or reuses) a pre-seeded demo workspace
// so reviewers can walk the whole application with realistic financial data.
//
// Data mirrors database/seed.sql ("Acme Trading Co." — 10 months of invoice,
// payment, expense, bill, quote, PO, credit-note and journal history) and runs
// through the same PostgREST write path the app uses, so every trigger
// (auto-posting, tax recompute, numbering, low-stock) fires exactly as in prod.

import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const DEMO_EMAIL = "demo@equity.ai";
export const DEMO_PASSWORD = "Demo#2026-Review";
const DEMO_ORG_NAME = "Acme Trading Co.";

/* ---------------------------------------------------------------- facade ——— */

// Loosely-typed facade over the generated client: seeding writes are shaped by
// database/seed.sql and validated by DB triggers, not by generated TS types.
/* eslint-disable @typescript-eslint/no-explicit-any */
const sb = supabaseAdmin as any;

type Row = Record<string, unknown>;

async function q(
  table: string,
  cols: string,
  filters: Array<[string, unknown]> = [],
): Promise<Row[]> {
  let builder = sb.from(table).select(cols);
  for (const [col, val] of filters) builder = builder.eq(col, val);
  const { data, error } = await builder;
  if (error)
    throw new Error(`query ${table}: ${String((error as { message?: string }).message ?? error)}`);
  return (data ?? []) as Row[];
}

async function insertAll(table: string, rows: Row | Row[]): Promise<void> {
  const { error } = await sb.from(table).insert(rows);
  if (error)
    throw new Error(`insert ${table}: ${String((error as { message?: string }).message ?? error)}`);
}

async function insertOne(table: string, row: Row): Promise<Row> {
  const { data, error } = await sb.from(table).insert(row).select("*").single();
  if (error)
    throw new Error(`insert ${table}: ${String((error as { message?: string }).message ?? error)}`);
  return data as Row;
}

async function reload(table: string, id: string): Promise<Row> {
  const { data, error } = await sb.from(table).select("*").eq("id", id).single();
  if (error)
    throw new Error(`reload ${table}: ${String((error as { message?: string }).message ?? error)}`);
  return data as Row;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const pickId = (rows: Row[]): string | null => (rows.length ? String(rows[0].id) : null);

/* ---------------------------------------------------------------- helpers —— */

/** CURRENT_DATE - `months` months + `plus` days, as YYYY-MM-DD */
function d(months: number, plus = 0): string {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCMonth(date.getUTCMonth() - months);
  date.setUTCDate(date.getUTCDate() + plus);
  return date.toISOString().slice(0, 10);
}
const today = (plus = 0) => d(0, plus);
const r2 = (v: number) => Math.round(v * 100) / 100;

/* ------------------------------------------------------- ensure demo user —— */

async function ensureDemoUser(): Promise<string> {
  const { data: created } = await sb.auth.admin.createUser({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: "Demo Reviewer" },
  });
  if (created?.user?.id) return created.user.id as string;

  // "already registered" → reuse the existing account
  const { data: link, error: linkErr } = await sb.auth.admin.generateLink({
    type: "magiclink",
    email: DEMO_EMAIL,
  });
  if (linkErr || !link?.user?.id)
    throw new Error(`demo user lookup: ${String(linkErr?.message ?? "no id")}`);
  return String(link.user.id);
}

/* ------------------------------------------------------ seed the workspace —— */

export interface DemoWorkspaceResult {
  orgId: string;
  seeded: boolean;
}

async function ensureDemoWorkspace(userId: string): Promise<DemoWorkspaceResult> {
  const orgs = await q("organizations", "id", [
    ["name", DEMO_ORG_NAME],
    ["created_by", userId],
  ]);
  if (orgs.length > 0) return { orgId: String(orgs[0].id), seeded: false }; // idempotent skip

  const org = await insertOne("organizations", {
    name: DEMO_ORG_NAME,
    country: "US",
    currency: "USD",
    tax_regime: "US-GAAP",
    created_by: userId,
  });
  const orgId = String(org.id);
  await insertAll("organization_members", [
    { organization_id: orgId, user_id: userId, role: "owner" },
  ]);

  // Locations: default "Main Warehouse" is created by trg_default_location.
  const loc = await q("inventory_locations", "id,name", [["organization_id", orgId]]);
  const mainRow = loc.find((l) => l.name === "Main Warehouse") ?? loc[0];
  const mainLoc = mainRow ? String(mainRow.id) : null;
  const storeLocRow = await insertOne("inventory_locations", {
    organization_id: orgId,
    name: "Secondary Warehouse",
  });
  const storeLoc = String(storeLocRow.id);

  const accounts = await q("accounts", "id,code", [["organization_id", orgId]]);
  const acc = (code: string) => pickId(accounts.filter((a) => a.code === code));
  const accOe = acc("6100");
  const accBank = acc("1010");

  const categories = await q("expense_categories", "id,name", [["organization_id", orgId]]);
  const cat = (name: string) => pickId(categories.filter((c) => c.name === name));

  // ------------------------------------------------------------- products
  await insertAll("products", [
    {
      organization_id: orgId,
      sku: "SKU-DESK-01",
      name: "Office Desk 120cm",
      unit: "pcs",
      cost_price: 85.0,
      sale_price: 169.0,
      tax_rate: 7.5,
      track_inventory: true,
      created_by: userId,
    },
    {
      organization_id: orgId,
      sku: "SKU-CHAIR-1",
      name: "Ergonomic Office Chair",
      unit: "pcs",
      cost_price: 110.0,
      sale_price: 229.0,
      tax_rate: 7.5,
      track_inventory: true,
      created_by: userId,
    },
    {
      organization_id: orgId,
      sku: "SKU-PAPER-1",
      name: "A4 Copy Paper (500 sh)",
      unit: "pack",
      cost_price: 2.6,
      sale_price: 5.4,
      tax_rate: 7.5,
      track_inventory: true,
      created_by: userId,
    },
    {
      organization_id: orgId,
      sku: "SKU-STPL-01",
      name: "Heavy-Duty Stapler",
      unit: "pcs",
      cost_price: 12.5,
      sale_price: 24.9,
      tax_rate: 7.5,
      track_inventory: true,
      created_by: userId,
    },
    {
      organization_id: orgId,
      sku: "SKU-NOTE-02",
      name: "A4 Notebook (200 pages)",
      unit: "pcs",
      cost_price: 1.8,
      sale_price: 4.5,
      tax_rate: 7.5,
      track_inventory: true,
      created_by: userId,
    },
    {
      organization_id: orgId,
      sku: "SKU-INK-01",
      name: "Printer Ink Cartridge",
      unit: "pcs",
      cost_price: 15.2,
      sale_price: 31.9,
      tax_rate: 7.5,
      track_inventory: true,
      created_by: userId,
    },
  ]);
  const products = await q("products", "id,sku", [["organization_id", orgId]]);
  const p = (sku: string) => pickId(products.filter((x) => x.sku === sku));
  const pDesk = p("SKU-DESK-01"),
    pChair = p("SKU-CHAIR-1"),
    pPaper = p("SKU-PAPER-1"),
    pStapler = p("SKU-STPL-01"),
    pNotebook = p("SKU-NOTE-02"),
    pInk = p("SKU-INK-01");

  // Opening stock (ink intentionally low → demo low-stock alert)
  await insertAll("inventory_movements", [
    {
      organization_id: orgId,
      product_id: pDesk,
      location_id: mainLoc,
      movement_type: "receipt",
      quantity: 200,
      unit_cost: 85.0,
      created_by: userId,
    },
    {
      organization_id: orgId,
      product_id: pChair,
      location_id: mainLoc,
      movement_type: "receipt",
      quantity: 150,
      unit_cost: 110.0,
      created_by: userId,
    },
    {
      organization_id: orgId,
      product_id: pPaper,
      location_id: mainLoc,
      movement_type: "receipt",
      quantity: 800,
      unit_cost: 2.6,
      created_by: userId,
    },
    {
      organization_id: orgId,
      product_id: pStapler,
      location_id: mainLoc,
      movement_type: "receipt",
      quantity: 120,
      unit_cost: 12.5,
      created_by: userId,
    },
    {
      organization_id: orgId,
      product_id: pNotebook,
      location_id: mainLoc,
      movement_type: "receipt",
      quantity: 120,
      unit_cost: 1.8,
      created_by: userId,
    },
    {
      organization_id: orgId,
      product_id: pInk,
      location_id: mainLoc,
      movement_type: "receipt",
      quantity: 4,
      unit_cost: 15.2,
      created_by: userId,
    },
    {
      organization_id: orgId,
      product_id: pNotebook,
      location_id: storeLoc,
      movement_type: "transfer_in",
      quantity: 50,
      unit_cost: 1.8,
      created_by: userId,
    },
  ]);

  // -------------------------------------------------- customers & vendors
  await insertAll("customers", [
    {
      organization_id: orgId,
      billing_name: "Northwind Interiors Ltd.",
      tax_id: "US-8472-110",
      email: "accounts@northwind.example",
      billing_address: "14 Maple Ave, Suite 301, Chicago, IL",
      created_by: userId,
    },
    {
      organization_id: orgId,
      billing_name: "Braavos Freight Co.",
      tax_id: "US-9931-220",
      email: "billing@braavos.example",
      billing_address: "2 Harbour Road, Boston, MA",
      created_by: userId,
    },
  ]);
  const customers = await q("customers", "id,billing_name", [["organization_id", orgId]]);
  const cust = (frag: string) =>
    pickId(customers.filter((c) => String(c.billing_name).includes(frag)));
  const custA = cust("Northwind"),
    custB = cust("Braavos");

  await insertAll("vendors", [
    {
      organization_id: orgId,
      name: "Globex Paper Supply",
      tax_id: "US-5511-330",
      email: "orders@globex.example",
      created_by: userId,
    },
    {
      organization_id: orgId,
      name: "Stark Office Furniture",
      tax_id: "US-7722-440",
      email: "sales@starkfurniture.example",
      created_by: userId,
    },
  ]);
  const vendors = await q("vendors", "id,name", [["organization_id", orgId]]);
  const vend = (name: string) => pickId(vendors.filter((v) => v.name === name));
  const vendorGx = vend("Globex Paper Supply"),
    vendorSf = vend("Stark Office Furniture");

  // ------------------------------------------------------------- invoices
  // 10 fully paid (1/month), 5 partial (months 1–5), 1 sent-unpaid.
  for (let i = 1; i <= 10; i++) {
    const custId = i % 2 === 0 ? custA : custB;
    const method = ["bank_transfer", "cash", "card", "cheque"][i % 4];

    const inv = await insertOne("invoices", {
      organization_id: orgId,
      customer_id: custId,
      issue_date: d(i, 3),
      due_date: d(i, 33),
      notes: "Demo data",
      created_by: userId,
    });
    const invId = String(inv.id);
    await insertAll("invoice_lines", [
      {
        invoice_id: invId,
        organization_id: orgId,
        position: 1,
        description: "Office Desk 120cm",
        product_id: pDesk,
        quantity: 1 + (i % 3),
        unit_price: 169.0,
        tax_rate: 7.5,
      },
      {
        invoice_id: invId,
        organization_id: orgId,
        position: 2,
        description: "A4 Copy Paper (500 sh)",
        product_id: pPaper,
        quantity: 3 + (i % 5),
        unit_price: 5.4,
        tax_rate: 7.5,
      },
    ]);
    const total = Number((await reload("invoices", invId)).total);
    const pay = await insertOne("payments", {
      organization_id: orgId,
      customer_id: custId,
      amount: total,
      payment_date: d(i, 12),
      method,
      reference: `DEMO-PAY-${i}`,
      notes: "Demo data",
      created_by: userId,
    });
    await insertAll("payment_invoice_links", [
      {
        payment_id: String(pay.id),
        invoice_id: invId,
        organization_id: orgId,
        applied_amount: total,
      },
    ]);

    if (i <= 5) {
      const inv2 = await insertOne("invoices", {
        organization_id: orgId,
        customer_id: custA,
        issue_date: d(i, 10),
        due_date: d(i, 40),
        notes: "Demo data",
        created_by: userId,
      });
      const inv2Id = String(inv2.id);
      await insertAll("invoice_lines", [
        {
          invoice_id: inv2Id,
          organization_id: orgId,
          position: 1,
          description: "Ergonomic Office Chair",
          product_id: pChair,
          quantity: 1 + (i % 2),
          unit_price: 229.0,
          tax_rate: 7.5,
        },
        {
          invoice_id: inv2Id,
          organization_id: orgId,
          position: 2,
          description: "Heavy-Duty Stapler",
          product_id: pStapler,
          quantity: 2,
          unit_price: 24.9,
          tax_rate: 7.5,
        },
      ]);
      const paid = r2(Number((await reload("invoices", inv2Id)).total) * 0.4);
      const pay2 = await insertOne("payments", {
        organization_id: orgId,
        customer_id: custA,
        amount: paid,
        payment_date: d(i, 20),
        method: ["card", "bank_transfer"][i % 2],
        reference: `DEMO-PART-${i}`,
        notes: "Demo data",
        created_by: userId,
      });
      await insertAll("payment_invoice_links", [
        {
          payment_id: String(pay2.id),
          invoice_id: inv2Id,
          organization_id: orgId,
          applied_amount: paid,
        },
      ]);
    }
  }

  // One unpaid sent invoice (most recent)
  const invOpen = await insertOne("invoices", {
    organization_id: orgId,
    customer_id: custB,
    issue_date: today(-12),
    due_date: today(18),
    status: "sent",
    notes: "Demo data",
    created_by: userId,
  });
  await insertAll("invoice_lines", [
    {
      invoice_id: String(invOpen.id),
      organization_id: orgId,
      position: 1,
      description: "A4 Notebook (200 pages)",
      product_id: pNotebook,
      quantity: 6,
      unit_price: 4.5,
      tax_rate: 7.5,
    },
    {
      invoice_id: String(invOpen.id),
      organization_id: orgId,
      position: 2,
      description: "A4 Copy Paper (500 sh)",
      product_id: pPaper,
      quantity: 8,
      unit_price: 5.4,
      tax_rate: 7.5,
    },
  ]);

  // -------------------------------------------------------------- expenses
  for (let i = 1; i <= 10; i++) {
    await insertAll("expenses", [
      {
        organization_id: orgId,
        category_id: cat("Office"),
        expense_date: d(i, 4),
        description: `Office supplies (demo month -${i})`,
        amount: r2(78.0 + i),
        tax_amount: r2((78.0 + i) * 0.075),
        payment_method: ["cash", "card"][i % 2],
        notes: "Demo data",
        created_by: userId,
      },
      {
        organization_id: orgId,
        category_id: cat("Utilities"),
        expense_date: d(i, 6),
        description: `Office rent & utilities (demo month -${i})`,
        amount: 850.0,
        tax_amount: 0,
        payment_method: "bank_transfer",
        notes: "Demo data",
        created_by: userId,
      },
      {
        organization_id: orgId,
        category_id: cat("Marketing"),
        expense_date: d(i, 14),
        description: `Digital ads (demo month -${i})`,
        amount: 120.0,
        tax_amount: 0,
        payment_method: "card",
        notes: "Demo data",
        created_by: userId,
      },
    ]);
  }

  // ------------------------------------------------------------ vendor bills
  for (let i = 1; i <= 4; i++) {
    const bill = await insertOne("bills", {
      organization_id: orgId,
      vendor_id: vendorGx,
      vendor_reference: `GPS-${9000 + i}`,
      issue_date: d(i, 5),
      due_date: d(i, 35),
      notes: "Demo data",
      created_by: userId,
    });
    const billId = String(bill.id);
    await insertAll("bill_lines", [
      {
        bill_id: billId,
        organization_id: orgId,
        position: 1,
        description: "A4 Copy Paper (500 sh)",
        product_id: pPaper,
        quantity: 30,
        unit_price: 2.6,
        tax_rate: 7.5,
      },
      {
        bill_id: billId,
        organization_id: orgId,
        position: 2,
        description: "Printer Ink Cartridge",
        product_id: pInk,
        quantity: 10,
        unit_price: 15.2,
        tax_rate: 7.5,
      },
    ]);
    if (i <= 2) {
      const total = Number((await reload("bills", billId)).total);
      const bpay = await insertOne("bill_payments", {
        organization_id: orgId,
        vendor_id: vendorGx,
        amount: total,
        payment_date: d(i, 20),
        method: ["bank_transfer", "cash"][i % 2],
        reference: `DEMO-BILLPAY-${i}`,
        notes: "Demo data",
        created_by: userId,
      });
      await insertAll("bill_payment_links", [
        {
          organization_id: orgId,
          bill_payment_id: String(bpay.id),
          bill_id: billId,
          applied_amount: total,
        },
      ]);
    }
  }

  // ------------------------------------------ quotes / PO / credit notes
  const quote1 = await insertOne("quotes", {
    organization_id: orgId,
    customer_id: custA,
    issue_date: today(-6),
    expiry_date: today(14),
    status: "sent",
    notes: "Demo data",
    created_by: userId,
  });
  await insertAll("quote_lines", [
    {
      organization_id: orgId,
      quote_id: String(quote1.id),
      position: 1,
      description: "Office Desk 120cm (set of 4)",
      quantity: 4,
      unit_price: 169.0,
      tax_rate: 7.5,
    },
  ]);
  const quote2 = await insertOne("quotes", {
    organization_id: orgId,
    customer_id: custB,
    issue_date: today(-2),
    expiry_date: today(18),
    status: "draft",
    notes: "Demo data",
    created_by: userId,
  });
  await insertAll("quote_lines", [
    {
      organization_id: orgId,
      quote_id: String(quote2.id),
      position: 1,
      description: "Ergonomic Office Chair (bulk)",
      quantity: 10,
      unit_price: 219.0,
      tax_rate: 7.5,
    },
  ]);

  const po = await insertOne("purchase_orders", {
    organization_id: orgId,
    vendor_id: vendorSf,
    issue_date: today(-4),
    expected_date: today(10),
    status: "sent",
    notes: "Demo data",
    created_by: userId,
  });
  await insertAll("po_lines", [
    {
      organization_id: orgId,
      po_id: String(po.id),
      position: 1,
      product_id: pChair,
      description: "Ergonomic Office Chair",
      quantity: 10,
      unit_price: 110.0,
      tax_rate: 7.5,
    },
  ]);

  const creditNote = await insertOne("credit_notes", {
    organization_id: orgId,
    customer_id: custA,
    issue_date: today(-9),
    status: "issued",
    reason: "Returned 1 defective stapler (demo)",
    created_by: userId,
  });
  await insertAll("credit_note_lines", [
    {
      organization_id: orgId,
      credit_note_id: String(creditNote.id),
      position: 1,
      description: "Heavy-Duty Stapler (return)",
      quantity: 1,
      unit_price: 24.9,
      tax_rate: 7.5,
    },
  ]);

  // ------------------------------------------------------ recurring invoice
  await insertOne("recurring_invoices", {
    organization_id: orgId,
    customer_id: custA,
    name: "Northwind monthly retainer (demo)",
    frequency: "monthly",
    next_run_date: today(15),
    currency: "USD",
    template: {
      lines: [
        { description: "Bookkeeping retainer", quantity: 1, unit_price: 495.0, tax_rate: 7.5 },
      ],
      notes: "Demo recurring template",
    },
    created_by: userId,
  });

  // ---------------------------------------------------------- manual journal
  if (accOe && accBank) {
    const journal = await insertOne("journal_entries", {
      organization_id: orgId,
      entry_date: today(-20),
      memo: "Manual journal (demo)",
      is_posted: true,
      created_by: userId,
    });
    await insertAll("journal_lines", [
      {
        organization_id: orgId,
        entry_id: String(journal.id),
        account_id: accOe,
        debit: 1700.0,
        credit: 0,
        position: 1,
        description: "Office expenses — prepaid",
      },
      {
        organization_id: orgId,
        entry_id: String(journal.id),
        account_id: accBank,
        debit: 0,
        credit: 1700.0,
        position: 2,
        description: "Paid from bank",
      },
    ]);
  }

  return { orgId, seeded: true };
}

/* ---------------------------------------------------------------- public ——— */

/**
 * Ensures the demo account + seeded workspace exist, then returns a one-time
 * magic-link token hash the client redeems with `verifyOtp({ type: "magiclink" })`.
 */
export async function ensureDemoSession(): Promise<{ tokenHash: string }> {
  const userId = await ensureDemoUser();
  await ensureDemoWorkspace(userId);
  const { data, error } = await sb.auth.admin.generateLink({
    type: "magiclink",
    email: DEMO_EMAIL,
  });
  if (error || !data?.properties?.hashed_token)
    throw new Error(`craft demo session: ${String(error?.message ?? "no token")}`);
  return { tokenHash: String(data.properties.hashed_token) };
}
