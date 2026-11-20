-- Team pages could not show teammates' names.
--
-- 1. organization_members has no foreign key to profiles (both reference
--    auth.users), so the PostgREST embed `profile:profiles(full_name)` failed
--    with PGRST200. The app now fetches profiles separately and joins them.
-- 2. profiles were readable only by their owner ("profiles_select_self"), so
--    even a separate query returned nobody else's name.
--
-- Fix: a member may read the profile (name, avatar) of anyone who shares at
-- least one workspace with them. Users still update/insert only their own row.

CREATE OR REPLACE FUNCTION public.shares_org_with(_other UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members me
    JOIN public.organization_members them
      ON them.organization_id = me.organization_id
    WHERE me.user_id = auth.uid() AND them.user_id = _other
  );
$$;

REVOKE ALL ON FUNCTION public.shares_org_with(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.shares_org_with(UUID) TO authenticated;

DROP POLICY IF EXISTS "profiles_select_teammates" ON public.profiles;
CREATE POLICY "profiles_select_teammates" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.shares_org_with(id));
