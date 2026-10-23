import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/org-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { money } from "@/lib/format";
import { TrendingUp, Users, DollarSign } from "lucide-react";

export const Route = createFileRoute("/_authenticated/sales")({
  head: () => ({ meta: [{ title: "Sales — Equity.AI" }] }),
  component: SalesPage,
});

interface InvRow { id: string; issue_date: string; total: number; amount_paid: number; status: string; customer_id: string | null; customer: { billing_name: string } | null; }
interface LineRow { description: string; quantity: number; unit_price: number; line_total: number; }

function SalesPage() {
  const { currentOrg } = useOrg();
  const [invs, setInvs] = useState<InvRow[]>([]);
  const [lines, setLines] = useState<LineRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentOrg) return;
    (async () => {
      setLoading(true);
      const [{ data: i }, { data: l }] = await Promise.all([
        supabase.from("invoices").select("id,issue_date,total,amount_paid,status,customer_id,customer:customers(billing_name)").eq("organization_id", currentOrg.id),
        supabase.from("invoice_lines").select("description,quantity,unit_price,line_total").eq("organization_id", currentOrg.id),
      ]);
      setInvs((i ?? []) as unknown as InvRow[]);
      setLines((l ?? []) as unknown as LineRow[]);
      setLoading(false);
    })();
  }, [currentOrg?.id]);

  const stats = useMemo(() => {
    const revenue = invs.reduce((s, r) => s + Number(r.amount_paid), 0);
    const outstanding = invs.filter(r => r.status !== "void").reduce((s, r) => s + (Number(r.total) - Number(r.amount_paid)), 0);
    const customers = new Set(invs.map(i => i.customer_id).filter(Boolean)).size;
    const avg = invs.length ? invs.reduce((s, r) => s + Number(r.total), 0) / invs.length : 0;
    return { revenue, outstanding, customers, avg, count: invs.length };
  }, [invs]);

  const byCustomer = useMemo(() => {
    const map = new Map<string, { name: string; total: number; paid: number; count: number }>();
    for (const i of invs) {
      const k = i.customer?.billing_name ?? "—";
      const cur = map.get(k) ?? { name: k, total: 0, paid: 0, count: 0 };
      cur.total += Number(i.total); cur.paid += Number(i.amount_paid); cur.count += 1;
      map.set(k, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 10);
  }, [invs]);

  const byMonth = useMemo(() => {
    const map = new Map<string, number>();
    for (const i of invs) {
      const k = i.issue_date.slice(0, 7);
      map.set(k, (map.get(k) ?? 0) + Number(i.total));
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-12);
  }, [invs]);

  const topItems = useMemo(() => {
    const map = new Map<string, { description: string; qty: number; revenue: number }>();
    for (const l of lines) {
      const cur = map.get(l.description) ?? { description: l.description, qty: 0, revenue: 0 };
      cur.qty += Number(l.quantity); cur.revenue += Number(l.line_total);
      map.set(l.description, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  }, [lines]);

  const maxBar = Math.max(...byMonth.map(([, v]) => v), 1);

  return (
    <div className="p-8 max-w-7xl mx-auto w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight mb-1 flex items-center gap-2"><TrendingUp className="size-6 text-accent" /> Sales</h1>
        <p className="text-muted-foreground">Revenue, customer concentration, and product performance.</p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Collected Revenue</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold tabular-nums">{money(stats.revenue, currentOrg?.currency)}</div><div className="text-xs text-muted-foreground mt-1">From {stats.count} invoices</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Outstanding</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold tabular-nums text-warning">{money(stats.outstanding, currentOrg?.currency)}</div><div className="text-xs text-muted-foreground mt-1">Awaiting payment</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Active Customers</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold tabular-nums flex items-center gap-2"><Users className="size-5 text-muted-foreground" />{stats.customers}</div><div className="text-xs text-muted-foreground mt-1">Billed at least once</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Avg Invoice</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold tabular-nums flex items-center gap-2"><DollarSign className="size-5 text-muted-foreground" />{money(stats.avg, currentOrg?.currency)}</div><div className="text-xs text-muted-foreground mt-1">Per invoice</div></CardContent></Card>
      </div>

      <Card className="mb-6">
        <CardHeader><CardTitle>Revenue trend</CardTitle></CardHeader>
        <CardContent>
          {loading ? <div className="text-sm text-muted-foreground py-8 text-center">Loading…</div> :
          byMonth.length === 0 ? <div className="text-sm text-muted-foreground py-8 text-center">No sales data yet</div> :
          <div className="flex items-end gap-3 h-48">
            {byMonth.map(([month, total]) => (
              <div key={month} className="flex-1 flex flex-col items-center gap-2 group">
                <div className="text-xs font-medium tabular-nums opacity-0 group-hover:opacity-100 transition-opacity">{money(total, currentOrg?.currency)}</div>
                <div className="w-full bg-accent rounded-t transition-all hover:bg-accent/80" style={{ height: `${(total / maxBar) * 160}px` }} />
                <div className="text-[10px] text-muted-foreground tabular-nums">{month}</div>
              </div>
            ))}
          </div>}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Top customers</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Customer</TableHead><TableHead className="text-right">Invoices</TableHead><TableHead className="text-right">Billed</TableHead></TableRow></TableHeader>
              <TableBody>
                {byCustomer.map(c => (
                  <TableRow key={c.name}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.count}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{money(c.total, currentOrg?.currency)}</TableCell>
                  </TableRow>
                ))}
                {!byCustomer.length && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">No data</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Top line items</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Item</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Revenue</TableHead></TableRow></TableHeader>
              <TableBody>
                {topItems.map(t => (
                  <TableRow key={t.description}>
                    <TableCell className="font-medium truncate max-w-[200px]">{t.description}</TableCell>
                    <TableCell className="text-right tabular-nums">{t.qty}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{money(t.revenue, currentOrg?.currency)}</TableCell>
                  </TableRow>
                ))}
                {!topItems.length && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">No data</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
