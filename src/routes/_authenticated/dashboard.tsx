import { createFileRoute, Link } from "@tanstack/react-router";
import { TrendingUp, AlertCircle, Sparkles, ArrowUpRight } from "lucide-react";
import { useEffect, useState } from "react";
import { useOrg } from "@/contexts/org-context";
import { supabase } from "@/integrations/supabase/client";
import { money, fmtDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Equity.AI" }] }),
  component: Dashboard,
});

interface Kpis {
  revenue: number;
  receivables: number;
  payables: number;
  expenses: number;
  overdueCount: number;
  monthly: number[];
}

interface RecentInvoice {
  id: string;
  invoice_number: string;
  total: string;
  status: string;
  customer: { billing_name: string } | null;
}

const STATUS_TONE: Record<string, string> = {
  paid: "bg-success/10 text-success",
  partial: "bg-warning/10 text-warning",
  sent: "bg-accent/10 text-accent",
  draft: "bg-muted text-muted-foreground",
  void: "bg-destructive/10 text-destructive",
};

function Dashboard() {
  const { currentOrg } = useOrg();
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [invoices, setInvoices] = useState<RecentInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const currency = currentOrg?.currency ?? "USD";

  useEffect(() => {
    if (!currentOrg) return;
    let alive = true;
    (async () => {
      setLoading(true);
      const orgId = currentOrg.id;
      const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString();

      const [invAll, invRecent, billsRes, expRes] = await Promise.all([
        supabase
          .from("invoices")
          .select("total,amount_paid,status,issue_date,due_date")
          .eq("organization_id", orgId)
          .gte("issue_date", yearStart),
        supabase
          .from("invoices")
          .select("id,invoice_number,total,status,customer:customers(billing_name)")
          .eq("organization_id", orgId)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("bills")
          .select("total,status")
          .eq("organization_id", orgId)
          .in("status", ["open", "partial"]),
        supabase
          .from("expenses")
          .select("amount,expense_date")
          .eq("organization_id", orgId)
          .gte("expense_date", yearStart.slice(0, 10)),
      ]);

      if (!alive) return;

      const monthly = Array(12).fill(0);
      let revenue = 0;
      let receivables = 0;
      let overdueCount = 0;
      const today = new Date().toISOString().slice(0, 10);
      for (const r of invAll.data ?? []) {
        if (r.status === "void") continue;
        const total = Number(r.total ?? 0);
        const paid = Number(r.amount_paid ?? 0);
        revenue += paid;
        const outstanding = Math.max(total - paid, 0);
        receivables += outstanding;
        if (outstanding > 0 && r.due_date && r.due_date < today) overdueCount++;
        const m = new Date(r.issue_date).getMonth();
        monthly[m] += total;
      }

      const payables = (billsRes.data ?? []).reduce(
        (sum, b) => sum + Number(b.total ?? 0),
        0,
      );
      const expenses = (expRes.data ?? []).reduce(
        (sum, e) => sum + Number(e.amount ?? 0),
        0,
      );

      setKpis({ revenue, receivables, payables, expenses, overdueCount, monthly });
      setInvoices((invRecent.data ?? []) as unknown as RecentInvoice[]);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [currentOrg]);

  const maxBar = Math.max(1, ...(kpis?.monthly ?? [1]));
  const currentMonth = new Date().getMonth();

  return (
    <div className="p-8 max-w-7xl mx-auto w-full">
      <div className="flex items-end justify-between mb-8 animate-reveal">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-1">Overview</h1>
          <p className="text-muted-foreground">
            Real-time financial health{currentOrg ? ` — ${currentOrg.name}` : ""}
          </p>
        </div>
        <Link
          to="/invoices/new"
          className="px-3 py-1.5 bg-accent text-accent-foreground rounded-md font-medium hover:opacity-90 transition-opacity flex items-center gap-1.5"
        >
          New invoice <ArrowUpRight className="size-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Kpi label="Revenue (YTD)" value={money(kpis?.revenue ?? 0, currency)} hint="Payments received" tone="text-success" loading={loading} />
        <Kpi
          label="Receivables"
          value={money(kpis?.receivables ?? 0, currency)}
          hint={kpis?.overdueCount ? `${kpis.overdueCount} overdue` : "All current"}
          tone={kpis?.overdueCount ? "text-warning" : "text-muted-foreground"}
          loading={loading}
        />
        <Kpi label="Payables" value={money(kpis?.payables ?? 0, currency)} hint="Bills outstanding" tone="text-muted-foreground" loading={loading} />
        <Kpi label="Expenses (YTD)" value={money(kpis?.expenses ?? 0, currency)} hint="Operating spend" tone="text-muted-foreground" loading={loading} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="p-6 border border-border rounded-xl bg-sidebar/50 animate-reveal" style={{ animationDelay: "250ms" }}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="font-bold text-base">Invoice Volume</h2>
                <p className="text-[11px] text-muted-foreground mt-0.5">Issued totals · {new Date().getFullYear()}</p>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-success">
                <TrendingUp className="size-3" /> Live
              </div>
            </div>
            <div className="h-48 flex items-end gap-1.5">
              {(kpis?.monthly ?? Array(12).fill(0)).map((h, i) => (
                <div
                  key={i}
                  className={`flex-1 rounded-t transition-colors ${i === currentMonth ? "bg-accent" : "bg-accent/10 hover:bg-accent/30"}`}
                  style={{ height: `${Math.max(2, (h / maxBar) * 100)}%` }}
                  title={money(h, currency)}
                />
              ))}
            </div>
            <div className="flex justify-between mt-2 text-[10px] text-muted-foreground font-mono">
              {["J","F","M","A","M","J","J","A","S","O","N","D"].map((m, i) => (
                <span key={i} className={i === currentMonth ? "text-accent font-bold" : ""}>{m}</span>
              ))}
            </div>
          </div>

          <div className="animate-reveal" style={{ animationDelay: "300ms" }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-base">Recent Invoices</h2>
              <Link to="/invoices" className="text-muted-foreground hover:text-foreground text-[12px] font-medium">View all</Link>
            </div>
            <div className="border border-border rounded-xl overflow-hidden bg-card shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="bg-sidebar border-b border-border">
                  <tr>
                    <th className="px-4 py-3 font-semibold text-muted-foreground text-[11px] uppercase tracking-wider">Invoice #</th>
                    <th className="px-4 py-3 font-semibold text-muted-foreground text-[11px] uppercase tracking-wider">Customer</th>
                    <th className="px-4 py-3 font-semibold text-muted-foreground text-[11px] uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 font-semibold text-muted-foreground text-[11px] uppercase tracking-wider text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading && (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
                  )}
                  {!loading && invoices.length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                      No invoices yet. <Link to="/invoices/new" className="text-accent">Create one</Link>.
                    </td></tr>
                  )}
                  {invoices.map((row) => (
                    <tr key={row.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-4 py-3 font-mono">
                        <Link to="/invoices/$invoiceId" params={{ invoiceId: row.id }} className="hover:text-accent">
                          {row.invoice_number}
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-medium">{row.customer?.billing_name ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${STATUS_TONE[row.status] ?? "bg-muted text-muted-foreground"}`}>{row.status}</span>
                      </td>
                      <td className="px-4 py-3 font-mono text-right">{money(row.total, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-6 animate-reveal" style={{ animationDelay: "350ms" }}>
          <Link to="/ai-agent" className="block p-6 rounded-xl border border-accent bg-accent text-accent-foreground shadow-lg hover:opacity-95 transition-opacity">
            <div className="flex items-center gap-2 mb-4">
              <div className="size-5 rounded-full border border-white/20 flex items-center justify-center">
                <Sparkles className="size-2.5 animate-pulse" />
              </div>
              <h2 className="font-bold tracking-tight">Ask Freya</h2>
            </div>
            <p className="text-[12px] opacity-90 leading-relaxed">
              Your AI accountant. Ask anything about cashflow, taxes, or top customers.
            </p>
            <div className="mt-3 text-[11px] uppercase tracking-widest opacity-60 font-bold">Open agent →</div>
          </Link>

          <div className="p-5 rounded-xl border border-border bg-muted/40">
            <div className="text-muted-foreground font-bold text-[11px] uppercase tracking-widest mb-4 flex items-center gap-1.5">
              <AlertCircle className="size-3" /> Health
            </div>
            <Bar
              label="Collection rate"
              value={
                kpis && kpis.revenue + kpis.receivables > 0
                  ? Math.round((kpis.revenue / (kpis.revenue + kpis.receivables)) * 100)
                  : 0
              }
              color="bg-success"
            />
            <div className="h-3" />
            <Bar
              label="Cash coverage"
              value={
                kpis && kpis.payables > 0
                  ? Math.min(100, Math.round((kpis.revenue / kpis.payables) * 10))
                  : 100
              }
              color="bg-warning"
            />
          </div>

          <div className="text-[11px] text-muted-foreground">
            Updated {fmtDate(new Date().toISOString())}
          </div>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, hint, tone, loading }: { label: string; value: string; hint: string; tone: string; loading: boolean }) {
  return (
    <div className="p-5 border border-border rounded-xl bg-card animate-reveal">
      <div className="text-muted-foreground font-medium mb-3 text-sm">{label}</div>
      <div className="text-2xl font-mono font-bold tracking-tighter">
        {loading ? <span className="text-muted-foreground/40">···</span> : value}
      </div>
      <div className={`mt-2 text-[11px] font-bold uppercase tracking-wide ${tone}`}>{hint}</div>
    </div>
  );
}

function Bar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between text-[12px] mb-1.5">
        <span>{label}</span>
        <span className="font-mono">{value}/100</span>
      </div>
      <div className="h-1.5 bg-border rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all duration-1000`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
