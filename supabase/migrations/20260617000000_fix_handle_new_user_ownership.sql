
-- Ensure handle_new_user runs as postgres (superuser → BYPASSRLS).
-- Without this, SECURITY DEFINER on a non-superuser owner doesn't bypass RLS,
-- causing auth.uid() = NULL inside the trigger to fail the org insert policy.
ALTER FUNCTION public.handle_new_user() OWNER TO postgres;
