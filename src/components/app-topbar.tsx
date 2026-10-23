import { Search, Plus, Building2, Check } from "lucide-react";
import { useState } from "react";
import { useOrg } from "@/contexts/org-context";
import { Link } from "@tanstack/react-router";

export function AppTopbar({ onOpenPalette }: { onOpenPalette?: () => void }) {
  const { organizations, currentOrg, setCurrentOrg } = useOrg();
  const [open, setOpen] = useState(false);

  return (
    <header className="h-14 border-b border-border flex items-center justify-between px-8 bg-background/80 backdrop-blur-md sticky top-0 z-10">
      <div className="flex items-center gap-3 flex-1">
        {/* Org switcher */}
        <div className="relative">
          <button
            onClick={() => setOpen(!open)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border hover:bg-muted transition-colors font-medium"
          >
            <Building2 className="size-3.5 text-muted-foreground" />
            <span className="truncate max-w-[160px]">{currentOrg?.name ?? "Select workspace"}</span>
            <span className="text-[10px] text-muted-foreground">▾</span>
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

        <button
          onClick={onOpenPalette}
          className="flex items-center gap-2 px-3 py-1.5 bg-muted/60 rounded-md border border-border w-80 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors text-left"
        >
          <Search className="size-3.5" />
          <span className="flex-1">Search invoices, customers, products…</span>
          <span className="text-[10px] border border-border px-1 rounded bg-background">⌘K</span>
        </button>
      </div>

      <Link
        to="/invoices/new"
        className="flex items-center gap-1.5 px-3 py-1.5 bg-accent text-accent-foreground rounded-md font-medium hover:bg-accent/90 transition-colors"
      >
        <Plus className="size-3.5" />
        Create Invoice
      </Link>
    </header>
  );
}
