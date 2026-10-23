import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/org-context";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { money, fmtDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/credit-notes")({
  head: () => ({ meta: [{ title: "Credit Notes — Equity.AI" }] }),
  component: Page,
});

interface CN { id: string; credit_number: string; issue_date: string; status: string; total: number; currency: string; reason: string | null; customer: { billing_name: string } | null; invoice: { invoice_number: string } | null; }
interface Line { description: string; quantity: string; unit_price: string; tax_rate: string; }
const newLine = (): Line => ({ description: "", quantity: "1", unit_price: "0", tax_rate: "0" });

function Page() {
  const { currentOrg } = useOrg();
  const { user } = useAuth();
  const [rows, setRows] = useState<CN[]>([]);
  const [customers, setCustomers] = useState<{ id: string; billing_name: string }[]>([]);
  const [invoices, setInvoices] = useState<{ id: string; invoice_number: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [issue, setIssue] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");
  const [lines, setLines] = useState<Line[]>([newLine()]);

  const load = async () => {
    if (!currentOrg) return;
    const [c, cu, inv] = await Promise.all([
      supabase.from("credit_notes").select("id,credit_number,issue_date,status,total,currency,reason,customer:customers(billing_name),invoice:invoices(invoice_number)").eq("organization_id", currentOrg.id).order("created_at", { ascending: false }),
      supabase.from("customers").select("id,billing_name").eq("organization_id", currentOrg.id).order("billing_name"),
      supabase.from("invoices").select("id,invoice_number").eq("organization_id", currentOrg.id).order("created_at", { ascending: false }).limit(100),
    ]);
    setRows((c.data ?? []) as unknown as CN[]);
    setCustomers((cu.data ?? []) as { id: string; billing_name: string }[]);
    setInvoices((inv.data ?? []) as { id: string; invoice_number: string }[]);
  };
  useEffect(() => { load(); }, [currentOrg?.id]);

  const subtotal = lines.reduce((s, l) => s + (+l.quantity || 0) * (+l.unit_price || 0), 0);
  const tax = lines.reduce((s, l) => s + (+l.quantity || 0) * (+l.unit_price || 0) * (+l.tax_rate || 0) / 100, 0);

  const save = async () => {
    if (!currentOrg || !user) return;
    const valid = lines.filter(l => l.description.trim() && +l.quantity > 0);
    if (!valid.length) return toast.error("Add at least one line");
    setSaving(true);
    const { data: cn, error } = await supabase.from("credit_notes").insert({
      organization_id: currentOrg.id, customer_id: customerId || null, invoice_id: invoiceId || null,
      issue_date: issue, reason: reason || null, currency: currentOrg.currency,
      status: "issued", created_by: user.id, credit_number: "",
    }).select("id").single();
    if (error || !cn) { setSaving(false); return toast.error(error?.message ?? "Failed"); }
    const { error: le } = await supabase.from("credit_note_lines").insert(valid.map((l, i) => ({
      organization_id: currentOrg.id, credit_note_id: cn.id, position: i,
      description: l.description, quantity: +l.quantity, unit_price: +l.unit_price, tax_rate: +l.tax_rate,
    })));
    if (le) { setSaving(false); return toast.error(le.message); }
    toast.success("Credit note issued"); setOpen(false); setLines([newLine()]); load();
    setSaving(false);
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Credit Notes</h1><p className="text-muted-foreground text-sm">Refund or credit issued against a customer invoice</p></div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="size-4 mr-1" />New credit note</Button></DialogTrigger>
          <DialogContent className="max-w-3xl">
            <DialogHeader><DialogTitle>New credit note</DialogTitle></DialogHeader>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Customer</Label>
                <Select value={customerId} onValueChange={setCustomerId}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{customers.map(c => <SelectItem key={c.id} value={c.id}>{c.billing_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Against invoice</Label>
                <Select value={invoiceId} onValueChange={setInvoiceId}><SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                  <SelectContent>{invoices.map(i => <SelectItem key={i.id} value={i.id}>{i.invoice_number}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Date</Label><Input type="date" value={issue} onChange={e => setIssue(e.target.value)} /></div>
            </div>
            <div className="space-y-2 mt-3">
              <Label>Lines</Label>
              {lines.map((l, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-start">
                  <Input className="col-span-5" placeholder="Description" value={l.description} onChange={e => setLines(ls => ls.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} />
                  <Input className="col-span-2" type="number" step="0.01" placeholder="Qty" value={l.quantity} onChange={e => setLines(ls => ls.map((x, j) => j === i ? { ...x, quantity: e.target.value } : x))} />
                  <Input className="col-span-2" type="number" step="0.01" placeholder="Price" value={l.unit_price} onChange={e => setLines(ls => ls.map((x, j) => j === i ? { ...x, unit_price: e.target.value } : x))} />
                  <Input className="col-span-2" type="number" step="0.01" placeholder="Tax%" value={l.tax_rate} onChange={e => setLines(ls => ls.map((x, j) => j === i ? { ...x, tax_rate: e.target.value } : x))} />
                  <Button variant="ghost" size="icon" className="col-span-1" onClick={() => setLines(ls => ls.filter((_, j) => j !== i))}><Trash2 className="size-4" /></Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setLines(ls => [...ls, newLine()])}><Plus className="size-3 mr-1" />Add line</Button>
            </div>
            <div className="flex justify-end gap-6 mt-3 text-sm">
              <span>Total: <b>{money(subtotal + tax, currentOrg?.currency)}</b></span>
            </div>
            <div><Label>Reason</Label><Input value={reason} onChange={e => setReason(e.target.value)} /></div>
            <DialogFooter><Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Issue credit note"}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <div className="border rounded-lg">
        <Table>
          <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Customer</TableHead><TableHead>Invoice</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No credit notes yet</TableCell></TableRow> :
              rows.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono">{r.credit_number}</TableCell>
                  <TableCell>{r.customer?.billing_name ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{r.invoice?.invoice_number ?? "—"}</TableCell>
                  <TableCell>{fmtDate(r.issue_date)}</TableCell>
                  <TableCell><span className="capitalize text-xs">{r.status}</span></TableCell>
                  <TableCell className="text-right font-semibold">{money(r.total, r.currency)}</TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
