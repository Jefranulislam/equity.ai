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
import { Plus, Trash2, ArrowRightCircle } from "lucide-react";
import { toast } from "sonner";
import { money, fmtDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/quotes")({
  head: () => ({ meta: [{ title: "Quotes — Equity.AI" }] }),
  component: Page,
});

interface Q { id: string; quote_number: string; issue_date: string; expiry_date: string | null; status: string; total: number; currency: string; converted_invoice_id: string | null; customer: { billing_name: string } | null; }
interface Line { description: string; quantity: string; unit_price: string; tax_rate: string; }
const newLine = (): Line => ({ description: "", quantity: "1", unit_price: "0", tax_rate: "0" });

function Page() {
  const { currentOrg } = useOrg();
  const { user } = useAuth();
  const [rows, setRows] = useState<Q[]>([]);
  const [customers, setCustomers] = useState<{ id: string; billing_name: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [issue, setIssue] = useState(new Date().toISOString().slice(0, 10));
  const [expiry, setExpiry] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([newLine()]);

  const load = async () => {
    if (!currentOrg) return;
    const [q, c] = await Promise.all([
      supabase.from("quotes").select("id,quote_number,issue_date,expiry_date,status,total,currency,converted_invoice_id,customer:customers(billing_name)").eq("organization_id", currentOrg.id).order("created_at", { ascending: false }),
      supabase.from("customers").select("id,billing_name").eq("organization_id", currentOrg.id).order("billing_name"),
    ]);
    if (q.error) { toast.error(`Failed to load quotes: ${q.error.message}`); return; }
    setRows((q.data ?? []) as unknown as Q[]);
    setCustomers((c.data ?? []) as { id: string; billing_name: string }[]);
  };
  useEffect(() => { load(); }, [currentOrg?.id]);

  const subtotal = lines.reduce((s, l) => s + (+l.quantity || 0) * (+l.unit_price || 0), 0);
  const tax = lines.reduce((s, l) => s + (+l.quantity || 0) * (+l.unit_price || 0) * (+l.tax_rate || 0) / 100, 0);

  const resetForm = () => {
    setCustomerId("");
    setIssue(new Date().toISOString().slice(0, 10));
    setExpiry("");
    setNotes("");
    setLines([newLine()]);
  };

  const save = async () => {
    if (!currentOrg || !user) { toast.error("Organisation not loaded — please refresh"); return; }
    const valid = lines.filter(l => l.description.trim() && +l.quantity > 0);
    if (!valid.length) return toast.error("Add at least one line");
    setSaving(true);
    const { data: q, error } = await supabase.from("quotes").insert({
      organization_id: currentOrg.id, customer_id: customerId || null, issue_date: issue,
      expiry_date: expiry || null, notes: notes || null, currency: currentOrg.currency,
      created_by: user.id, quote_number: "",
    }).select("id").single();
    if (error || !q) { setSaving(false); return toast.error(error?.message ?? "Failed"); }
    const { error: le } = await supabase.from("quote_lines").insert(valid.map((l, i) => ({
      organization_id: currentOrg.id, quote_id: q.id, position: i,
      description: l.description, quantity: +l.quantity, unit_price: +l.unit_price, tax_rate: +l.tax_rate,
    })));
    if (le) { setSaving(false); return toast.error(le.message); }
    // Optimistic update: add new quote to table immediately without waiting for reload
    const optimistic: Q = {
      id: q.id,
      quote_number: "",
      issue_date: issue,
      expiry_date: expiry || null,
      status: "draft",
      total: subtotal + tax,
      currency: currentOrg.currency,
      converted_invoice_id: null,
      customer: customerId ? (customers.find(c => c.id === customerId) ?? null) : null,
    };
    setRows(prev => [optimistic, ...prev]);
    toast.success("Quote created");
    setOpen(false);
    resetForm();
    setSaving(false);
    load(); // refresh in background to get DB-accurate data (quote_number from trigger, etc.)
  };

  const convertToInvoice = async (qid: string) => {
    if (!currentOrg || !user) return;
    const { data: q } = await supabase.from("quotes").select("*").eq("id", qid).single();
    const { data: ql } = await supabase.from("quote_lines").select("*").eq("quote_id", qid).order("position");
    if (!q || !ql) return toast.error("Quote not found");
    const { data: inv, error } = await supabase.from("invoices").insert({
      organization_id: currentOrg.id, customer_id: q.customer_id, issue_date: new Date().toISOString().slice(0, 10),
      currency: q.currency, notes: q.notes, created_by: user.id, invoice_number: "",
    }).select("id,invoice_number").single();
    if (error || !inv) return toast.error(error?.message ?? "Failed");
    await supabase.from("invoice_lines").insert(ql.map((l, i) => ({
      organization_id: currentOrg.id, invoice_id: inv.id, position: i,
      description: l.description, quantity: l.quantity, unit_price: l.unit_price, tax_rate: l.tax_rate,
    })));
    await supabase.from("quotes").update({ status: "converted", converted_invoice_id: inv.id }).eq("id", qid);
    toast.success(`Converted to ${inv.invoice_number}`); load();
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Quotes</h1><p className="text-muted-foreground text-sm">Estimates you send to customers</p></div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild><Button><Plus className="size-4 mr-1" />New quote</Button></DialogTrigger>
          <DialogContent className="max-w-3xl">
            <DialogHeader><DialogTitle>New quote</DialogTitle></DialogHeader>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Customer</Label>
                <Select value={customerId} onValueChange={setCustomerId}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{customers.map(c => <SelectItem key={c.id} value={c.id}>{c.billing_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Issue date</Label><Input type="date" value={issue} onChange={e => setIssue(e.target.value)} /></div>
              <div><Label>Expiry</Label><Input type="date" value={expiry} onChange={e => setExpiry(e.target.value)} /></div>
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
              <span>Subtotal: <b>{money(subtotal, currentOrg?.currency)}</b></span>
              <span>Tax: <b>{money(tax, currentOrg?.currency)}</b></span>
              <span>Total: <b>{money(subtotal + tax, currentOrg?.currency)}</b></span>
            </div>
            <div><Label>Notes</Label><Input value={notes} onChange={e => setNotes(e.target.value)} /></div>
            <DialogFooter><Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Create quote"}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <div className="border rounded-lg">
        <Table>
          <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Customer</TableHead><TableHead>Issue</TableHead><TableHead>Expiry</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Total</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No quotes yet</TableCell></TableRow> :
              rows.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono">{r.quote_number}</TableCell>
                  <TableCell>{r.customer?.billing_name ?? "—"}</TableCell>
                  <TableCell>{fmtDate(r.issue_date)}</TableCell>
                  <TableCell>{fmtDate(r.expiry_date)}</TableCell>
                  <TableCell><span className="capitalize text-xs">{r.status}</span></TableCell>
                  <TableCell className="text-right font-semibold">{money(r.total, r.currency)}</TableCell>
                  <TableCell className="text-right">
                    {r.status !== "converted" && <Button size="sm" variant="ghost" onClick={() => convertToInvoice(r.id)}><ArrowRightCircle className="size-4 mr-1" />To invoice</Button>}
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
