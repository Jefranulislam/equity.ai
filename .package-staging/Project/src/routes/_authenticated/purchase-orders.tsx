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

export const Route = createFileRoute("/_authenticated/purchase-orders")({
  head: () => ({ meta: [{ title: "Purchase Orders — Equity.AI" }] }),
  component: Page,
});

interface PO { id: string; po_number: string; issue_date: string; expected_date: string | null; status: string; total: number; currency: string; converted_bill_id: string | null; vendor: { name: string } | null; }
interface Line { description: string; quantity: string; unit_price: string; tax_rate: string; }
const newLine = (): Line => ({ description: "", quantity: "1", unit_price: "0", tax_rate: "0" });

function Page() {
  const { currentOrg } = useOrg();
  const { user } = useAuth();
  const [rows, setRows] = useState<PO[]>([]);
  const [vendors, setVendors] = useState<{ id: string; name: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [vendorId, setVendorId] = useState("");
  const [issue, setIssue] = useState(new Date().toISOString().slice(0, 10));
  const [expected, setExpected] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([newLine()]);

  const load = async () => {
    if (!currentOrg) return;
    const [p, v] = await Promise.all([
      supabase.from("purchase_orders").select("id,po_number,issue_date,expected_date,status,total,currency,converted_bill_id,vendor:vendors(name)").eq("organization_id", currentOrg.id).order("created_at", { ascending: false }),
      supabase.from("vendors").select("id,name").eq("organization_id", currentOrg.id).order("name"),
    ]);
    setRows((p.data ?? []) as unknown as PO[]);
    setVendors((v.data ?? []) as { id: string; name: string }[]);
  };
  useEffect(() => { load(); }, [currentOrg?.id]);

  const subtotal = lines.reduce((s, l) => s + (+l.quantity || 0) * (+l.unit_price || 0), 0);
  const tax = lines.reduce((s, l) => s + (+l.quantity || 0) * (+l.unit_price || 0) * (+l.tax_rate || 0) / 100, 0);

  const save = async () => {
    if (!currentOrg || !user) return;
    const valid = lines.filter(l => l.description.trim() && +l.quantity > 0);
    if (!valid.length) return toast.error("Add at least one line");
    setSaving(true);
    const { data: po, error } = await supabase.from("purchase_orders").insert({
      organization_id: currentOrg.id, vendor_id: vendorId || null, issue_date: issue,
      expected_date: expected || null, notes: notes || null, currency: currentOrg.currency,
      created_by: user.id, po_number: "",
    }).select("id").single();
    if (error || !po) { setSaving(false); return toast.error(error?.message ?? "Failed"); }
    const { error: le } = await supabase.from("po_lines").insert(valid.map((l, i) => ({
      organization_id: currentOrg.id, po_id: po.id, position: i,
      description: l.description, quantity: +l.quantity, unit_price: +l.unit_price, tax_rate: +l.tax_rate,
    })));
    if (le) { setSaving(false); return toast.error(le.message); }
    toast.success("PO created"); setOpen(false); setLines([newLine()]); load();
    setSaving(false);
  };

  const convertToBill = async (poid: string) => {
    if (!currentOrg || !user) return;
    const { data: po } = await supabase.from("purchase_orders").select("*").eq("id", poid).single();
    const { data: pl } = await supabase.from("po_lines").select("*").eq("po_id", poid).order("position");
    if (!po || !pl) return toast.error("PO not found");
    const { data: bill, error } = await supabase.from("bills").insert({
      organization_id: currentOrg.id, vendor_id: po.vendor_id, issue_date: new Date().toISOString().slice(0, 10),
      currency: po.currency, notes: po.notes, created_by: user.id, bill_number: "",
    }).select("id,bill_number").single();
    if (error || !bill) return toast.error(error?.message ?? "Failed");
    await supabase.from("bill_lines").insert(pl.map((l, i) => ({
      organization_id: currentOrg.id, bill_id: bill.id, position: i,
      description: l.description, quantity: l.quantity, unit_price: l.unit_price, tax_rate: l.tax_rate,
    })));
    await supabase.from("purchase_orders").update({ status: "received", converted_bill_id: bill.id }).eq("id", poid);
    toast.success(`Converted to ${bill.bill_number}`); load();
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Purchase Orders</h1><p className="text-muted-foreground text-sm">Orders sent to vendors</p></div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="size-4 mr-1" />New PO</Button></DialogTrigger>
          <DialogContent className="max-w-3xl">
            <DialogHeader><DialogTitle>New purchase order</DialogTitle></DialogHeader>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Vendor</Label>
                <Select value={vendorId} onValueChange={setVendorId}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{vendors.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Issue date</Label><Input type="date" value={issue} onChange={e => setIssue(e.target.value)} /></div>
              <div><Label>Expected</Label><Input type="date" value={expected} onChange={e => setExpected(e.target.value)} /></div>
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
            <DialogFooter><Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Create PO"}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <div className="border rounded-lg">
        <Table>
          <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Vendor</TableHead><TableHead>Issue</TableHead><TableHead>Expected</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Total</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No purchase orders yet</TableCell></TableRow> :
              rows.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono">{r.po_number}</TableCell>
                  <TableCell>{r.vendor?.name ?? "—"}</TableCell>
                  <TableCell>{fmtDate(r.issue_date)}</TableCell>
                  <TableCell>{fmtDate(r.expected_date)}</TableCell>
                  <TableCell><span className="capitalize text-xs">{r.status}</span></TableCell>
                  <TableCell className="text-right font-semibold">{money(r.total, r.currency)}</TableCell>
                  <TableCell className="text-right">
                    {!r.converted_bill_id && <Button size="sm" variant="ghost" onClick={() => convertToBill(r.id)}><ArrowRightCircle className="size-4 mr-1" />To bill</Button>}
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
