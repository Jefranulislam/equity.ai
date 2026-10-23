import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/org-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { money, fmtDate } from "@/lib/format";
import { ShieldCheck, FileSpreadsheet, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/compliance")({
  head: () => ({ meta: [{ title: "Compliance — Equity.AI" }] }),
  component: CompliancePage,
});

interface InvRow { id: string; invoice_number: string; issue_date: string; tax_total: number; subtotal: number; total: number; status: string; customer: { billing_name: string; tax_id: string | null } | null; }
interface BillRow { id: string; bill_number: string; issue_date: string; tax_total: number; subtotal: number; total: number; status: string; vendor: { name: string; tax_id: string | null } | null; }

function firstOfMonth() { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0,10); }
function todayStr() { return new Date().toISOString().slice(0,10); }

function CompliancePage() {
  const { currentOrg } = useOrg();
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(todayStr());
  const [invoices, setInvoices] = useState<InvRow[]>([]);
  const [bills, setBills] = useState<BillRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!currentOrg) return;
    setLoading(true);
    const [{ data: inv }, { data: bl }] = await Promise.all([
      supabase.from("invoices")
        .select("id,invoice_number,issue_date,tax_total,subtotal,total,status,customer:customers(billing_name,tax_id)")
        .eq("organization_id", currentOrg.id).gte("issue_date", from).lte("issue_date", to).order("issue_date", { ascending: false }),
      supabase.from("bills")
        .select("id,bill_number,issue_date,tax_total,subtotal,total,status,vendor:vendors(name,tax_id)")
        .eq("organization_id", currentOrg.id).gte("issue_date", from).lte("issue_date", to).order("issue_date", { ascending: false }),
    ]);
    setInvoices((inv ?? []) as unknown as InvRow[]);
    setBills((bl ?? []) as unknown as BillRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [currentOrg?.id, from, to]);

  const totals = useMemo(() => {
    const outputTax = invoices.reduce((s, r) => s + Number(r.tax_total), 0);
    const inputTax = bills.reduce((s, r) => s + Number(r.tax_total), 0);
    const taxableSales = invoices.reduce((s, r) => s + Number(r.subtotal), 0);
    const taxablePurchases = bills.reduce((s, r) => s + Number(r.subtotal), 0);
    const missingCustTax = invoices.filter(i => !i.customer?.tax_id).length;
    const missingVendTax = bills.filter(b => !b.vendor?.tax_id).length;
    return { outputTax, inputTax, net: outputTax - inputTax, taxableSales, taxablePurchases, missingCustTax, missingVendTax };
  }, [invoices, bills]);

  const exportCSV = (rows: Array<Record<string, unknown>>, name: string) => {
    if (!rows.length) return;
    const headers = Object.keys(rows[0]);
    const csv = [headers.join(","), ...rows.map(r => headers.map(h => JSON.stringify(r[h] ?? "")).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `${name}.csv`; a.click();
  };

  return (
    <div className="p-8 max-w-7xl mx-auto w-full">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-1 flex items-center gap-2"><ShieldCheck className="size-6 text-accent" /> Compliance</h1>
          <p className="text-muted-foreground">Tax summary, output vs input tax, and filing-ready exports.</p>
        </div>
        <div className="flex items-end gap-2">
          <div><Label className="text-xs">From</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-40" /></div>
          <div><Label className="text-xs">To</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-40" /></div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tax Collected (Output)</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold tabular-nums">{money(totals.outputTax, currentOrg?.currency)}</div><div className="text-xs text-muted-foreground mt-1">On {invoices.length} invoices</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tax Paid (Input)</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold tabular-nums">{money(totals.inputTax, currentOrg?.currency)}</div><div className="text-xs text-muted-foreground mt-1">On {bills.length} bills</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Net Tax Liability</CardTitle></CardHeader><CardContent><div className={`text-2xl font-bold tabular-nums ${totals.net >= 0 ? "text-warning" : "text-success"}`}>{money(totals.net, currentOrg?.currency)}</div><div className="text-xs text-muted-foreground mt-1">{totals.net >= 0 ? "Payable" : "Refund"}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Compliance Issues</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold tabular-nums flex items-center gap-2">{totals.missingCustTax + totals.missingVendTax}{(totals.missingCustTax + totals.missingVendTax) > 0 && <AlertTriangle className="size-4 text-warning" />}</div><div className="text-xs text-muted-foreground mt-1">Missing tax IDs</div></CardContent></Card>
      </div>

      <Tabs defaultValue="output">
        <TabsList>
          <TabsTrigger value="output">Output Tax (Sales)</TabsTrigger>
          <TabsTrigger value="input">Input Tax (Purchases)</TabsTrigger>
          <TabsTrigger value="returns">Returns & Filings</TabsTrigger>
        </TabsList>

        <TabsContent value="output" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Sales register</CardTitle>
              <button onClick={() => exportCSV(invoices.map(i => ({ invoice: i.invoice_number, date: i.issue_date, customer: i.customer?.billing_name ?? "", tax_id: i.customer?.tax_id ?? "", taxable: i.subtotal, tax: i.tax_total, total: i.total, status: i.status })), `sales-${from}-to-${to}`)} className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 border border-border rounded-md hover:bg-muted">
                <FileSpreadsheet className="size-3.5" /> Export CSV
              </button>
            </CardHeader>
            <CardContent>
              {loading ? <div className="text-sm text-muted-foreground py-8 text-center">Loading…</div> :
              <Table>
                <TableHeader><TableRow><TableHead>Invoice</TableHead><TableHead>Date</TableHead><TableHead>Customer</TableHead><TableHead>Tax ID</TableHead><TableHead className="text-right">Taxable</TableHead><TableHead className="text-right">Tax</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
                <TableBody>
                  {invoices.map(i => (
                    <TableRow key={i.id}>
                      <TableCell className="font-mono text-xs">{i.invoice_number}</TableCell>
                      <TableCell>{fmtDate(i.issue_date)}</TableCell>
                      <TableCell>{i.customer?.billing_name ?? "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{i.customer?.tax_id ?? <span className="text-warning">Missing</span>}</TableCell>
                      <TableCell className="text-right tabular-nums">{money(i.subtotal, currentOrg?.currency)}</TableCell>
                      <TableCell className="text-right tabular-nums">{money(i.tax_total, currentOrg?.currency)}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{money(i.total, currentOrg?.currency)}</TableCell>
                    </TableRow>
                  ))}
                  {!invoices.length && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No invoices in this period</TableCell></TableRow>}
                </TableBody>
              </Table>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="input" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Purchase register</CardTitle>
              <button onClick={() => exportCSV(bills.map(b => ({ bill: b.bill_number, date: b.issue_date, vendor: b.vendor?.name ?? "", tax_id: b.vendor?.tax_id ?? "", taxable: b.subtotal, tax: b.tax_total, total: b.total, status: b.status })), `purchases-${from}-to-${to}`)} className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 border border-border rounded-md hover:bg-muted">
                <FileSpreadsheet className="size-3.5" /> Export CSV
              </button>
            </CardHeader>
            <CardContent>
              {loading ? <div className="text-sm text-muted-foreground py-8 text-center">Loading…</div> :
              <Table>
                <TableHeader><TableRow><TableHead>Bill</TableHead><TableHead>Date</TableHead><TableHead>Vendor</TableHead><TableHead>Tax ID</TableHead><TableHead className="text-right">Taxable</TableHead><TableHead className="text-right">Tax</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
                <TableBody>
                  {bills.map(b => (
                    <TableRow key={b.id}>
                      <TableCell className="font-mono text-xs">{b.bill_number}</TableCell>
                      <TableCell>{fmtDate(b.issue_date)}</TableCell>
                      <TableCell>{b.vendor?.name ?? "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{b.vendor?.tax_id ?? <span className="text-warning">Missing</span>}</TableCell>
                      <TableCell className="text-right tabular-nums">{money(b.subtotal, currentOrg?.currency)}</TableCell>
                      <TableCell className="text-right tabular-nums">{money(b.tax_total, currentOrg?.currency)}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{money(b.total, currentOrg?.currency)}</TableCell>
                    </TableRow>
                  ))}
                  {!bills.length && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No bills in this period</TableCell></TableRow>}
                </TableBody>
              </Table>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="returns" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Filing summary</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Output side</h3>
                  <Row label="Taxable sales" value={money(totals.taxableSales, currentOrg?.currency)} />
                  <Row label="Tax collected" value={money(totals.outputTax, currentOrg?.currency)} />
                  <Row label="Invoices issued" value={String(invoices.length)} />
                  {totals.missingCustTax > 0 && <div className="flex items-center gap-2 text-warning text-xs"><AlertTriangle className="size-3.5" />{totals.missingCustTax} invoices have customers without a tax ID</div>}
                </div>
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Input side</h3>
                  <Row label="Taxable purchases" value={money(totals.taxablePurchases, currentOrg?.currency)} />
                  <Row label="Tax paid" value={money(totals.inputTax, currentOrg?.currency)} />
                  <Row label="Bills received" value={String(bills.length)} />
                  {totals.missingVendTax > 0 && <div className="flex items-center gap-2 text-warning text-xs"><AlertTriangle className="size-3.5" />{totals.missingVendTax} bills from vendors without a tax ID</div>}
                </div>
              </div>
              <div className="mt-6 pt-6 border-t border-border flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Net liability</div>
                  <div className={`text-3xl font-bold tabular-nums ${totals.net >= 0 ? "text-warning" : "text-success"}`}>{money(totals.net, currentOrg?.currency)}</div>
                </div>
                <Badge variant="outline" className="font-mono">{from} → {to}</Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex items-baseline justify-between border-b border-border/50 pb-2"><span className="text-sm text-muted-foreground">{label}</span><span className="font-medium tabular-nums">{value}</span></div>;
}
