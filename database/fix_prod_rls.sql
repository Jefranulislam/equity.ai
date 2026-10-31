-- =============================================================================
-- Equity.AI — PROD DB FIX (run once in the Supabase SQL Editor)
-- =============================================================================
-- Purpose: the production project is missing the RLS INSERT policies for
--   `organizations` and `organization_members` (onboarding signup fails with
--   42501 "new row violates row-level security policy"), and the
--   `create_workspace` SECURITY DEFINER RPC was never applied
--   (PGRST202: function not found).
--
-- This script is IDEMPOTENT: it only creates what is missing.
-- How to run: Supabase Dashboard -> (project fybaenmbzbwufqeyjalg)
--             SQL Editor -> paste whole file -> Run.
-- =============================================================================

-- 1) role enum (only if missing)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'org_role' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.org_role AS ENUM ('owner','admin','accountant','sales','viewer');
  END IF;
END $$;

-- 2) SECURITY DEFINER helpers (avoid recursive RLS) — safe to (re)create
CREATE OR REPLACE FUNCTION public.is_org_member(_org UUID, _user UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.organization_members WHERE organization_id = _org AND user_id = _user);
$$;

CREATE OR REPLACE FUNCTION public.has_org_role(_org UUID, _user UUID, _roles public.org_role[])
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.organization_members WHERE organization_id = _org AND user_id = _user AND role = ANY(_roles));
$$;

-- 3) RLS must be enabled (re-assert; no-op if already on)
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- 4) Missing INSERT policies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'organizations' AND policyname = 'org_insert_self'
  ) THEN
    CREATE POLICY "org_insert_self" ON public.organizations
      FOR INSERT TO authenticated
      WITH CHECK (created_by = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'organization_members' AND policyname = 'members_insert_admins_or_self'
  ) THEN
    CREATE POLICY "members_insert_admins_or_self" ON public.organization_members
      FOR INSERT TO authenticated
      WITH CHECK (
        user_id = auth.uid() OR public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::public.org_role[])
      );
  END IF;
END $$;

-- 5) visibility helpers (only if missing — keep parity with base schema)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'organizations' AND policyname = 'org_select_members'
  ) THEN
    CREATE POLICY "org_select_members" ON public.organizations
      FOR SELECT TO authenticated
      USING (public.is_org_member(id, auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'organization_members' AND policyname = 'members_select_same_org'
  ) THEN
    CREATE POLICY "members_select_same_org" ON public.organization_members
      FOR SELECT TO authenticated
      USING (public.is_org_member(organization_id, auth.uid()));
  END IF;
END $$;

-- 6) create_workspace RPC — atomic workspace provisioning used by the
--    static-deployment onboarding fallback (bypasses RLS via SECURITY DEFINER)
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

ALTER FUNCTION public.create_workspace(TEXT, TEXT, TEXT, TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.create_workspace(TEXT, TEXT, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_workspace(TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- 7) Verify (result should list the policies above)
SELECT tablename, policyname, as_expr_part || ' -> ' || roles AS policy_part, cmd
FROM (
  SELECT tablename, policyname, cmd, 'CHECK: ' || COALESCE(with_check::text,'-') AS as_expr_part, roles FROM pg_policies WHERE tablename = 'organizations'
  UNION ALL
  SELECT tablename, policyname, cmd, 'USING: ' || COALESCE(qual::text,'-') AS as_expr_part, roles FROM pg_policies WHERE tablename = 'organization_members'
) t
ORDER BY tablename, policyname;
