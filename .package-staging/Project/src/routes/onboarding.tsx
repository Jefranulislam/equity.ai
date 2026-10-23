import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Building2, Sparkles, ArrowRight, Check } from "lucide-react";
import { toast } from "sonner";
import { createOrganization } from "@/lib/org.functions";
import { useAuth } from "@/contexts/auth-context";
import { useOrg } from "@/contexts/org-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/onboarding")({
  head: () => ({ meta: [{ title: "Welcome — Equity.AI" }] }),
  component: Onboarding,
});

const COUNTRIES: { code: string; name: string; currency: string; regime: string }[] = [
  { code: "US", name: "United States", currency: "USD", regime: "US-GAAP" },
  { code: "GB", name: "United Kingdom", currency: "GBP", regime: "UK-VAT" },
  { code: "DE", name: "Germany", currency: "EUR", regime: "EU-VAT" },
  { code: "FR", name: "France", currency: "EUR", regime: "EU-VAT" },
  { code: "ES", name: "Spain", currency: "EUR", regime: "EU-VAT" },
  { code: "IT", name: "Italy", currency: "EUR", regime: "EU-VAT" },
  { code: "NL", name: "Netherlands", currency: "EUR", regime: "EU-VAT" },
  { code: "IN", name: "India", currency: "INR", regime: "IN-GST" },
  { code: "AE", name: "United Arab Emirates", currency: "AED", regime: "AE-VAT" },
  { code: "SG", name: "Singapore", currency: "SGD", regime: "SG-GST" },
  { code: "AU", name: "Australia", currency: "AUD", regime: "AU-GST" },
  { code: "CA", name: "Canada", currency: "CAD", regime: "CA-GST" },
  { code: "JP", name: "Japan", currency: "JPY", regime: "JP-CT" },
  { code: "BR", name: "Brazil", currency: "BRL", regime: "BR-ICMS" },
];

const CURRENCIES = ["USD", "EUR", "GBP", "INR", "AED", "SGD", "AUD", "CAD", "JPY", "BRL", "CHF", "CNY", "MXN", "ZAR"];

function Onboarding() {
  const { user, loading: authLoading } = useAuth();
  const { organizations, loading: orgLoading, refresh, setCurrentOrg } = useOrg();
  const nav = useNavigate();

  const [name, setName] = useState("");
  const [country, setCountry] = useState("US");
  const [currency, setCurrency] = useState("USD");
  const [regime, setRegime] = useState("US-GAAP");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const c = COUNTRIES.find((c) => c.code === country);
    if (c) { setCurrency(c.currency); setRegime(c.regime); }
  }, [country]);

  if (authLoading || orgLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" />;
  if (organizations.length > 0) return <Navigate to="/dashboard" />;

  const create = async () => {
    if (!name.trim()) return toast.error("Enter a workspace name");
    setSaving(true);
    try {
      const org = await createOrganization({
        data: { name: name.trim(), country, currency, tax_regime: regime },
      });
      await refresh();
      setCurrentOrg(org);
      toast.success("Workspace ready");
      nav({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create workspace");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-5xl grid md:grid-cols-[1.1fr_1fr] gap-0 rounded-2xl overflow-hidden border border-border bg-card shadow-2xl">
        {/* Left: brand panel */}
        <div className="hidden md:flex flex-col justify-between p-10 bg-gradient-to-br from-primary/15 via-accent/10 to-background border-r border-border">
          <div>
            <div className="flex items-center gap-2 mb-12">
              <div className="size-9 rounded-lg bg-primary text-primary-foreground grid place-items-center font-bold">E</div>
              <span className="font-bold tracking-tight">Equity.AI</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight leading-tight mb-3">
              Welcome aboard.<br />Let's set up your books.
            </h1>
            <p className="text-muted-foreground text-sm leading-relaxed max-w-sm">
              In about 30 seconds you'll have an accounting-grade workspace with invoicing, expenses,
              compliance, and Freya — your AI finance co-pilot — wired up.
            </p>
          </div>
          <ul className="space-y-2.5 text-sm">
            {[
              "Multi-currency invoices & payments",
              "Bills, expenses, double-entry accounting",
              "Inventory and sales analytics",
              "Country-aware tax compliance",
            ].map((f) => (
              <li key={f} className="flex items-center gap-2.5 text-muted-foreground">
                <div className="size-5 rounded-full bg-success/15 text-success grid place-items-center">
                  <Check className="size-3" />
                </div>
                {f}
              </li>
            ))}
          </ul>
        </div>

        {/* Right: form */}
        <div className="p-8 md:p-10">
          <div className="flex items-center gap-2 mb-1 text-xs font-bold uppercase tracking-wider text-accent">
            <Sparkles className="size-3.5" /> Step 1 of 1
          </div>
          <h2 className="text-2xl font-bold tracking-tight mb-1">Create your workspace</h2>
          <p className="text-muted-foreground text-sm mb-7">
            You can invite teammates and tweak settings later.
          </p>

          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label>Workspace name</Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  autoFocus
                  className="pl-9"
                  placeholder="Acme Inc."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && create()}
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label>Country</Label>
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Base currency</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Tax regime</Label>
                <Input value={regime} onChange={(e) => setRegime(e.target.value)} />
              </div>
            </div>

            <Button onClick={create} disabled={saving || !name.trim()} className="mt-3 h-11">
              {saving ? "Creating workspace…" : (
                <>Enter Equity.AI <ArrowRight className="size-4" /></>
              )}
            </Button>
            <p className="text-[11px] text-muted-foreground text-center">
              By continuing you become the <span className="font-semibold text-foreground">owner</span> of this workspace.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
