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
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { money, fmtDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/bill-payments")({
  head: () => ({ meta: [{ title: "Vendor Payments — Equity.AI" }] }),
  component: Page,
});

interface BP { id: string; payment_date: string; amount: number; currency: string; method: string; reference: string | null; vendor: { name: string } | null; }
interface Bill { id: string; bill_number: string; total: number; amount_paid: number; vendor_id: string | null; }

function Page() {
  const { currentOrg } = useOrg();
  const { user } = useAuth();
  const [rows, setRows] = useState<BP[]>([]);
  const [vendors, setVendors] = useState<{ id: string; name: string }[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [vendorId, setVendorId] = useState("");
  const [amount, setAmount] = useState("0");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState("bank_transfer");
  const [reference, setReference] = useState("");
  const [applyTo, setApplyTo] = useState<Record<string, string>>({});

  const load = async () => {
    if (!currentOrg) return;
    const [p, v, b] = await Promise.all([
      supabase.from("bill_payments").select("id,payment_date,amount,currency,method,reference,vendor:vendors(name)").eq("organization_id", currentOrg.id).order("payment_date", { ascending: false }),
      supabase.from("vendors").select("id,name").eq("organization_id", currentOrg.id).order("name"),
      supabase.from("bills").select("id,bill_number,total,amount_paid,vendor_id").eq("organization_id", currentOrg.id).neq("status", "paid").neq("status", "void"),
    ]);
    setRows((p.data ?? []) as unknown as BP[]);
    setVendors((v.data ?? []) as { id: string; name: string }[]);
    setBills((b.data ?? []) as Bill[]);
  };
  useEffect(() => { load(); }, [currentOrg?.id]);

  const openBills = bills.filter(b => !vendorId || b.vendor_id === vendorId);

  const save = async () => {
    if (!currentOrg || !user || !vendorId) return toast.error("Pick a vendor");
    const amt = parseFloat(amount);
    if (!(amt > 0)) return toast.error("Amount must be > 0");
    setSaving(true);
    const { data: bp, error } = await supabase.from("bill_payments").insert({
      organization_id: currentOrg.id, vendor_id: vendorId, amount: amt, payment_date: date,
      method: method as "bank_transfer", reference: reference || null, currency: currentOrg.currency, created_by: user.id,
    }).select("id").single();
    if (error || !bp) { setSaving(false); return toast.error(error?.message ?? "Failed"); }
    const links = Object.entries(applyTo).map(([bill_id, v]) => ({ bill_id, applied_amount: parseFloat(v) || 0 })).filter(l => l.applied_amount > 0)
      .map(l => ({ ...l, organization_id: currentOrg.id, bill_payment_id: bp.id }));
    if (links.length) {
      const { error: le } = await supabase.from("bill_payment_links").insert(links);
      if (le) toast.error("Saved payment but failed to link: " + le.message);
    }
    toast.success("Vendor payment recorded");
    setOpen(false); setAmount("0"); setApplyTo({}); setReference("");
    load();
    setSaving(false);
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Vendor Payments</h1>
          <p className="text-muted-foreground text-sm">Record payments to vendors and apply to open bills</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="size-4 mr-1" />Record payment</Button></DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>New vendor payment</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Vendor</Label>
                <Select value={vendorId} onValueChange={setVendorId}>
                  <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
                  <SelectContent>{vendors.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Amount</Label><Input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} /></div>
              <div><Label>Date</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
              <div><Label>Method</Label>
                <Select value={method} onValueChange={setMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="check">Check</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2"><Label>Reference</Label><Input value={reference} onChange={e => setReference(e.target.value)} /></div>
            </div>
            {vendorId && openBills.length > 0 && (
              <div className="space-y-2 mt-3">
                <Label>Apply to bills</Label>
                <div className="border rounded max-h-60 overflow-auto">
                  {openBills.map(b => {
                    const due = Number(b.total) - Number(b.amount_paid);
                    return (
                      <div key={b.id} className="flex items-center gap-2 p-2 border-b last:border-b-0 text-sm">
                        <span className="flex-1 font-mono">{b.bill_number}</span>
                        <span className="text-muted-foreground">Due {money(due, currentOrg!.currency)}</span>
                        <Input type="number" step="0.01" placeholder="0" className="w-32" value={applyTo[b.id] ?? ""} onChange={e => setApplyTo(p => ({ ...p, [b.id]: e.target.value }))} />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <DialogFooter><Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Vendor</TableHead><TableHead>Method</TableHead><TableHead>Reference</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No payments yet</TableCell></TableRow> :
              rows.map(r => (
                <TableRow key={r.id}>
                  <TableCell>{fmtDate(r.payment_date)}</TableCell>
                  <TableCell>{r.vendor?.name ?? "—"}</TableCell>
                  <TableCell className="capitalize">{r.method.replace("_", " ")}</TableCell>
                  <TableCell className="font-mono text-xs">{r.reference ?? "—"}</TableCell>
                  <TableCell className="text-right font-semibold">{money(r.amount, r.currency)}</TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
