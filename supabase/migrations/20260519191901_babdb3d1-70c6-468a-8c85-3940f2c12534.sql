-- Allow org members to view each other's profiles (needed for team management UI)
CREATE POLICY "profiles_select_org_peers"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.organization_members m1
    JOIN public.organization_members m2 ON m1.organization_id = m2.organization_id
    WHERE m1.user_id = auth.uid() AND m2.user_id = public.profiles.id
  )
);