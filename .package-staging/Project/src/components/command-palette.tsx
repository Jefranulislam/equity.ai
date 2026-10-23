import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard, FileText, Users, Boxes, Receipt, Truck, Wallet, Calculator,
  TrendingUp, ShieldCheck, Settings, CircleDollarSign, BarChart3, Plus, Sparkles,
  Building2, Package, ArrowRight,
} from "lucide-react";
import {
  CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, CommandSeparator,
} from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/org-context";

interface Hit { id: string; label: string; sub?: string; to: string; params?: Record<string, string>; icon: React.ComponentType<{ className?: string }> }

const NAV: Hit[] = [
  { id: "n-dash", label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { id: "n-inv", label: "Invoices", to: "/invoices", icon: FileText },
  { id: "n-pay", label: "Payments", to: "/payments", icon: CircleDollarSign },
  { id: "n-cust", label: "Customers", to: "/customers", icon: Users },
  { id: "n-prod", label: "Inventory", to: "/inventory", icon: Boxes },
  { id: "n-bills", label: "Bills", to: "/bills", icon: Receipt },
  { id: "n-vend", label: "Vendors", to: "/vendors", icon: Truck },
  { id: "n-exp", label: "Expenses", to: "/expenses", icon: Wallet },
  { id: "n-acc", label: "Accounting", to: "/accounting", icon: Calculator },
  { id: "n-rep", label: "Reports", to: "/reports", icon: BarChart3 },
  { id: "n-sales", label: "Sales", to: "/sales", icon: TrendingUp },
  { id: "n-comp", label: "Compliance", to: "/compliance", icon: ShieldCheck },
  { id: "n-ai", label: "Freya AI Agent", to: "/ai-agent", icon: Sparkles },
  { id: "n-set", label: "Settings", to: "/settings", icon: Settings },
];

const ACTIONS: Hit[] = [
  { id: "a-inv", label: "New invoice", sub: "Create a customer invoice", to: "/invoices/new", icon: Plus },
];

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const navigate = useNavigate();
  const { currentOrg } = useOrg();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<{ invoices: Hit[]; customers: Hit[]; vendors: Hit[]; products: Hit[] }>({
    invoices: [], customers: [], vendors: [], products: [],
  });

  // Debounced live search
  useEffect(() => {
    if (!open || !currentOrg || q.trim().length < 2) {
      setHits({ invoices: [], customers: [], vendors: [], products: [] });
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      const term = `%${q.trim()}%`;
      const orgId = currentOrg.id;
      const [inv, cust, vend, prod] = await Promise.all([
        supabase.from("invoices").select("id,invoice_number,total,currency,customer:customers(billing_name)").eq("organization_id", orgId).ilike("invoice_number", term).limit(5),
        supabase.from("customers").select("id,billing_name,email").eq("organization_id", orgId).ilike("billing_name", term).limit(5),
        supabase.from("vendors").select("id,name,email").eq("organization_id", orgId).ilike("name", term).limit(5),
        supabase.from("products").select("id,name,sku").eq("organization_id", orgId).or(`name.ilike.${term},sku.ilike.${term}`).limit(5),
      ]);
      if (ctrl.signal.aborted) return;
      setHits({
        invoices: ((inv.data ?? []) as { id: string; invoice_number: string; total: number | string; currency: string; customer: { billing_name: string } | null }[]).map((r) => ({
          id: `inv-${r.id}`, label: r.invoice_number, sub: r.customer?.billing_name ?? "—",
          to: "/invoices/$invoiceId", params: { invoiceId: r.id }, icon: FileText,
        })),
        customers: ((cust.data ?? []) as { id: string; billing_name: string; email: string | null }[]).map((r) => ({
          id: `cust-${r.id}`, label: r.billing_name, sub: r.email ?? undefined, to: "/customers", icon: Users,
        })),
        vendors: ((vend.data ?? []) as { id: string; name: string; email: string | null }[]).map((r) => ({
          id: `vend-${r.id}`, label: r.name, sub: r.email ?? undefined, to: "/vendors", icon: Truck,
        })),
        products: ((prod.data ?? []) as { id: string; name: string; sku: string | null }[]).map((r) => ({
          id: `prod-${r.id}`, label: r.name, sub: r.sku ?? undefined, to: "/inventory", icon: Package,
        })),
      });
    }, 180);
    return () => { ctrl.abort(); clearTimeout(t); };
  }, [q, open, currentOrg?.id]);

  const go = (h: Hit) => {
    onOpenChange(false);
    setQ("");
    navigate((h.params ? { to: h.to, params: h.params } : { to: h.to }) as Parameters<typeof navigate>[0]);
  };

  const hasResults = hits.invoices.length + hits.customers.length + hits.vendors.length + hits.products.length > 0;

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput value={q} onValueChange={setQ} placeholder="Search invoices, customers, vendors, products — or jump to a page…" />
      <CommandList>
        <CommandEmpty>
          {q.trim().length < 2 ? "Type to search…" : "Nothing found."}
        </CommandEmpty>

        {hits.invoices.length > 0 && (
          <CommandGroup heading="Invoices">
            {hits.invoices.map((h) => <Item key={h.id} hit={h} onSelect={() => go(h)} />)}
          </CommandGroup>
        )}
        {hits.customers.length > 0 && (
          <CommandGroup heading="Customers">
            {hits.customers.map((h) => <Item key={h.id} hit={h} onSelect={() => go(h)} />)}
          </CommandGroup>
        )}
        {hits.vendors.length > 0 && (
          <CommandGroup heading="Vendors">
            {hits.vendors.map((h) => <Item key={h.id} hit={h} onSelect={() => go(h)} />)}
          </CommandGroup>
        )}
        {hits.products.length > 0 && (
          <CommandGroup heading="Products">
            {hits.products.map((h) => <Item key={h.id} hit={h} onSelect={() => go(h)} />)}
          </CommandGroup>
        )}

        {hasResults && <CommandSeparator />}

        <CommandGroup heading="Quick actions">
          {ACTIONS.map((h) => <Item key={h.id} hit={h} onSelect={() => go(h)} />)}
        </CommandGroup>

        <CommandGroup heading="Navigate">
          {NAV.map((h) => <Item key={h.id} hit={h} onSelect={() => go(h)} />)}
        </CommandGroup>

        {currentOrg && (
          <>
            <CommandSeparator />
            <div className="px-3 py-2 text-[11px] text-muted-foreground flex items-center gap-1.5">
              <Building2 className="size-3" />
              <span>Workspace:</span>
              <span className="font-semibold text-foreground">{currentOrg.name}</span>
            </div>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}

function Item({ hit, onSelect }: { hit: Hit; onSelect: () => void }) {
  const Icon = hit.icon;
  // value combines label + sub so cmdk's built-in filter matches both
  const value = useMemo(() => `${hit.label} ${hit.sub ?? ""} ${hit.id}`, [hit]);
  return (
    <CommandItem value={value} onSelect={onSelect} className="gap-2.5">
      <Icon className="size-3.5 text-muted-foreground" />
      <span className="font-medium">{hit.label}</span>
      {hit.sub && <span className="text-muted-foreground truncate">— {hit.sub}</span>}
      <ArrowRight className="size-3 ml-auto text-muted-foreground opacity-0 group-aria-selected:opacity-100" />
    </CommandItem>
  );
}
