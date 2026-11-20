import { useEffect, useState, type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { AppSidebar } from "./app-sidebar";
import { AppTopbar } from "./app-topbar";
import { CommandPalette } from "./command-palette";

export function AppShell({ children }: { children: ReactNode }) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
      if (e.key === "Escape") setNavOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => { setNavOpen(false); }, [path]);

  return (
    <div className="flex min-h-screen bg-background text-[13px] text-foreground">
      <AppSidebar open={navOpen} onClose={() => setNavOpen(false)} />
      <main className="flex-1 flex flex-col min-w-0">
        <AppTopbar
          onOpenPalette={() => setPaletteOpen(true)}
          onToggleNav={() => setNavOpen((v) => !v)}
        />
        <div className="flex-1 min-w-0">{children}</div>
      </main>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
