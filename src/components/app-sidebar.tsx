import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, FileText, Users, Boxes, Receipt, Truck,
  Wallet, Calculator, TrendingUp, ShieldCheck, Sparkles, LogOut, Settings, CircleDollarSign, BarChart3,
  FileCheck, ShoppingCart, FileMinus, UserCog, Banknote,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useOrg } from "@/contexts/org-context";
import { useNavigate } from "@tanstack/react-router";

const NAV = [
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { label: "Quotes", to: "/quotes", icon: FileCheck },
  { label: "Invoices", to: "/invoices", icon: FileText },
  { label: "Payments", to: "/payments", icon: CircleDollarSign },
  { label: "Credit Notes", to: "/credit-notes", icon: FileMinus },
  { label: "Customers", to: "/customers", icon: Users },
  { label: "Inventory", to: "/inventory", icon: Boxes },
  { label: "Purchase Orders", to: "/purchase-orders", icon: ShoppingCart },
  { label: "Bills", to: "/bills", icon: Receipt },
  { label: "Vendor Payments", to: "/bill-payments", icon: Banknote },
  { label: "Vendors", to: "/vendors", icon: Truck },
  { label: "Expenses", to: "/expenses", icon: Wallet },
  { label: "Accounting", to: "/accounting", icon: Calculator },
  { label: "Reports", to: "/reports", icon: BarChart3 },
  { label: "Sales", to: "/sales", icon: TrendingUp },
  { label: "Compliance", to: "/compliance", icon: ShieldCheck },
  { label: "Team", to: "/members", icon: UserCog },
  { label: "Settings", to: "/settings", icon: Settings },
] as const;

export function AppSidebar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { signOut, user } = useAuth();
  const { currentOrg } = useOrg();
  const navigate = useNavigate();

  const logout = async () => {
    await signOut();
    navigate({ to: "/login" });
  };

  return (
    <aside className="w-60 shrink-0 border-r border-border bg-sidebar flex flex-col sticky top-0 h-screen">
      <div className="p-6 pb-4">
        <div className="flex items-center gap-2">
          <div className="size-6 bg-accent rounded flex items-center justify-center">
            <div className="size-2.5 bg-white rounded-full" />
          </div>
          <span className="font-bold tracking-tight text-base">EQUITY.AI</span>
        </div>
      </div>

      <nav className="px-4 space-y-0.5 flex-1 overflow-y-auto">
        {NAV.map((item) => {
          const active = path === item.to || path.startsWith(item.to + "/");
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-2.5 px-3 py-1.5 rounded-md font-medium transition-colors ${
                active ? "bg-accent/5 text-accent" : "text-muted-foreground hover:text-foreground hover:bg-accent/5"
              }`}
            >
              <item.icon className="size-3.5" strokeWidth={2} />
              <span>{item.label}</span>
              {active && <span className="ml-auto size-1.5 rounded-full bg-accent" />}
            </Link>
          );
        })}

        <div className="pt-4 mt-4 border-t border-border space-y-1">
          <Link
            to="/ai-agent"
            className="group relative overflow-hidden flex items-center gap-2.5 px-3 py-2 bg-accent text-accent-foreground rounded-md font-medium"
          >
            <Sparkles className="size-3.5" />
            <span>AI Agent</span>
            <span className="ml-auto text-[10px] bg-white/20 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">Beta</span>
          </Link>
        </div>
      </nav>

      <div className="p-3 border-t border-border">
        <div className="flex items-center gap-3 p-2 rounded-lg">
          <div className="size-8 rounded-full bg-muted flex items-center justify-center text-[11px] font-bold uppercase">
            {(currentOrg?.name ?? user?.email ?? "?").slice(0, 2)}
          </div>
          <div className="overflow-hidden flex-1 min-w-0">
            <div className="font-medium truncate">{currentOrg?.name ?? "No workspace"}</div>
            <div className="text-[11px] text-muted-foreground truncate">{user?.email}</div>
          </div>
          <button onClick={logout} title="Sign out" className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
            <LogOut className="size-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
