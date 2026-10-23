import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/org-context";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Mail, Phone, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { fmtDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/customers")({
  component: CustomersPage,
});

interface Customer {
  id: string;
  billing_name: string;
  email: string | null;
  phone: string | null;
  billing_address: string | null;
  tax_id: string | null;
  currency: string;
  notes: string | null;
  created_at: string;
}

function CustomersPage() {
  const { currentOrg } = useOrg();
  const { user } = useAuth();
  const [rows, setRows] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ billing_name: "", email: "", phone: "", billing_address: "", tax_id: "", notes: "" });

  const load = async () => {
    if (!currentOrg) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("customers").select("*")
      .eq("organization_id", currentOrg.id)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setRows((data ?? []) as Customer[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [currentOrg?.id]);

  const create = async () => {
    if (!currentOrg || !user) return;
    if (!form.billing_name.trim()) { toast.error("Name is required"); return; }
    setSaving(true);
    const { error } = await supabase.from("customers").insert({
      organization_id: currentOrg.id,
      created_by: user.id,
      currency: currentOrg.currency,
      billing_name: form.billing_name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      billing_address: form.billing_address.trim() || null,
      tax_id: form.tax_id.trim() || null,
      notes: form.notes.trim() || null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Customer added");
    setOpen(false);
    setForm({ billing_name: "", email: "", phone: "", billing_address: "", tax_id: "", notes: "" });
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this customer?")) return;
    const { error } = await supabase.from("customers").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  };

  return (
    <div className="p-8 max-w-6xl mx-auto w-full animate-reveal">
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-1">Customers</h1>
          <p className="text-muted-foreground">Your billing directory. {rows.length} total.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="size-4 mr-1.5" />New customer</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New customer</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label>Billing name *</Label>
                <Input value={form.billing_name} onChange={(e) => setForm({ ...form, billing_name: e.target.value })} placeholder="Acme Inc." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                <div className="grid gap-1.5"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              </div>
              <div className="grid gap-1.5"><Label>Billing address</Label><Textarea rows={2} value={form.billing_address} onChange={(e) => setForm({ ...form, billing_address: e.target.value })} /></div>
              <div className="grid gap-1.5"><Label>Tax ID / GSTIN</Label><Input value={form.tax_id} onChange={(e) => setForm({ ...form, tax_id: e.target.value })} /></div>
              <div className="grid gap-1.5"><Label>Notes</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={create} disabled={saving}>{saving ? "Saving…" : "Save customer"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border border-border rounded-xl overflow-hidden bg-card">
        <table className="w-full text-sm">
          <thead className="bg-sidebar/60 text-muted-foreground text-[11px] uppercase tracking-wider">
            <tr>
              <th className="text-left px-4 py-2.5">Name</th>
              <th className="text-left px-4 py-2.5">Contact</th>
              <th className="text-left px-4 py-2.5">Tax ID</th>
              <th className="text-left px-4 py-2.5">Added</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="text-center py-12 text-muted-foreground">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-12 text-muted-foreground">No customers yet.</td></tr>
            ) : rows.map((c) => (
              <tr key={c.id} className="border-t border-border hover:bg-sidebar/40">
                <td className="px-4 py-3 font-medium">{c.billing_name}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  <div className="flex flex-col gap-0.5">
                    {c.email && <span className="flex items-center gap-1.5"><Mail className="size-3" />{c.email}</span>}
                    {c.phone && <span className="flex items-center gap-1.5"><Phone className="size-3" />{c.phone}</span>}
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{c.tax_id ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{fmtDate(c.created_at)}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => remove(c.id)} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
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
