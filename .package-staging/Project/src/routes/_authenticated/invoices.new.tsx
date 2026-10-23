import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/org-context";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { money } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/invoices/new")({
  component: NewInvoicePage,
});

interface LineDraft { description: string; quantity: string; unit_price: string; tax_rate: string; }
const emptyLine = (): LineDraft => ({ description: "", quantity: "1", unit_price: "0", tax_rate: "0" });

function NewInvoicePage() {
  const { currentOrg } = useOrg();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<{ id: string; billing_name: string }[]>([]);
  const [customerId, setCustomerId] = useState<string>("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([emptyLine()]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!currentOrg) return;
    supabase.from("customers").select("id,billing_name")
      .eq("organization_id", currentOrg.id).order("billing_name")
      .then(({ data }) => setCustomers((data ?? []) as { id: string; billing_name: string }[]));
  }, [currentOrg?.id]);

  const updateLine = (i: number, patch: Partial<LineDraft>) =>
    setLines((l) => l.map((x, idx) => idx === i ? { ...x, ...patch } : x));

  const subtotal = lines.reduce((s, l) => s + (parseFloat(l.quantity) || 0) * (parseFloat(l.unit_price) || 0), 0);
  const tax = lines.reduce((s, l) => s + (parseFloat(l.quantity) || 0) * (parseFloat(l.unit_price) || 0) * (parseFloat(l.tax_rate) || 0) / 100, 0);
  const total = subtotal + tax;

  const save = async () => {
    if (!currentOrg || !user) { toast.error("Organisation not loaded — please refresh"); return; }
    const validLines = lines.filter((l) => l.description.trim() && parseFloat(l.quantity) > 0);
    if (validLines.length === 0) { toast.error("Add at least one line item"); return; }
    setSaving(true);
    const { data: inv, error } = await supabase.from("invoices").insert({
      organization_id: currentOrg.id,
      created_by: user.id,
      customer_id: customerId || null,
      issue_date: issueDate,
      due_date: dueDate || null,
      currency: currentOrg.currency,
      notes: notes.trim() || null,
      status: "sent",
      invoice_number: "",
    }).select("id").single();
    if (error || !inv) { setSaving(false); toast.error(error?.message ?? "Failed"); return; }

    const { error: lerr } = await supabase.from("invoice_lines").insert(
      validLines.map((l, idx) => ({
        invoice_id: inv.id,
        organization_id: currentOrg.id,
        position: idx,
        description: l.description.trim(),
        quantity: parseFloat(l.quantity),
        unit_price: parseFloat(l.unit_price),
        tax_rate: parseFloat(l.tax_rate) || 0,
      }))
    );
    setSaving(false);
    if (lerr) { toast.error(lerr.message); return; }
    toast.success("Invoice created");
    navigate({ to: "/invoices/$invoiceId", params: { invoiceId: inv.id } });
  };

  return (
    <div className="p-8 max-w-5xl mx-auto w-full animate-reveal">
      <Link to="/invoices" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="size-3.5" /> Back to invoices
      </Link>
      <h1 className="text-2xl font-bold tracking-tight mb-6">New invoice</h1>

      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div className="grid gap-1.5">
          <Label>Customer</Label>
          <Select value={customerId} onValueChange={setCustomerId}>
            <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
            <SelectContent>
              {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.billing_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5"><Label>Issue date</Label><Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} /></div>
          <div className="grid gap-1.5"><Label>Due date</Label><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
        </div>
      </div>

      <div className="border border-border rounded-xl overflow-hidden bg-card mb-4">
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

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <div className="grid gap-1.5">
          <Label>Notes</Label>
          <Textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Visible to your customer" />
        </div>
        <div className="bg-sidebar/40 border border-border rounded-xl p-5 space-y-2 self-start">
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span>{money(subtotal, currentOrg?.currency)}</span></div>
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Tax</span><span>{money(tax, currentOrg?.currency)}</span></div>
          <div className="flex justify-between font-bold text-base pt-2 border-t border-border"><span>Total</span><span>{money(total, currentOrg?.currency)}</span></div>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => navigate({ to: "/invoices" })}>Cancel</Button>
        <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Create invoice"}</Button>
      </div>
    </div>
  );
}
