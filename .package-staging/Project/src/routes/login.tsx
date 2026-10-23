import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in — Equity.AI" }] }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: name }, emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
        if (error) throw error;
        toast.success("Check your email and click the confirmation link to continue.");
        setBusy(false);
        return;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      {/* Left brand panel */}
      <div className="hidden lg:flex flex-col justify-between p-12 bg-accent text-accent-foreground relative overflow-hidden">
        <div className="flex items-center gap-2">
          <div className="size-7 rounded bg-white/10 flex items-center justify-center">
            <div className="size-3 rounded-full bg-white" />
          </div>
          <span className="font-bold tracking-tight">EQUITY.AI</span>
        </div>
        <div className="space-y-6 relative">
          <h1 className="text-4xl font-bold tracking-tight leading-[1.1] text-balance">
            The AI-powered operating system for your finance team.
          </h1>
          <p className="text-white/70 max-w-md leading-relaxed">
            Invoicing, accounting, inventory, expenses, and compliance — unified, real-time, and quietly intelligent.
          </p>
          <div className="grid grid-cols-3 gap-px bg-white/10 rounded-lg overflow-hidden">
            {["Invoices", "Inventory", "Accounting", "Vendors", "Compliance", "AI Agent"].map((m) => (
              <div key={m} className="bg-accent px-3 py-3 text-[11px] font-medium text-white/60 uppercase tracking-wider">{m}</div>
            ))}
          </div>
        </div>
        <div className="text-[11px] text-white/40 uppercase tracking-widest">© Equity.AI — Reference architecture</div>
      </div>

      {/* Right form */}
      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-sm space-y-6 animate-reveal">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold tracking-tight">{mode === "signin" ? "Welcome back" : "Create your workspace"}</h2>
            <p className="text-sm text-muted-foreground">
              {mode === "signin" ? "Sign in to your ledger." : "We'll spin up your workspace automatically."}
            </p>
          </div>

          <form onSubmit={submit} className="space-y-3">
            {mode === "signup" && (
              <input
                value={name} onChange={(e) => setName(e.target.value)}
                placeholder="Full name" required
                className="w-full h-10 px-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            )}
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com" required autoComplete="email"
              className="w-full h-10 px-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
            <input
              type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="Password" required minLength={8}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              className="w-full h-10 px-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
            <button
              disabled={busy} type="submit"
              className="w-full h-10 rounded-md bg-accent text-accent-foreground font-medium text-sm hover:bg-accent/90 transition-colors disabled:opacity-50"
            >{busy ? "…" : mode === "signin" ? "Sign in" : "Create account"}</button>
          </form>

          <p className="text-center text-xs text-muted-foreground">
            {mode === "signin" ? "Don't have an account?" : "Already have one?"}{" "}
            <button onClick={() => setMode(mode === "signin" ? "signup" : "signin")} className="font-semibold text-foreground hover:underline">
              {mode === "signin" ? "Create account" : "Sign in"}
            </button>
          </p>

          <Link to="/" className="block text-center text-[11px] text-muted-foreground hover:text-foreground">← Back home</Link>
        </div>
      </div>
    </div>
  );
}
