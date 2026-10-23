import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth-context";

export interface Organization {
  id: string;
  name: string;
  currency: string;
  country: string;
}

interface OrgCtx {
  organizations: Organization[];
  currentOrg: Organization | null;
  setCurrentOrg: (org: Organization) => void;
  loading: boolean;
  refresh: () => Promise<void>;
}

const Ctx = createContext<OrgCtx>({
  organizations: [],
  currentOrg: null,
  setCurrentOrg: () => {},
  loading: true,
  refresh: async () => {},
});

const STORAGE_KEY = "current_org_id";

export function OrgProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [organizations, setOrgs] = useState<Organization[]>([]);
  const [currentOrg, setCurrent] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) {
      setOrgs([]); setCurrent(null); setLoading(false); return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("organizations")
      .select("id,name,currency,country")
      .order("created_at", { ascending: true });
    const list = (data ?? []) as Organization[];
    setOrgs(list);
    const savedId = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    const saved = list.find((o) => o.id === savedId);
    setCurrent(saved ?? list[0] ?? null);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id]);

  const setCurrentOrg = (org: Organization) => {
    setCurrent(org);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, org.id);
  };

  return (
    <Ctx.Provider value={{ organizations, currentOrg, setCurrentOrg, loading, refresh: load }}>
      {children}
    </Ctx.Provider>
  );
}

export const useOrg = () => useContext(Ctx);
