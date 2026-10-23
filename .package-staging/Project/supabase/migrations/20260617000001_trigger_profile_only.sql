
-- Remove auto-org creation from signup trigger.
-- Org setup is handled by the onboarding flow instead.
-- Trigger still creates the profile so auth context works immediately.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  display_name TEXT;
BEGIN
  display_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));

  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, display_name)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END $$;

ALTER FUNCTION public.handle_new_user() OWNER TO postgres;
