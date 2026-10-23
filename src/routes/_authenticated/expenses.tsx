import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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

export const Route = createFileRoute("/_authenticated/expenses")({
  component: ExpensesPage,
});

type PayMethod = "cash" | "card" | "bank_transfer" | "cheque" | "upi" | "other";

interface Expense {
  id: string; expense_date: string; description: string;
  amount: number | string; tax_amount: number | string; currency: string;
  payment_method: PayMethod; reference: string | null;
  expense_categories: { name: string } | null;
  vendors: { name: string } | null;
}

function ExpensesPage() {
  const { currentOrg } = useOrg();
  const { user } = useAuth();
  const [rows, setRows] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [vendors, setVendors] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    expense_date: new Date().toISOString().slice(0, 10),
    description: "", amount: "0", tax_amount: "0",
    category_id: "", vendor_id: "",
    payment_method: "bank_transfer" as PayMethod,
    reference: "", notes: "",
  });

  const load = async () => {
    if (!currentOrg) return;
    setLoading(true);
    const [e, c, v] = await Promise.all([
      supabase.from("expenses").select("id,expense_date,description,amount,tax_amount,currency,payment_method,reference,expense_categories(name),vendors(name)")
        .eq("organization_id", currentOrg.id).order("expense_date", { ascending: false }).limit(200),
      supabase.from("expense_categories").select("id,name").eq("organization_id", currentOrg.id).order("name"),
      supabase.from("vendors").select("id,name").eq("organization_id", currentOrg.id).order("name"),
    ]);
    setRows((e.data ?? []) as unknown as Expense[]);
    setCategories((c.data ?? []) as { id: string; name: string }[]);
    setVendors((v.data ?? []) as { id: string; name: string }[]);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [currentOrg?.id]);

  const save = async () => {
    if (!currentOrg || !user) return;
    if (!form.description.trim()) return toast.error("Description is required");
    if (!(parseFloat(form.amount) > 0)) return toast.error("Amount must be > 0");
    setSaving(true);
    const { error } = await supabase.from("expenses").insert({
      organization_id: currentOrg.id, created_by: user.id,
      expense_date: form.expense_date,
      description: form.description.trim(),
      amount: parseFloat(form.amount),
      tax_amount: parseFloat(form.tax_amount) || 0,
      currency: currentOrg.currency,
      category_id: form.category_id || null,
      vendor_id: form.vendor_id || null,
      payment_method: form.payment_method,
      reference: form.reference.trim() || null,
      notes: form.notes.trim() || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Expense recorded");
    setOpen(false);
    setForm({ ...form, description: "", amount: "0", tax_amount: "0", reference: "", notes: "" });
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this expense?")) return;
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  };

  const totals = useMemo(() => {
    const monthStart = new Date(); monthStart.setDate(1);
    const thisMonth = rows.filter((r) => new Date(r.expense_date) >= monthStart)
      .reduce((s, r) => s + Number(r.amount) + Number(r.tax_amount), 0);
    const all = rows.reduce((s, r) => s + Number(r.amount) + Number(r.tax_amount), 0);
    return { thisMonth, all };
  }, [rows]);

  return (
    <div className="p-8 max-w-6xl mx-auto w-full animate-reveal">
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-1">Expenses</h1>
          <p className="text-muted-foreground">
            {money(totals.thisMonth, currentOrg?.currency)} this month · {money(totals.all, currentOrg?.currency)} all time
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="size-4 mr-1.5" />New expense</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Record expense</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5"><Label>Date</Label><Input type="date" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} /></div>
                <div className="grid gap-1.5">
                  <Label>Payment method</Label>
                  <Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v as PayMethod })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="card">Card</SelectItem>
                      <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                      <SelectItem value="upi">UPI</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-1.5"><Label>Description *</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What was this for?" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5"><Label>Amount *</Label><Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
                <div className="grid gap-1.5"><Label>Tax</Label><Input type="number" step="0.01" value={form.tax_amount} onChange={(e) => setForm({ ...form, tax_amount: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>Category</Label>
                  <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                    <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label>Vendor</Label>
                  <Select value={form.vendor_id} onValueChange={(v) => setForm({ ...form, vendor_id: v })}>
                    <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      {vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-1.5"><Label>Reference</Label><Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="Receipt #" /></div>
              <div className="grid gap-1.5"><Label>Notes</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save expense"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border border-border rounded-xl overflow-hidden bg-card">
        <table className="w-full text-sm">
          <thead className="bg-sidebar/60 text-muted-foreground text-[11px] uppercase tracking-wider">
            <tr>
              <th className="text-left px-4 py-2.5">Date</th>
              <th className="text-left px-4 py-2.5">Description</th>
              <th className="text-left px-4 py-2.5">Category</th>
              <th className="text-left px-4 py-2.5">Vendor</th>
              <th className="text-left px-4 py-2.5">Method</th>
              <th className="text-right px-4 py-2.5">Amount</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">Loading…</td></tr>
            : rows.length === 0 ? <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">No expenses yet.</td></tr>
            : rows.map((r) => (
              <tr key={r.id} className="border-t border-border hover:bg-sidebar/40">
                <td className="px-4 py-3 text-muted-foreground">{fmtDate(r.expense_date)}</td>
                <td className="px-4 py-3 font-medium">{r.description}</td>
                <td className="px-4 py-3 text-muted-foreground">{r.expense_categories?.name ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{r.vendors?.name ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground text-xs uppercase tracking-wider">{r.payment_method.replace("_", " ")}</td>
                <td className="px-4 py-3 text-right font-medium">{money(Number(r.amount) + Number(r.tax_amount), r.currency)}</td>
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
