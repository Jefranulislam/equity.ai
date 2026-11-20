-- Security fix: close a privilege-escalation path on organization_members.
--
-- The original policy "members_insert_admins_or_self" allowed
--     user_id = auth.uid() OR has_org_role(... owner/admin)
-- so ANY signed-in user could insert a membership row for THEMSELVES into ANY
-- workspace (with any role, including 'owner') if they knew its UUID.
--
-- New rule:
--   * owners/admins of the workspace may add members (invite flow), or
--   * a user may add themselves only to a workspace they created
--     (organizations.created_by = auth.uid()) - the self-service onboarding
--     path used on static deployments.
--
-- The creator check uses a SECURITY DEFINER helper because the organizations
-- SELECT policy hides the new org from its creator until the membership row
-- exists.

CREATE OR REPLACE FUNCTION public.is_org_creator(_org UUID, _user UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organizations WHERE id = _org AND created_by = _user
  );
$$;

REVOKE ALL ON FUNCTION public.is_org_creator(UUID, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_org_creator(UUID, UUID) TO authenticated;

DROP POLICY IF EXISTS "members_insert_admins_or_self" ON public.organization_members;
DROP POLICY IF EXISTS "members_insert_admins_or_creator" ON public.organization_members;

CREATE POLICY "members_insert_admins_or_creator" ON public.organization_members
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::public.org_role[])
    OR (user_id = auth.uid() AND public.is_org_creator(organization_id, auth.uid()))
  );
