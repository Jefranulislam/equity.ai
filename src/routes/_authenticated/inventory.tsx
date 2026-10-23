import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/org-context";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Package, Warehouse, ArrowDownUp, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { money, fmtDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/inventory")({
  component: InventoryPage,
});

interface Product {
  id: string; sku: string | null; name: string; unit: string;
  sale_price: number | string; cost_price: number | string; tax_rate: number | string;
  track_inventory: boolean; is_active: boolean; created_at: string;
}
interface Location { id: string; name: string; is_default: boolean; }
interface StockRow { product_id: string; location_id: string; quantity: number | string; products: { name: string; sku: string | null; unit: string } | null; inventory_locations: { name: string } | null; }
interface Movement {
  id: string; movement_type: "receipt" | "issue" | "adjustment" | "transfer_in" | "transfer_out";
  quantity: number | string; unit_cost: number | string | null; reference: string | null;
  movement_date: string; created_at: string;
  products: { name: string; unit: string } | null;
  inventory_locations: { name: string } | null;
}

const MOVE_LABEL: Record<Movement["movement_type"], { label: string; tone: string }> = {
  receipt: { label: "Receipt", tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  issue: { label: "Issue", tone: "bg-rose-500/10 text-rose-700 dark:text-rose-300" },
  adjustment: { label: "Adjustment", tone: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  transfer_in: { label: "Transfer in", tone: "bg-blue-500/10 text-blue-700 dark:text-blue-300" },
  transfer_out: { label: "Transfer out", tone: "bg-slate-500/10 text-slate-700 dark:text-slate-300" },
};

function InventoryPage() {
  const { currentOrg } = useOrg();
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [stock, setStock] = useState<StockRow[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    if (!currentOrg) return;
    setLoading(true);
    const [p, l, s, m] = await Promise.all([
      supabase.from("products").select("*").eq("organization_id", currentOrg.id).order("created_at", { ascending: false }),
      supabase.from("inventory_locations").select("*").eq("organization_id", currentOrg.id).order("name"),
      supabase.from("inventory_stock").select("product_id,location_id,quantity,products(name,sku,unit),inventory_locations(name)").eq("organization_id", currentOrg.id),
      supabase.from("inventory_movements").select("id,movement_type,quantity,unit_cost,reference,movement_date,created_at,products(name,unit),inventory_locations(name)").eq("organization_id", currentOrg.id).order("created_at", { ascending: false }).limit(100),
    ]);
    setProducts((p.data ?? []) as Product[]);
    setLocations((l.data ?? []) as Location[]);
    setStock((s.data ?? []) as unknown as StockRow[]);
    setMovements((m.data ?? []) as unknown as Movement[]);
    setLoading(false);
  };
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [currentOrg?.id]);

  const stockValue = useMemo(
    () => stock.reduce((s, r) => {
      const p = products.find((x) => x.id === r.product_id);
      return s + Number(r.quantity) * Number(p?.cost_price ?? 0);
    }, 0),
    [stock, products]
  );

  return (
    <div className="p-8 max-w-6xl mx-auto w-full animate-reveal">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight mb-1">Inventory</h1>
        <p className="text-muted-foreground">
          {products.length} products · {locations.length} location{locations.length === 1 ? "" : "s"} · {money(stockValue, currentOrg?.currency)} on-hand value
        </p>
      </div>

      <Tabs defaultValue="products" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="products"><Package className="size-3.5 mr-1.5" />Products</TabsTrigger>
          <TabsTrigger value="stock"><Warehouse className="size-3.5 mr-1.5" />Stock</TabsTrigger>
          <TabsTrigger value="movements"><ArrowDownUp className="size-3.5 mr-1.5" />Movements</TabsTrigger>
        </TabsList>

        <TabsContent value="products">
          <ProductsTab products={products} loading={loading} reload={reload} orgId={currentOrg?.id} userId={user?.id} currency={currentOrg?.currency} />
        </TabsContent>
        <TabsContent value="stock">
          <StockTab stock={stock} loading={loading} />
        </TabsContent>
        <TabsContent value="movements">
          <MovementsTab
            movements={movements} loading={loading} reload={reload}
            products={products} locations={locations}
            orgId={currentOrg?.id} userId={user?.id} currency={currentOrg?.currency}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ----------------------------- Products ----------------------------- */
function ProductsTab({ products, loading, reload, orgId, userId, currency }: {
  products: Product[]; loading: boolean; reload: () => void;
  orgId?: string; userId?: string; currency?: string;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", sku: "", unit: "unit", sale_price: "0", cost_price: "0", tax_rate: "0", track_inventory: true, description: "" });

  const create = async () => {
    if (!orgId || !userId) return;
    if (!form.name.trim()) return toast.error("Name is required");
    setSaving(true);
    const { error } = await supabase.from("products").insert({
      organization_id: orgId,
      created_by: userId,
      name: form.name.trim(),
      sku: form.sku.trim() || null,
      unit: form.unit.trim() || "unit",
      sale_price: parseFloat(form.sale_price) || 0,
      cost_price: parseFloat(form.cost_price) || 0,
      tax_rate: parseFloat(form.tax_rate) || 0,
      track_inventory: form.track_inventory,
      description: form.description.trim() || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Product added");
    setOpen(false);
    setForm({ name: "", sku: "", unit: "unit", sale_price: "0", cost_price: "0", tax_rate: "0", track_inventory: true, description: "" });
    reload();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this product? Stock and movements will also be removed.")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    reload();
  };

  return (
    <>
      <div className="flex justify-end mb-3">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="size-4 mr-1.5" />New product</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>New product</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5 col-span-2"><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div className="grid gap-1.5"><Label>SKU</Label><Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></div>
                <div className="grid gap-1.5"><Label>Unit</Label><Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></div>
                <div className="grid gap-1.5"><Label>Sale price</Label><Input type="number" step="0.01" value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: e.target.value })} /></div>
                <div className="grid gap-1.5"><Label>Cost price</Label><Input type="number" step="0.01" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: e.target.value })} /></div>
                <div className="grid gap-1.5"><Label>Tax %</Label><Input type="number" step="0.01" value={form.tax_rate} onChange={(e) => setForm({ ...form, tax_rate: e.target.value })} /></div>
                <label className="flex items-center gap-2 col-span-2 text-sm">
                  <input type="checkbox" checked={form.track_inventory} onChange={(e) => setForm({ ...form, track_inventory: e.target.checked })} />
                  Track inventory for this product
                </label>
                <div className="grid gap-1.5 col-span-2"><Label>Description</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={create} disabled={saving}>{saving ? "Saving…" : "Save product"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border border-border rounded-xl overflow-hidden bg-card">
        <table className="w-full text-sm">
          <thead className="bg-sidebar/60 text-muted-foreground text-[11px] uppercase tracking-wider">
            <tr>
              <th className="text-left px-4 py-2.5">Name</th>
              <th className="text-left px-4 py-2.5">SKU</th>
              <th className="text-left px-4 py-2.5">Unit</th>
              <th className="text-right px-4 py-2.5">Sale</th>
              <th className="text-right px-4 py-2.5">Cost</th>
              <th className="text-right px-4 py-2.5">Tax %</th>
              <th className="px-4 py-2.5">Track</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">Loading…</td></tr>
            : products.length === 0 ? <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">No products yet.</td></tr>
            : products.map((p) => (
              <tr key={p.id} className="border-t border-border hover:bg-sidebar/40">
                <td className="px-4 py-3 font-medium">{p.name}</td>
                <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{p.sku ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{p.unit}</td>
                <td className="px-4 py-3 text-right">{money(p.sale_price, currency)}</td>
                <td className="px-4 py-3 text-right text-muted-foreground">{money(p.cost_price, currency)}</td>
                <td className="px-4 py-3 text-right text-muted-foreground">{Number(p.tax_rate)}%</td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${p.track_inventory ? "bg-accent/10 text-accent" : "bg-muted text-muted-foreground"}`}>
                    {p.track_inventory ? "Yes" : "No"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => remove(p.id)} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="size-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ----------------------------- Stock ----------------------------- */
function StockTab({ stock, loading }: { stock: StockRow[]; loading: boolean }) {
  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card">
      <table className="w-full text-sm">
        <thead className="bg-sidebar/60 text-muted-foreground text-[11px] uppercase tracking-wider">
          <tr>
            <th className="text-left px-4 py-2.5">Product</th>
            <th className="text-left px-4 py-2.5">SKU</th>
            <th className="text-left px-4 py-2.5">Location</th>
            <th className="text-right px-4 py-2.5">On hand</th>
            <th className="text-left px-4 py-2.5">Unit</th>
          </tr>
        </thead>
        <tbody>
          {loading ? <tr><td colSpan={5} className="text-center py-12 text-muted-foreground">Loading…</td></tr>
          : stock.length === 0 ? <tr><td colSpan={5} className="text-center py-12 text-muted-foreground">No stock yet. Record a receipt to add inventory.</td></tr>
          : stock.map((r, i) => (
            <tr key={i} className="border-t border-border hover:bg-sidebar/40">
              <td className="px-4 py-3 font-medium">{r.products?.name ?? "—"}</td>
              <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{r.products?.sku ?? "—"}</td>
              <td className="px-4 py-3 text-muted-foreground">{r.inventory_locations?.name ?? "—"}</td>
              <td className={`px-4 py-3 text-right font-mono font-semibold ${Number(r.quantity) < 0 ? "text-destructive" : ""}`}>
                {Number(r.quantity).toFixed(3)}
              </td>
              <td className="px-4 py-3 text-muted-foreground">{r.products?.unit ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ----------------------------- Movements ----------------------------- */
function MovementsTab({ movements, loading, reload, products, locations, orgId, userId, currency }: {
  movements: Movement[]; loading: boolean; reload: () => void;
  products: Product[]; locations: Location[];
  orgId?: string; userId?: string; currency?: string;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    product_id: "", location_id: "",
    movement_type: "receipt" as Movement["movement_type"],
    quantity: "1", unit_cost: "", reference: "", notes: "",
    movement_date: new Date().toISOString().slice(0, 10),
  });

  useEffect(() => {
    if (!form.location_id && locations.length > 0) {
      setForm((f) => ({ ...f, location_id: locations.find((l) => l.is_default)?.id ?? locations[0].id }));
    }
  }, [locations]); // eslint-disable-line

  const save = async () => {
    if (!orgId || !userId) return;
    if (!form.product_id) return toast.error("Choose a product");
    if (!form.location_id) return toast.error("Choose a location");
    if (!(parseFloat(form.quantity) > 0)) return toast.error("Quantity must be > 0");
    setSaving(true);
    const { error } = await supabase.from("inventory_movements").insert({
      organization_id: orgId, created_by: userId,
      product_id: form.product_id, location_id: form.location_id,
      movement_type: form.movement_type,
      quantity: parseFloat(form.quantity),
      unit_cost: form.unit_cost ? parseFloat(form.unit_cost) : null,
      reference: form.reference.trim() || null,
      notes: form.notes.trim() || null,
      movement_date: form.movement_date,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Movement posted");
    setOpen(false);
    setForm({ ...form, quantity: "1", unit_cost: "", reference: "", notes: "" });
    reload();
  };

  return (
    <>
      <div className="flex justify-end mb-3">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button disabled={products.length === 0}><Plus className="size-4 mr-1.5" />Record movement</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Record stock movement</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>Type</Label>
                  <Select value={form.movement_type} onValueChange={(v) => setForm({ ...form, movement_type: v as Movement["movement_type"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="receipt">Receipt (in)</SelectItem>
                      <SelectItem value="issue">Issue (out)</SelectItem>
                      <SelectItem value="adjustment">Adjustment (signed)</SelectItem>
                      <SelectItem value="transfer_in">Transfer in</SelectItem>
                      <SelectItem value="transfer_out">Transfer out</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5"><Label>Date</Label><Input type="date" value={form.movement_date} onChange={(e) => setForm({ ...form, movement_date: e.target.value })} /></div>
              </div>
              <div className="grid gap-1.5">
                <Label>Product</Label>
                <Select value={form.product_id} onValueChange={(v) => setForm({ ...form, product_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                  <SelectContent>
                    {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}{p.sku ? ` · ${p.sku}` : ""}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Location</Label>
                <Select value={form.location_id} onValueChange={(v) => setForm({ ...form, location_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger>
                  <SelectContent>
                    {locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5"><Label>Quantity</Label><Input type="number" step="0.001" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></div>
                <div className="grid gap-1.5"><Label>Unit cost (optional)</Label><Input type="number" step="0.01" value={form.unit_cost} onChange={(e) => setForm({ ...form, unit_cost: e.target.value })} /></div>
              </div>
              <div className="grid gap-1.5"><Label>Reference</Label><Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="PO #, transfer #, etc." /></div>
              <div className="grid gap-1.5"><Label>Notes</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={save} disabled={saving}>{saving ? "Posting…" : "Post movement"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border border-border rounded-xl overflow-hidden bg-card">
        <table className="w-full text-sm">
          <thead className="bg-sidebar/60 text-muted-foreground text-[11px] uppercase tracking-wider">
            <tr>
              <th className="text-left px-4 py-2.5">Date</th>
              <th className="text-left px-4 py-2.5">Type</th>
              <th className="text-left px-4 py-2.5">Product</th>
              <th className="text-left px-4 py-2.5">Location</th>
              <th className="text-right px-4 py-2.5">Qty</th>
              <th className="text-right px-4 py-2.5">Unit cost</th>
              <th className="text-left px-4 py-2.5">Reference</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">Loading…</td></tr>
            : movements.length === 0 ? <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">No movements yet.</td></tr>
            : movements.map((m) => {
              const tone = MOVE_LABEL[m.movement_type];
              const signed = ["issue", "transfer_out"].includes(m.movement_type) ? -Number(m.quantity) : Number(m.quantity);
              return (
                <tr key={m.id} className="border-t border-border hover:bg-sidebar/40">
                  <td className="px-4 py-3 text-muted-foreground">{fmtDate(m.movement_date)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${tone.tone}`}>{tone.label}</span>
                  </td>
                  <td className="px-4 py-3 font-medium">{m.products?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{m.inventory_locations?.name ?? "—"}</td>
                  <td className={`px-4 py-3 text-right font-mono ${signed < 0 ? "text-destructive" : "text-emerald-700 dark:text-emerald-300"}`}>
                    {signed > 0 ? "+" : ""}{signed.toFixed(3)} {m.products?.unit ?? ""}
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{m.unit_cost != null ? money(m.unit_cost, currency) : "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{m.reference ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
