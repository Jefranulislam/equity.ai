import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, CircleDollarSign, Trash2, Search, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/org-context";
import { useAuth } from "@/contexts/auth-context";
import { money, fmtDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/payments")({
  head: () => ({ meta: [{ title: "Payments — Equity.AI" }] }),
  component: Payments,
});

type Method = "cash" | "bank_transfer" | "card" | "upi" | "cheque" | "other";
const METHODS: Method[] = ["bank_transfer", "card", "cash", "upi", "cheque", "other"];

interface PaymentRow {
  id: string;
  payment_date: string;
  amount: string | number;
  currency: string;
  method: Method;
  reference: string | null;
  notes: string | null;
  customer: { id: string; billing_name: string } | null;
  links: { id: string; applied_amount: string | number; invoice: { id: string; invoice_number: string } | null }[];
}

function Payments() {
  const { currentOrg } = useOrg();
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const load = async () => {
    if (!currentOrg) return;
    setLoading(true);
    const { data } = await supabase
      .from("payments")
      .select(
        "id,payment_date,amount,currency,method,reference,notes,customer:customers(id,billing_name),links:payment_invoice_links(id,applied_amount,invoice:invoices(id,invoice_number))",
      )
      .eq("organization_id", currentOrg.id)
      .order("payment_date", { ascending: false })
      .limit(200);
    setRows((data ?? []) as unknown as PaymentRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [currentOrg?.id]);

  const filtered = useMemo(() => {
    const s = q.toLowerCase().trim();
    if (!s) return rows;
    return rows.filter((r) =>
      (r.customer?.billing_name ?? "").toLowerCase().includes(s) ||
      (r.reference ?? "").toLowerCase().includes(s) ||
      r.links.some((l) => l.invoice?.invoice_number?.toLowerCase().includes(s)),
    );
  }, [rows, q]);

  const total = filtered.reduce((sum, r) => sum + Number(r.amount), 0);
  const unapplied = filtered.reduce((sum, r) => {
    const applied = r.links.reduce((s, l) => s + Number(l.applied_amount), 0);
    return sum + Math.max(0, Number(r.amount) - applied);
  }, 0);
  const currency = currentOrg?.currency ?? "USD";

  const remove = async (id: string) => {
    if (!confirm("Delete this payment? This will reverse any invoice applications.")) return;
    const { error } = await supabase.from("payments").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Payment deleted");
    load();
  };

  return (
    <div className="p-8 max-w-7xl mx-auto w-full">
      <div className="flex items-end justify-between mb-8 animate-reveal">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-1">Payments</h1>
          <p className="text-muted-foreground">Money received and applied to invoices</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="size-4 mr-1.5" />Record payment</Button>
          </DialogTrigger>
          {open && <RecordPaymentDialog onDone={() => { setOpen(false); load(); }} />}
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
        <Kpi label="Payments shown" value={String(filtered.length)} />
        <Kpi label="Total received" value={money(total, currency)} tone="text-success" />
        <Kpi label="Unapplied (credit)" value={money(unapplied, currency)} tone={unapplied > 0 ? "text-warning" : "text-muted-foreground"} />
      </div>

      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search customer, reference, invoice #" className="pl-9" />
        </div>
      </div>

      <div className="border border-border rounded-xl overflow-hidden bg-card">
        <table className="w-full text-sm">
          <thead className="bg-sidebar border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Date</th>
              <th className="px-4 py-3 text-left font-semibold">Customer</th>
              <th className="px-4 py-3 text-left font-semibold">Method</th>
              <th className="px-4 py-3 text-left font-semibold">Applied to</th>
              <th className="px-4 py-3 text-left font-semibold">Reference</th>
              <th className="px-4 py-3 text-right font-semibold">Amount</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">Loading…</td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                No payments yet. Record your first payment to start tracking cash inflow.
              </td></tr>
            )}
            {filtered.map((r) => {
              const applied = r.links.reduce((s, l) => s + Number(l.applied_amount), 0);
              const credit = Math.max(0, Number(r.amount) - applied);
              return (
                <tr key={r.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-mono text-xs">{fmtDate(r.payment_date)}</td>
                  <td className="px-4 py-3 font-medium">{r.customer?.billing_name ?? <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-4 py-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-muted px-2 py-0.5 rounded">
                      {r.method.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {r.links.length === 0 ? (
                      <span className="text-muted-foreground">Unapplied</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {r.links.slice(0, 3).map((l) =>
                          l.invoice ? (
                            <Link
                              key={l.id}
                              to="/invoices/$invoiceId"
                              params={{ invoiceId: l.invoice.id }}
                              className="font-mono bg-accent/10 text-accent px-1.5 py-0.5 rounded hover:bg-accent/20"
                            >
                              {l.invoice.invoice_number}
                            </Link>
                          ) : null,
                        )}
                        {r.links.length > 3 && <span className="text-muted-foreground">+{r.links.length - 3}</span>}
                      </div>
                    )}
                    {credit > 0 && r.links.length > 0 && (
                      <div className="text-[10px] text-warning font-mono mt-1">{money(credit, r.currency)} credit</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{r.reference ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-right font-medium">{money(r.amount, r.currency)}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => remove(r.id)} className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10" title="Delete">
                      <Trash2 className="size-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Kpi({ label, value, tone = "text-foreground" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="p-5 border border-border rounded-xl bg-card">
      <div className="text-muted-foreground font-medium text-sm mb-2">{label}</div>
      <div className={`text-2xl font-mono font-bold tracking-tighter ${tone}`}>{value}</div>
    </div>
  );
}

/* ──────────── Record Payment dialog (multi-invoice apply) ──────────── */

interface Customer { id: string; billing_name: string; currency: string }
interface OpenInvoice {
  id: string; invoice_number: string; total: string | number; amount_paid: string | number;
  currency: string; due_date: string | null;
}

function RecordPaymentDialog({ onDone }: { onDone: () => void }) {
  const { currentOrg } = useOrg();
  const { user } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState<string>("");
  const [openInvoices, setOpenInvoices] = useState<OpenInvoice[]>([]);
  const [applications, setApplications] = useState<Record<string, string>>({});
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState<Method>("bank_transfer");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!currentOrg) return;
    supabase.from("customers").select("id,billing_name,currency").eq("organization_id", currentOrg.id).order("billing_name")
      .then(({ data }) => setCustomers((data ?? []) as Customer[]));
  }, [currentOrg]);

  useEffect(() => {
    if (!currentOrg || !customerId) { setOpenInvoices([]); return; }
    supabase
      .from("invoices")
      .select("id,invoice_number,total,amount_paid,currency,due_date")
      .eq("organization_id", currentOrg.id)
      .eq("customer_id", customerId)
      .in("status", ["sent", "partial", "draft"])
      .order("issue_date", { ascending: true })
      .then(({ data }) => {
        const open = ((data ?? []) as OpenInvoice[]).filter(
          (i) => Number(i.total) - Number(i.amount_paid) > 0.001,
        );
        setOpenInvoices(open);
      });
  }, [currentOrg, customerId]);

  const autoApply = () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return;
    let remaining = amt;
    const next: Record<string, string> = {};
    for (const inv of openInvoices) {
      const due = Number(inv.total) - Number(inv.amount_paid);
      const apply = Math.min(remaining, due);
      if (apply > 0) next[inv.id] = apply.toFixed(2);
      remaining = Math.max(0, remaining - apply);
      if (remaining <= 0) break;
    }
    setApplications(next);
  };

  const totalApplied = Object.values(applications).reduce((s, v) => s + (parseFloat(v) || 0), 0);
  const remaining = (parseFloat(amount) || 0) - totalApplied;
  const currency = customers.find((c) => c.id === customerId)?.currency ?? currentOrg?.currency ?? "USD";

  const save = async () => {
    if (!currentOrg || !user) return;
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return toast.error("Enter an amount");
    if (totalApplied - amt > 0.01) return toast.error("Applied amount exceeds payment");

    setSaving(true);
    const { data: pay, error } = await supabase.from("payments").insert({
      organization_id: currentOrg.id,
      created_by: user.id,
      customer_id: customerId || null,
      amount: amt,
      currency,
      payment_date: date,
      method,
      reference: reference.trim() || null,
      notes: notes.trim() || null,
    }).select("id").single();

    if (error || !pay) { setSaving(false); return toast.error(error?.message ?? "Failed"); }

    const links = Object.entries(applications)
      .map(([invoice_id, v]) => ({ invoice_id, applied_amount: parseFloat(v) }))
      .filter((l) => l.applied_amount > 0)
      .map((l) => ({ ...l, payment_id: pay.id, organization_id: currentOrg.id }));

    if (links.length > 0) {
      const { error: lerr } = await supabase.from("payment_invoice_links").insert(links);
      if (lerr) { setSaving(false); return toast.error(lerr.message); }
    }

    setSaving(false);
    toast.success("Payment recorded");
    onDone();
  };

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader><DialogTitle>Record payment</DialogTitle></DialogHeader>
      <div className="grid gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label>Customer</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
              <SelectContent>
                {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.billing_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Amount</Label>
            <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
          </div>
          <div className="grid gap-1.5">
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Method</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as Method)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {METHODS.map((m) => <SelectItem key={m} value={m}>{m.replace("_", " ")}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5 col-span-2">
            <Label>Reference</Label>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Txn ID, cheque #, etc." />
          </div>
          <div className="grid gap-1.5 col-span-2">
            <Label>Notes</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        {customerId && (
          <div className="border-t border-border pt-4">
            <div className="flex items-center justify-between mb-3">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Apply to invoices</Label>
              <Button variant="outline" size="sm" onClick={autoApply} disabled={!amount || openInvoices.length === 0}>
                <CircleDollarSign className="size-3.5 mr-1" />Auto-apply
              </Button>
            </div>
            {openInvoices.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4 border border-dashed border-border rounded-md">
                No open invoices for this customer. Payment will be saved as unapplied credit.
              </p>
            ) : (
              <div className="border border-border rounded-md max-h-56 overflow-y-auto divide-y divide-border">
                {openInvoices.map((inv) => {
                  const due = Number(inv.total) - Number(inv.amount_paid);
                  const applied = applications[inv.id] ?? "";
                  return (
                    <div key={inv.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                      <div className="flex-1 min-w-0">
                        <div className="font-mono">{inv.invoice_number}</div>
                        <div className="text-xs text-muted-foreground">Due {fmtDate(inv.due_date)} · {money(due, inv.currency)} outstanding</div>
                      </div>
                      <Input
                        type="number"
                        step="0.01"
                        max={due}
                        placeholder="0.00"
                        value={applied}
                        onChange={(e) => setApplications({ ...applications, [inv.id]: e.target.value })}
                        className="w-28 text-right font-mono"
                      />
                      {applied && (
                        <button onClick={() => { const n = { ...applications }; delete n[inv.id]; setApplications(n); }} className="text-muted-foreground hover:text-foreground">
                          <X className="size-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            <div className="flex justify-between text-xs mt-3 font-mono">
              <span className="text-muted-foreground">Applied {money(totalApplied, currency)} of {money(parseFloat(amount) || 0, currency)}</span>
              <span className={remaining < -0.01 ? "text-destructive" : remaining > 0.01 ? "text-warning" : "text-success"}>
                {remaining < -0.01 ? `Over by ${money(-remaining, currency)}` : remaining > 0.01 ? `${money(remaining, currency)} unapplied` : "Fully applied"}
              </span>
            </div>
          </div>
        )}
      </div>
      <DialogFooter>
        <Button onClick={save} disabled={saving || !amount}>{saving ? "Saving…" : "Record payment"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}
