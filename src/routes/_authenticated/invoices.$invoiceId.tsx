import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/org-context";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, Plus, Trash2, CircleDollarSign, Printer } from "lucide-react";
import { toast } from "sonner";
import { money, fmtDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/invoices/$invoiceId")({
  component: InvoiceDetailPage,
});

type Num = number | string;
interface Invoice {
  id: string; invoice_number: string; issue_date: string; due_date: string | null;
  status: "draft" | "sent" | "partial" | "paid" | "void";
  subtotal: Num; tax_total: Num; total: Num; amount_paid: Num;
  currency: string; notes: string | null;
  customers: { id: string; billing_name: string; email: string | null; billing_address: string | null } | null;
}
interface Line { id: string; description: string; quantity: Num; unit_price: Num; tax_rate: Num; line_total: Num; }
interface PaymentLink {
  id: string; applied_amount: Num;
  payments: { id: string; payment_date: string; method: string; reference: string | null; amount: Num } | null;
}

const STATUS_COLOR: Record<Invoice["status"], string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  partial: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  paid: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  void: "bg-destructive/10 text-destructive",
};

function InvoiceDetailPage() {
  const { invoiceId } = Route.useParams();
  const { currentOrg } = useOrg();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [inv, setInv] = useState<Invoice | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [pays, setPays] = useState<PaymentLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [payOpen, setPayOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: invData, error }, { data: linesData }, { data: paysData }] = await Promise.all([
      supabase.from("invoices").select("*,customers(id,billing_name,email,billing_address)").eq("id", invoiceId).single(),
      supabase.from("invoice_lines").select("*").eq("invoice_id", invoiceId).order("position"),
      supabase.from("payment_invoice_links").select("id,applied_amount,payments(id,payment_date,method,reference,amount)").eq("invoice_id", invoiceId),
    ]);
    if (error) toast.error(error.message);
    setInv(invData as unknown as Invoice);
    setLines((linesData ?? []) as Line[]);
    setPays((paysData ?? []) as unknown as PaymentLink[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [invoiceId]);

  const remove = async () => {
    if (!confirm("Delete this invoice?")) return;
    const { error } = await supabase.from("invoices").delete().eq("id", invoiceId);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    navigate({ to: "/invoices" });
  };

  const setStatus = async (status: Invoice["status"]) => {
    const { error } = await supabase.from("invoices").update({ status }).eq("id", invoiceId);
    if (error) return toast.error(error.message);
    load();
  };

  if (loading || !inv) return <div className="p-8 text-muted-foreground">Loading…</div>;

  const due = Number(inv.total) - Number(inv.amount_paid);

  return (
    <div className="p-8 max-w-5xl mx-auto w-full animate-reveal print-area">
      <Link to="/invoices" className="no-print inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="size-3.5" /> Back to invoices
      </Link>

      {/* Print-only branded header */}
      <div className="print-only mb-8 pb-6 border-b-2 border-foreground/80">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-2xl font-bold tracking-tight">{currentOrg?.name ?? "Invoice"}</div>
            <div className="text-xs text-muted-foreground mt-1">{currentOrg?.country} · {currentOrg?.currency}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Invoice</div>
            <div className="text-xl font-mono font-bold">{inv.invoice_number}</div>
          </div>
        </div>
        {inv.customers && (
          <div className="mt-5 grid grid-cols-2 gap-8 text-sm">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Bill to</div>
              <div className="font-semibold">{inv.customers.billing_name}</div>
              {inv.customers.email && <div className="text-muted-foreground">{inv.customers.email}</div>}
              {inv.customers.billing_address && <div className="text-muted-foreground whitespace-pre-line">{inv.customers.billing_address}</div>}
            </div>
            <div className="text-right">
              <div><span className="text-muted-foreground">Issued:</span> <span className="font-mono">{fmtDate(inv.issue_date)}</span></div>
              <div><span className="text-muted-foreground">Due:</span> <span className="font-mono">{fmtDate(inv.due_date)}</span></div>
              <div className="mt-1"><span className="text-muted-foreground">Status:</span> <span className="font-bold uppercase">{inv.status}</span></div>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-start justify-between mb-8 no-print">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold tracking-tight font-mono">{inv.invoice_number}</h1>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${STATUS_COLOR[inv.status]}`}>{inv.status}</span>
          </div>
          <p className="text-muted-foreground">
            {inv.customers?.billing_name ?? "No customer"} · Issued {fmtDate(inv.issue_date)} · Due {fmtDate(inv.due_date)}
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={inv.status} onValueChange={(v) => setStatus(v as Invoice["status"])}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(["draft","sent","partial","paid","void"] as const).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => window.print()} title="Print / Save as PDF">
            <Printer className="size-4 mr-1.5" />Print
          </Button>
          <Dialog open={payOpen} onOpenChange={setPayOpen}>
            <DialogTrigger asChild>
              <Button disabled={inv.status === "void" || due <= 0}><CircleDollarSign className="size-4 mr-1.5" />Record payment</Button>
            </DialogTrigger>
            <PaymentDialog inv={inv} due={due} orgId={currentOrg?.id ?? ""} userId={user?.id ?? ""} onDone={() => { setPayOpen(false); load(); }} />
          </Dialog>
          <Button variant="outline" onClick={remove}><Trash2 className="size-4" /></Button>
        </div>
      </div>

      <div className="border border-border rounded-xl overflow-hidden bg-card mb-6">
        <table className="w-full text-sm">
          <thead className="bg-sidebar/60 text-muted-foreground text-[11px] uppercase tracking-wider">
            <tr>
              <th className="text-left px-4 py-2">Description</th>
              <th className="text-right px-4 py-2">Qty</th>
              <th className="text-right px-4 py-2">Unit</th>
              <th className="text-right px-4 py-2">Tax</th>
              <th className="text-right px-4 py-2">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id} className="border-t border-border">
                <td className="px-4 py-2.5">{l.description}</td>
                <td className="px-4 py-2.5 text-right text-muted-foreground">{l.quantity}</td>
                <td className="px-4 py-2.5 text-right text-muted-foreground">{money(l.unit_price, inv.currency)}</td>
                <td className="px-4 py-2.5 text-right text-muted-foreground">{l.tax_rate}%</td>
                <td className="px-4 py-2.5 text-right font-medium">{money(l.line_total, inv.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <h2 className="font-bold text-sm mb-3 uppercase tracking-wider text-muted-foreground">Payments</h2>
          {pays.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payments recorded.</p>
          ) : (
            <div className="border border-border rounded-xl divide-y divide-border bg-card">
              {pays.map((p) => p.payments && (
                <div key={p.id} className="px-4 py-3 flex justify-between items-center">
                  <div>
                    <div className="font-medium">{money(p.applied_amount, inv.currency)}</div>
                    <div className="text-xs text-muted-foreground">{fmtDate(p.payments.payment_date)} · {p.payments.method}{p.payments.reference ? ` · ${p.payments.reference}` : ""}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-sidebar/40 border border-border rounded-xl p-5 space-y-2 self-start">
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span>{money(inv.subtotal, inv.currency)}</span></div>
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Tax</span><span>{money(inv.tax_total, inv.currency)}</span></div>
          <div className="flex justify-between font-bold pt-2 border-t border-border"><span>Total</span><span>{money(inv.total, inv.currency)}</span></div>
          <div className="flex justify-between text-sm text-muted-foreground"><span>Paid</span><span>{money(inv.amount_paid, inv.currency)}</span></div>
          <div className="flex justify-between font-bold text-accent"><span>Due</span><span>{money(due, inv.currency)}</span></div>
        </div>
      </div>

      {inv.notes && (
        <div className="mt-6">
          <h2 className="font-bold text-sm mb-2 uppercase tracking-wider text-muted-foreground">Notes</h2>
          <p className="text-sm whitespace-pre-wrap">{inv.notes}</p>
        </div>
      )}
    </div>
  );
}

function PaymentDialog({ inv, due, orgId, userId, onDone }:
  { inv: Invoice; due: number; orgId: string; userId: string; onDone: () => void }) {
  const [amount, setAmount] = useState(due.toFixed(2));
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState<"cash" | "bank_transfer" | "card" | "upi" | "cheque" | "other">("bank_transfer");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { toast.error("Enter an amount"); return; }
    setSaving(true);
    const { data: pay, error } = await supabase.from("payments").insert({
      organization_id: orgId,
      created_by: userId,
      customer_id: inv.customers?.id ?? null,
      amount: amt, currency: inv.currency,
      payment_date: date, method,
      reference: reference.trim() || null, notes: notes.trim() || null,
    }).select("id").single();
    if (error || !pay) { setSaving(false); toast.error(error?.message ?? "Failed"); return; }
    const { error: lerr } = await supabase.from("payment_invoice_links").insert({
      payment_id: pay.id, invoice_id: inv.id, organization_id: orgId, applied_amount: amt,
    });
    setSaving(false);
    if (lerr) { toast.error(lerr.message); return; }
    toast.success("Payment recorded");
    onDone();
  };

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Record payment</DialogTitle></DialogHeader>
      <div className="grid gap-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5"><Label>Amount</Label><Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
          <div className="grid gap-1.5"><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        </div>
        <div className="grid gap-1.5">
          <Label>Method</Label>
          <Select value={method} onValueChange={(v) => setMethod(v as typeof method)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="bank_transfer">Bank transfer</SelectItem>
              <SelectItem value="card">Card</SelectItem>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="upi">UPI</SelectItem>
              <SelectItem value="cheque">Cheque</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5"><Label>Reference</Label><Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Txn ID, cheque #, etc." /></div>
        <div className="grid gap-1.5"><Label>Notes</Label><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
      </div>
      <DialogFooter>
        <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Record payment"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}
