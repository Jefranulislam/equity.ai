import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Download, TrendingUp, TrendingDown, Scale, Wallet, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/org-context";
import { money, fmtDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "Reports — Equity.AI" }] }),
  component: Reports,
});

type Range = "this_month" | "last_month" | "qtd" | "ytd" | "last_year";

function rangeFor(r: Range): { from: string; to: string; label: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  switch (r) {
    case "this_month": return { from: iso(new Date(y, m, 1)), to: iso(new Date(y, m + 1, 0)), label: now.toLocaleString("default", { month: "long", year: "numeric" }) };
    case "last_month": return { from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)), label: new Date(y, m - 1, 1).toLocaleString("default", { month: "long", year: "numeric" }) };
    case "qtd": { const q = Math.floor(m / 3) * 3; return { from: iso(new Date(y, q, 1)), to: iso(now), label: `Q${q / 3 + 1} ${y}` }; }
    case "ytd": return { from: iso(new Date(y, 0, 1)), to: iso(now), label: `YTD ${y}` };
    case "last_year": return { from: iso(new Date(y - 1, 0, 1)), to: iso(new Date(y - 1, 11, 31)), label: `FY ${y - 1}` };
  }
}

interface Bucket { label: string; amount: number }
interface PnL { revenue: Bucket[]; cogs: Bucket[]; expenses: Bucket[]; totalRevenue: number; totalCogs: number; totalExpenses: number; gross: number; net: number }
interface BS { receivables: number; cash: number; inventory: number; payables: number; equity: number }
interface CF { inflow: number; outflow: number; net: number; byMethod: Bucket[] }

