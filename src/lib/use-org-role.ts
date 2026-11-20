import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/auth-context";
import { useOrg } from "@/contexts/org-context";
import type { Database } from "@/integrations/supabase/types";

export type OrgRole = Database["public"]["Enums"]["org_role"];

/**
 * The signed-in user's role in the current workspace.
 *
 * UI convenience only: it hides or disables controls the user cannot use.
 * The real enforcement is the RLS policies (`has_org_role(...)`) on every
 * table. See HowToSetup.md, "Security model".
 */
export function useOrgRole() {
  const { user } = useAuth();
  const { currentOrg } = useOrg();
  const [role, setRole] = useState<OrgRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!user || !currentOrg) {
      setRole(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", currentOrg.id)
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setRole((data?.role as OrgRole | undefined) ?? null);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on ids only
  }, [user?.id, currentOrg?.id]);

  const isAdmin = role === "owner" || role === "admin";
  return { role, loading, isAdmin };
}
