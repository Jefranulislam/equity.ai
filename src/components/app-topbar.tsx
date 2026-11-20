import { Search, Plus, Building2, Check, Menu } from "lucide-react";
import { useState } from "react";
import { useOrg } from "@/contexts/org-context";
import { Link, useRouterState } from "@tanstack/react-router";

export function AppTopbar({
  onOpenPalette,
  onToggleNav,
}: {
  onOpenPalette?: () => void;
  onToggleNav?: () => void;
}) {
  const { organizations, currentOrg, setCurrentOrg } = useOrg();
  const [open, setOpen] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });

  // "Create Invoice" is a contextual action: it only belongs on the invoices
  // screens (and never while the invoice editor itself is already open).
  const onInvoices = path.startsWith("/invoices");
  const showCreateInvoice = onInvoices && path !== "/invoices/new";

  return (
    <header className="h-14 border-b border-border flex items-center gap-2 px-3 sm:px-5 lg:px-8 bg-background/80 backdrop-blur-md sticky top-0 z-20">
      {/* Mobile / tablet nav toggle */}
      <button
        onClick={onToggleNav}
        aria-label="Open navigation"
        className="lg:hidden flex items-center justify-center size-9 shrink-0 rounded-md border border-border bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
      >
        <Menu className="size-4" />
      </button>

      <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
        {/* Org switcher */}
        <div className="relative min-w-0 shrink">
          <button
            onClick={() => setOpen(!open)}
            className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-md border border-border hover:bg-muted transition-colors font-medium min-w-0 max-w-[120px] sm:max-w-[180px]"
          >
            <Building2 className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{currentOrg?.name ?? "Select workspace"}</span>
            <span className="text-[10px] text-muted-foreground shrink-0">▾</span>
          </button>
          {open && (
            <div className="absolute top-full mt-1 left-0 w-64 bg-popover border border-border rounded-lg shadow-lg z-50 p-1">
              {organizations.map((o) => (
                <button
                  key={o.id}
                  onClick={() => { setCurrentOrg(o); setOpen(false); }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted text-left"
                >
                  <Building2 className="size-3.5 text-muted-foreground" />
                  <span className="flex-1 truncate">{o.name}</span>
                  {o.id === currentOrg?.id && <Check className="size-3.5 text-accent" />}
                </button>
              ))}
              {organizations.length === 0 && (
                <div className="px-2 py-1.5 text-muted-foreground">No workspaces</div>
              )}
            </div>
          )}
        </div>

        {/* Search — full field on tablet & desktop */}
        <button
          onClick={onOpenPalette}
          className="hidden md:flex items-center gap-2 flex-1 min-w-0 max-w-md lg:max-w-80 px-3 py-1.5 bg-muted/60 rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors text-left"
        >
          <Search className="size-3.5 shrink-0" />
          <span className="flex-1 min-w-0 truncate">Search invoices, customers, products…</span>
          <span className="hidden lg:inline shrink-0 text-[10px] border border-border px-1 rounded bg-background">⌘K</span>
        </button>

        {/* Search — icon only on mobile */}
        <button
          onClick={onOpenPalette}
          aria-label="Search"
          title="Search"
          className="md:hidden flex items-center justify-center size-9 shrink-0 rounded-md border border-border bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <Search className="size-4" />
        </button>
      </div>

      {showCreateInvoice && (
        <Link
          to="/invoices/new"
          aria-label="Create Invoice"
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-accent text-accent-foreground rounded-md font-medium hover:bg-accent/90 transition-colors shrink-0"
        >
          <Plus className="size-3.5 shrink-0" />
          <span className="hidden sm:inline">Create Invoice</span>
        </Link>
      )}
    </header>
  );
}
