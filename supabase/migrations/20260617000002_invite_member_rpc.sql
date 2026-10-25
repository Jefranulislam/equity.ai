-- SECURITY DEFINER RPC for inviting team members without service-role privileges.
-- Lets the client call supabase.rpc('invite_member', ...) — required on static
-- deployments where TanStack server functions are not available.
CREATE OR REPLACE FUNCTION public.invite_member(p_email TEXT, p_role public.org_role, p_org UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user UUID;
  v_caller_ok BOOLEAN;
BEGIN
  -- Caller must be owner/admin of the org
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = p_org AND user_id = auth.uid() AND role IN ('owner','admin')
  ) INTO v_caller_ok;
  IF NOT v_caller_ok THEN
    RAISE EXCEPTION 'Only owners/admins can invite members';
  END IF;

  -- Look up the target user by email inside auth.users
  SELECT id INTO v_user FROM auth.users WHERE lower(email) = lower(p_email) LIMIT 1;
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'No user found with that email. Ask them to sign up first.';
  END IF;

  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (p_org, v_user, p_role)
  ON CONFLICT (organization_id, user_id) DO NOTHING;
END $$;

REVOKE ALL ON FUNCTION public.invite_member(TEXT, public.org_role, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.invite_member(TEXT, public.org_role, UUID) TO authenticated;
