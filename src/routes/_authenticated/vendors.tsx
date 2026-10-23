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

export const Route = createFileRoute("/_authenticated/vendors")({
  component: VendorsPage,
});

interface Vendor {
  id: string; name: string; email: string | null; phone: string | null;
  address: string | null; tax_id: string | null; currency: string;
  notes: string | null; created_at: string;
}

function VendorsPage() {
  const { currentOrg } = useOrg();
  const { user } = useAuth();
  const [rows, setRows] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", address: "", tax_id: "", notes: "" });

  const load = async () => {
    if (!currentOrg) return;
    setLoading(true);
    const { data, error } = await supabase.from("vendors").select("*")
      .eq("organization_id", currentOrg.id).order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setRows((data ?? []) as Vendor[]);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [currentOrg?.id]);

  const create = async () => {
    if (!currentOrg || !user) return;
    if (!form.name.trim()) return toast.error("Name is required");
    setSaving(true);
    const { error } = await supabase.from("vendors").insert({
      organization_id: currentOrg.id, created_by: user.id, currency: currentOrg.currency,
      name: form.name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      address: form.address.trim() || null,
      tax_id: form.tax_id.trim() || null,
      notes: form.notes.trim() || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Vendor added");
    setOpen(false);
    setForm({ name: "", email: "", phone: "", address: "", tax_id: "", notes: "" });
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this vendor?")) return;
    const { error } = await supabase.from("vendors").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  };

  return (
    <div className="p-8 max-w-6xl mx-auto w-full animate-reveal">
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-1">Vendors</h1>
          <p className="text-muted-foreground">Your supplier directory. {rows.length} total.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="size-4 mr-1.5" />New vendor</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New vendor</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div className="grid gap-1.5"><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Acme Supplies" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                <div className="grid gap-1.5"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              </div>
              <div className="grid gap-1.5"><Label>Address</Label><Textarea rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
              <div className="grid gap-1.5"><Label>Tax ID</Label><Input value={form.tax_id} onChange={(e) => setForm({ ...form, tax_id: e.target.value })} /></div>
              <div className="grid gap-1.5"><Label>Notes</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={create} disabled={saving}>{saving ? "Saving…" : "Save vendor"}</Button>
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
            {loading ? <tr><td colSpan={5} className="text-center py-12 text-muted-foreground">Loading…</td></tr>
            : rows.length === 0 ? <tr><td colSpan={5} className="text-center py-12 text-muted-foreground">No vendors yet.</td></tr>
            : rows.map((v) => (
              <tr key={v.id} className="border-t border-border hover:bg-sidebar/40">
                <td className="px-4 py-3 font-medium">{v.name}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  <div className="flex flex-col gap-0.5">
                    {v.email && <span className="flex items-center gap-1.5"><Mail className="size-3" />{v.email}</span>}
                    {v.phone && <span className="flex items-center gap-1.5"><Phone className="size-3" />{v.phone}</span>}
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{v.tax_id ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{fmtDate(v.created_at)}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => remove(v.id)} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
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