function Reports() {
  const { currentOrg } = useOrg();
  const [range, setRange] = useState<Range>("ytd");
  const [tab, setTab] = useState<"pnl" | "bs" | "cf">("pnl");
  const [loading, setLoading] = useState(true);
  const [pnl, setPnl] = useState<PnL | null>(null);
  const [bs, setBs] = useState<BS | null>(null);
  const [cf, setCf] = useState<CF | null>(null);

  const period = useMemo(() => rangeFor(range), [range]);
  const currency = currentOrg?.currency ?? "USD";

  useEffect(() => {
    if (!currentOrg) return;
    const orgId = currentOrg.id;
    setLoading(true);

    Promise.all([
      // Revenue: invoices issued in period (excl. drafts)
      supabase.from("invoices").select("subtotal,total,tax_total,status,issue_date").eq("organization_id", orgId).gte("issue_date", period.from).lte("issue_date", period.to).neq("status", "draft"),
      // Bills (COGS proxy) in period
      supabase.from("bills").select("subtotal,total,issue_date").eq("organization_id", orgId).gte("issue_date", period.from).lte("issue_date", period.to),
      // Expenses by category
      supabase.from("expenses").select("amount,expense_date,category:expense_categories(name)").eq("organization_id", orgId).gte("expense_date", period.from).lte("expense_date", period.to),
      // Receivables (all open invoices)
      supabase.from("invoices").select("total,amount_paid").eq("organization_id", orgId).neq("status", "draft"),
      // Payables (all open bills)
      supabase.from("bills").select("total,amount_paid").eq("organization_id", orgId),
      // Inventory value
      supabase.from("inventory_stock").select("quantity,product:products(cost_price)").eq("organization_id", orgId),
      // Payments inflow (in period)
      supabase.from("payments").select("amount,method,payment_date").eq("organization_id", orgId).gte("payment_date", period.from).lte("payment_date", period.to),
    ]).then(([invR, billR, expR, allInv, allBill, stockR, payR]) => {
      const invoices = (invR.data ?? []) as { subtotal: number | string; total: number | string; tax_total: number | string; issue_date: string }[];
      const bills = (billR.data ?? []) as { subtotal: number | string; total: number | string }[];
      const expenses = (expR.data ?? []) as { amount: number | string; category: { name: string } | null }[];
      const allInvoices = (allInv.data ?? []) as { total: number | string; amount_paid: number | string }[];
      const allBills = (allBill.data ?? []) as { total: number | string; amount_paid: number | string }[];
      const stock = (stockR.data ?? []) as { quantity: number | string; product: { cost_price: number | string } | null }[];
      const payments = (payR.data ?? []) as { amount: number | string; method: string }[];

      // P&L
      const totalRevenue = invoices.reduce((s, i) => s + Number(i.subtotal), 0);
      const totalCogs = bills.reduce((s, b) => s + Number(b.subtotal), 0);
      const expByCat = new Map<string, number>();
      for (const e of expenses) {
        const k = e.category?.name ?? "Uncategorized";
        expByCat.set(k, (expByCat.get(k) ?? 0) + Number(e.amount));
      }
      const expBuckets: Bucket[] = [...expByCat.entries()].map(([label, amount]) => ({ label, amount })).sort((a, b) => b.amount - a.amount);
      const totalExpenses = expBuckets.reduce((s, b) => s + b.amount, 0);
      const gross = totalRevenue - totalCogs;
      const net = gross - totalExpenses;
      setPnl({
        revenue: [{ label: "Sales revenue", amount: totalRevenue }],
        cogs: [{ label: "Cost of goods (bills)", amount: totalCogs }],
        expenses: expBuckets,
        totalRevenue, totalCogs, totalExpenses, gross, net,
      });

      // Balance sheet (snapshot, simple)
      const receivables = allInvoices.reduce((s, i) => s + Math.max(0, Number(i.total) - Number(i.amount_paid)), 0);
      const payables = allBills.reduce((s, b) => s + Math.max(0, Number(b.total) - Number(b.amount_paid)), 0);
      const inventory = stock.reduce((s, r) => s + Number(r.quantity) * Number(r.product?.cost_price ?? 0), 0);
      const cash = payments.reduce((s, p) => s + Number(p.amount), 0); // simplified cash inflow proxy
      const equity = receivables + inventory + cash - payables;
      setBs({ receivables, cash, inventory, payables, equity });

      // Cash flow
      const inflow = payments.reduce((s, p) => s + Number(p.amount), 0);
      const outflow = expenses.reduce((s, e) => s + Number(e.amount), 0)
        + bills.reduce((s, b) => s + Number(b.total), 0); // proxy outflow
      const byMethodMap = new Map<string, number>();
      for (const p of payments) byMethodMap.set(p.method, (byMethodMap.get(p.method) ?? 0) + Number(p.amount));
      setCf({
        inflow, outflow, net: inflow - outflow,
        byMethod: [...byMethodMap.entries()].map(([label, amount]) => ({ label, amount })).sort((a, b) => b.amount - a.amount),
      });

      setLoading(false);
    });
  }, [currentOrg?.id, period.from, period.to]);

  const exportCsv = () => {
    if (!pnl || !bs || !cf) return;
    const rows: string[][] = [
      ["Equity.AI Financial Report"],
      ["Workspace", currentOrg?.name ?? ""],
      ["Period", period.label, period.from, period.to],
      [],
      ["PROFIT & LOSS"],
      ["Section", "Line", "Amount"],
      ...pnl.revenue.map((r) => ["Revenue", r.label, r.amount.toFixed(2)]),
      ["", "Total revenue", pnl.totalRevenue.toFixed(2)],
      ...pnl.cogs.map((r) => ["COGS", r.label, r.amount.toFixed(2)]),
      ["", "Gross profit", pnl.gross.toFixed(2)],
      ...pnl.expenses.map((r) => ["Expenses", r.label, r.amount.toFixed(2)]),
      ["", "Net income", pnl.net.toFixed(2)],
      [],
      ["BALANCE SHEET (snapshot)"],
      ["Assets — Cash (period inflow)", "", bs.cash.toFixed(2)],
      ["Assets — Receivables", "", bs.receivables.toFixed(2)],
      ["Assets — Inventory", "", bs.inventory.toFixed(2)],
      ["Liabilities — Payables", "", bs.payables.toFixed(2)],
      ["Equity (residual)", "", bs.equity.toFixed(2)],
      [],
      ["CASH FLOW"],
      ["Inflow", "", cf.inflow.toFixed(2)],
      ["Outflow", "", cf.outflow.toFixed(2)],
      ["Net", "", cf.net.toFixed(2)],
    ];
    const csv = rows.map((r) => r.map((c) => `"${(c ?? "").toString().replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `equity-report-${range}-${period.from}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto w-full">
      <div className="flex items-end justify-between mb-8 animate-reveal flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-1">Reports</h1>
          <p className="text-muted-foreground">Financial statements for {period.label}</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={range} onValueChange={(v) => setRange(v as Range)}>
            <SelectTrigger className="w-44"><Calendar className="size-3.5 mr-1" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="this_month">This month</SelectItem>
              <SelectItem value="last_month">Last month</SelectItem>
              <SelectItem value="qtd">Quarter to date</SelectItem>
              <SelectItem value="ytd">Year to date</SelectItem>
              <SelectItem value="last_year">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={exportCsv} disabled={loading}>
            <Download className="size-4 mr-1.5" />Export CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Kpi label="Revenue" value={money(pnl?.totalRevenue ?? 0, currency)} icon={TrendingUp} tone="text-success" loading={loading} />
        <Kpi label="Net income" value={money(pnl?.net ?? 0, currency)} icon={Scale} tone={(pnl?.net ?? 0) >= 0 ? "text-success" : "text-destructive"} loading={loading} />
        <Kpi label="Receivables" value={money(bs?.receivables ?? 0, currency)} icon={Wallet} tone="text-warning" loading={loading} />
        <Kpi label="Cash inflow" value={money(cf?.inflow ?? 0, currency)} icon={TrendingDown} tone="text-accent" loading={loading} />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="pnl">Profit & Loss</TabsTrigger>
          <TabsTrigger value="bs">Balance Sheet</TabsTrigger>
          <TabsTrigger value="cf">Cash Flow</TabsTrigger>
        </TabsList>

        <TabsContent value="pnl" className="mt-5">
          <Statement>
            <Section title="Revenue">
              {pnl?.revenue.map((r) => <Row key={r.label} label={r.label} amount={r.amount} currency={currency} />)}
              <Row label="Total revenue" amount={pnl?.totalRevenue ?? 0} currency={currency} bold />
            </Section>
            <Section title="Cost of goods sold">
              {pnl?.cogs.map((r) => <Row key={r.label} label={r.label} amount={r.amount} currency={currency} negative />)}
              <Row label="Gross profit" amount={pnl?.gross ?? 0} currency={currency} bold accent />
            </Section>
            <Section title="Operating expenses">
              {pnl?.expenses.length === 0 && <Row label="No expenses in period" amount={0} currency={currency} muted />}
              {pnl?.expenses.map((r) => <Row key={r.label} label={r.label} amount={r.amount} currency={currency} negative />)}
              <Row label="Total expenses" amount={pnl?.totalExpenses ?? 0} currency={currency} bold negative />
            </Section>
            <div className="border-t-2 border-foreground/80 px-5 py-4 bg-muted/30 flex items-center justify-between">
              <span className="font-bold uppercase tracking-wider text-sm">Net income</span>
              <span className={`font-mono text-xl font-bold tracking-tighter ${(pnl?.net ?? 0) >= 0 ? "text-success" : "text-destructive"}`}>
                {money(pnl?.net ?? 0, currency)}
              </span>
            </div>
          </Statement>
        </TabsContent>

        <TabsContent value="bs" className="mt-5">
          <Statement>
            <Section title="Assets">
              <Row label="Cash (period inflow)" amount={bs?.cash ?? 0} currency={currency} />
              <Row label="Accounts receivable" amount={bs?.receivables ?? 0} currency={currency} />
              <Row label="Inventory at cost" amount={bs?.inventory ?? 0} currency={currency} />
              <Row label="Total assets" amount={(bs?.cash ?? 0) + (bs?.receivables ?? 0) + (bs?.inventory ?? 0)} currency={currency} bold />
            </Section>
            <Section title="Liabilities">
              <Row label="Accounts payable" amount={bs?.payables ?? 0} currency={currency} negative />
              <Row label="Total liabilities" amount={bs?.payables ?? 0} currency={currency} bold negative />
            </Section>
            <div className="border-t-2 border-foreground/80 px-5 py-4 bg-muted/30 flex items-center justify-between">
              <span className="font-bold uppercase tracking-wider text-sm">Owner's equity</span>
              <span className="font-mono text-xl font-bold tracking-tighter">{money(bs?.equity ?? 0, currency)}</span>
            </div>
            <p className="px-5 py-3 text-[11px] text-muted-foreground border-t border-border">
              Simplified snapshot derived from operational ledgers. Period: {fmtDate(period.from)} – {fmtDate(period.to)}.
            </p>
          </Statement>
        </TabsContent>

        <TabsContent value="cf" className="mt-5">
          <Statement>
            <Section title="Cash inflow">
              {cf?.byMethod.length === 0 && <Row label="No payments received in period" amount={0} currency={currency} muted />}
              {cf?.byMethod.map((r) => <Row key={r.label} label={r.label.replace("_", " ")} amount={r.amount} currency={currency} />)}
              <Row label="Total inflow" amount={cf?.inflow ?? 0} currency={currency} bold />
            </Section>
            <Section title="Cash outflow">
              <Row label="Bills & purchases" amount={(cf?.outflow ?? 0) - (pnl?.totalExpenses ?? 0)} currency={currency} negative />
              <Row label="Operating expenses" amount={pnl?.totalExpenses ?? 0} currency={currency} negative />
              <Row label="Total outflow" amount={cf?.outflow ?? 0} currency={currency} bold negative />
            </Section>
            <div className="border-t-2 border-foreground/80 px-5 py-4 bg-muted/30 flex items-center justify-between">
              <span className="font-bold uppercase tracking-wider text-sm">Net cash flow</span>
              <span className={`font-mono text-xl font-bold tracking-tighter ${(cf?.net ?? 0) >= 0 ? "text-success" : "text-destructive"}`}>
                {money(cf?.net ?? 0, currency)}
              </span>
            </div>
          </Statement>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Kpi({ label, value, icon: Icon, tone, loading }: { label: string; value: string; icon: React.ComponentType<{ className?: string }>; tone: string; loading: boolean }) {
  return (
    <div className="p-5 border border-border rounded-xl bg-card">
      <div className="flex items-center justify-between mb-2">
        <div className="text-muted-foreground font-medium text-sm">{label}</div>
        <Icon className={`size-4 ${tone}`} />
      </div>
      <div className={`text-2xl font-mono font-bold tracking-tighter ${tone}`}>
        {loading ? <span className="text-muted-foreground">…</span> : value}
      </div>
    </div>
  );
}

function Statement({ children }: { children: React.ReactNode }) {
  return <div className="border border-border rounded-xl overflow-hidden bg-card divide-y divide-border">{children}</div>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="px-5 py-2.5 bg-sidebar text-[11px] uppercase tracking-wider font-bold text-muted-foreground border-b border-border">{title}</div>
      <div className="divide-y divide-border/60">{children}</div>
    </div>
  );
}

function Row({ label, amount, currency, bold, negative, accent, muted }: { label: string; amount: number; currency: string; bold?: boolean; negative?: boolean; accent?: boolean; muted?: boolean }) {
  return (
    <div className={`px-5 py-2.5 flex items-center justify-between ${bold ? "bg-muted/20" : ""}`}>
      <span className={`${bold ? "font-bold" : ""} ${muted ? "text-muted-foreground italic" : ""} text-sm`}>{label}</span>
      <span className={`font-mono tabular-nums ${bold ? "font-bold" : ""} ${accent ? "text-accent" : negative ? "text-destructive" : ""}`}>
        {negative && amount > 0 ? `(${money(amount, currency)})` : money(amount, currency)}
      </span>
    </div>
  );
}
