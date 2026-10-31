-- SECURITY DEFINER RPC for workspace creation without server functions.
-- Static deployments (Hostinger SPA / Vercel static) have no TanStack server
-- functions, so onboarding must create the workspace through the database.
-- The RPC runs as the table owner, bypassing RLS for the provisioning inserts
-- (org row + owner membership). Default location and chart-of-accounts /
-- expense-category seeding still happen via the existing AFTER INSERT triggers.
CREATE OR REPLACE FUNCTION public.create_workspace(
  p_name TEXT, p_country TEXT, p_currency TEXT, p_tax_regime TEXT DEFAULT NULL
)
RETURNS TABLE (id UUID, name TEXT, currency TEXT, country TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  v_uid UUID;
  v_org_id UUID;
BEGIN
  SELECT auth.uid() INTO v_uid;
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;

  -- Self-service provisioning only: caller must not have any org membership yet.
  IF EXISTS (SELECT 1 FROM public.organization_members WHERE user_id = v_uid) THEN
    RAISE EXCEPTION 'You already have a workspace. Use the workspace switcher.';
  END IF;

  INSERT INTO public.organizations (name, country, currency, tax_regime, created_by)
  VALUES (p_name, p_country, p_currency, p_tax_regime, v_uid)
  RETURNING public.organizations.id INTO v_org_id;

  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_org_id, v_uid, 'owner');

  RETURN QUERY
  SELECT o.id, o.name, o.currency, o.country
  FROM public.organizations o
  WHERE o.id = v_org_id;
END $$;

-- Owner must be the table owner so SECURITY DEFINER reliably bypasses RLS.
ALTER FUNCTION public.create_workspace(TEXT, TEXT, TEXT, TEXT) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.create_workspace(TEXT, TEXT, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_workspace(TEXT, TEXT, TEXT, TEXT) TO authenticated;
