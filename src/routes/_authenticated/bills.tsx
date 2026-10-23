import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/org-context";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { money, fmtDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/bills")({
  component: BillsPage,
});

interface Bill {
  id: string; bill_number: string; vendor_reference: string | null;
  issue_date: string; due_date: string | null;
  status: "draft" | "open" | "partial" | "paid" | "void";
  total: number | string; amount_paid: number | string; currency: string;
  vendors: { name: string } | null;
}

interface LineDraft { description: string; quantity: string; unit_price: string; tax_rate: string; }
const emptyLine = (): LineDraft => ({ description: "", quantity: "1", unit_price: "0", tax_rate: "0" });

const STATUS_COLOR: Record<Bill["status"], string> = {
  draft: "bg-muted text-muted-foreground",
  open: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  partial: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  paid: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  void: "bg-destructive/10 text-destructive",
};

function BillsPage() {
  const { currentOrg } = useOrg();
  const { user } = useAuth();
  const [rows, setRows] = useState<Bill[]>([]);
  const [vendors, setVendors] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [vendorId, setVendorId] = useState("");
  const [vendorRef, setVendorRef] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([emptyLine()]);

  const load = async () => {
    if (!currentOrg) return;
    setLoading(true);
    const [b, v] = await Promise.all([
      supabase.from("bills").select("id,bill_number,vendor_reference,issue_date,due_date,status,total,amount_paid,currency,vendors(name)")
        .eq("organization_id", currentOrg.id).order("created_at", { ascending: false }),
      supabase.from("vendors").select("id,name").eq("organization_id", currentOrg.id).order("name"),
    ]);
    setRows((b.data ?? []) as unknown as Bill[]);
    setVendors((v.data ?? []) as { id: string; name: string }[]);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [currentOrg?.id]);

  const subtotal = lines.reduce((s, l) => s + (parseFloat(l.quantity) || 0) * (parseFloat(l.unit_price) || 0), 0);
  const tax = lines.reduce((s, l) => s + (parseFloat(l.quantity) || 0) * (parseFloat(l.unit_price) || 0) * (parseFloat(l.tax_rate) || 0) / 100, 0);
  const total = subtotal + tax;

  const updateLine = (i: number, patch: Partial<LineDraft>) =>
    setLines((l) => l.map((x, idx) => idx === i ? { ...x, ...patch } : x));

  const save = async () => {
    if (!currentOrg || !user) return;
    const validLines = lines.filter((l) => l.description.trim() && parseFloat(l.quantity) > 0);
    if (validLines.length === 0) return toast.error("Add at least one line item");
    setSaving(true);
    const { data: bill, error } = await supabase.from("bills").insert({
      organization_id: currentOrg.id, created_by: user.id,
      vendor_id: vendorId || null, vendor_reference: vendorRef.trim() || null,
      issue_date: issueDate, due_date: dueDate || null,
      currency: currentOrg.currency, status: "open",
      notes: notes.trim() || null, bill_number: "",
    }).select("id").single();
    if (error || !bill) { setSaving(false); return toast.error(error?.message ?? "Failed"); }

    const { error: lerr } = await supabase.from("bill_lines").insert(
      validLines.map((l, idx) => ({
        bill_id: bill.id, organization_id: currentOrg.id, position: idx,
        description: l.description.trim(),
        quantity: parseFloat(l.quantity),
        unit_price: parseFloat(l.unit_price),
        tax_rate: parseFloat(l.tax_rate) || 0,
      }))
    );
    setSaving(false);
    if (lerr) return toast.error(lerr.message);
    toast.success("Bill created");
    setOpen(false);
    setVendorId(""); setVendorRef(""); setNotes(""); setLines([emptyLine()]);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this bill?")) return;
    const { error } = await supabase.from("bills").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  };

  const totalOutstanding = rows
    .filter((r) => r.status !== "paid" && r.status !== "void")
    .reduce((s, r) => s + (Number(r.total) - Number(r.amount_paid)), 0);

  return (
    <div className="p-8 max-w-6xl mx-auto w-full animate-reveal">
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-1">Bills</h1>
          <p className="text-muted-foreground">
            {rows.length} total · {money(totalOutstanding, currentOrg?.currency)} payable
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="size-4 mr-1.5" />New bill</Button></DialogTrigger>
          <DialogContent className="max-w-3xl">
            <DialogHeader><DialogTitle>New bill</DialogTitle></DialogHeader>
            <div className="grid gap-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="grid gap-1.5">
                  <Label>Vendor</Label>
                  <Select value={vendorId} onValueChange={setVendorId}>
                    <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
                    <SelectContent>
                      {vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5"><Label>Issue date</Label><Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} /></div>
                <div className="grid gap-1.5"><Label>Due date</Label><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
              </div>
              <div className="grid gap-1.5"><Label>Vendor reference</Label><Input value={vendorRef} onChange={(e) => setVendorRef(e.target.value)} placeholder="Their invoice #" /></div>

              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-sidebar/60 text-muted-foreground text-[11px] uppercase tracking-wider">
                    <tr>
                      <th className="text-left px-3 py-2">Description</th>
                      <th className="text-right px-3 py-2 w-20">Qty</th>
                      <th className="text-right px-3 py-2 w-28">Unit price</th>
                      <th className="text-right px-3 py-2 w-20">Tax %</th>
                      <th className="text-right px-3 py-2 w-28">Amount</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l, i) => {
                      const amt = (parseFloat(l.quantity) || 0) * (parseFloat(l.unit_price) || 0) * (1 + (parseFloat(l.tax_rate) || 0) / 100);
                      return (
                        <tr key={i} className="border-t border-border">
                          <td className="px-2 py-1"><Input value={l.description} onChange={(e) => updateLine(i, { description: e.target.value })} placeholder="Item or service" className="border-0 focus-visible:ring-0" /></td>
                          <td className="px-2 py-1"><Input type="number" step="0.01" value={l.quantity} onChange={(e) => updateLine(i, { quantity: e.target.value })} className="border-0 focus-visible:ring-0 text-right" /></td>
                          <td className="px-2 py-1"><Input type="number" step="0.01" value={l.unit_price} onChange={(e) => updateLine(i, { unit_price: e.target.value })} className="border-0 focus-visible:ring-0 text-right" /></td>
                          <td className="px-2 py-1"><Input type="number" step="0.01" value={l.tax_rate} onChange={(e) => updateLine(i, { tax_rate: e.target.value })} className="border-0 focus-visible:ring-0 text-right" /></td>
                          <td className="px-3 py-2 text-right font-medium">{money(amt, currentOrg?.currency)}</td>
                          <td className="px-2">
                            {lines.length > 1 && (
                              <button onClick={() => setLines(lines.filter((_, idx) => idx !== i))} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                                <Trash2 className="size-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="p-2 border-t border-border">
                  <Button variant="ghost" size="sm" onClick={() => setLines([...lines, emptyLine()])}>
                    <Plus className="size-3.5 mr-1" /> Add line
                  </Button>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="grid gap-1.5"><Label>Notes</Label><Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
                <div className="bg-sidebar/40 border border-border rounded-lg p-4 space-y-2 self-start">
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span>{money(subtotal, currentOrg?.currency)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Tax</span><span>{money(tax, currentOrg?.currency)}</span></div>
                  <div className="flex justify-between font-bold pt-2 border-t border-border"><span>Total</span><span>{money(total, currentOrg?.currency)}</span></div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Create bill"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border border-border rounded-xl overflow-hidden bg-card">
        <table className="w-full text-sm">
          <thead className="bg-sidebar/60 text-muted-foreground text-[11px] uppercase tracking-wider">
            <tr>
              <th className="text-left px-4 py-2.5">Number</th>
              <th className="text-left px-4 py-2.5">Vendor</th>
              <th className="text-left px-4 py-2.5">Ref</th>
              <th className="text-left px-4 py-2.5">Issued</th>
              <th className="text-left px-4 py-2.5">Due</th>
              <th className="text-right px-4 py-2.5">Total</th>
              <th className="text-right px-4 py-2.5">Paid</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={9} className="text-center py-12 text-muted-foreground">Loading…</td></tr>
            : rows.length === 0 ? <tr><td colSpan={9} className="text-center py-12 text-muted-foreground">No bills yet.</td></tr>
            : rows.map((r) => (
              <tr key={r.id} className="border-t border-border hover:bg-sidebar/40">
                <td className="px-4 py-3 font-mono font-medium">{r.bill_number}</td>
                <td className="px-4 py-3">{r.vendors?.name ?? <span className="text-muted-foreground">—</span>}</td>
                <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{r.vendor_reference ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{fmtDate(r.issue_date)}</td>
                <td className="px-4 py-3 text-muted-foreground">{fmtDate(r.due_date)}</td>
                <td className="px-4 py-3 text-right font-medium">{money(r.total, r.currency)}</td>
                <td className="px-4 py-3 text-right text-muted-foreground">{money(r.amount_paid, r.currency)}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${STATUS_COLOR[r.status]}`}>{r.status}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => remove(r.id)} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="size-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
