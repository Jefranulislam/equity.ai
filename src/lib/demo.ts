import { supabase } from "@/integrations/supabase/client";
import { DEMO_EMAIL, DEMO_PASSWORD, DEMO_ENABLED } from "@/lib/demo-credentials";

/**
 * One-tap demo sign-in (landing page and /login). Only available when the
 * build sets VITE_DEMO_EMAIL and VITE_DEMO_PASSWORD. The demo account itself
 * is created once on the server with POST /api/demo (see HowToSetup.md).
 */
export async function launchDemo(): Promise<void> {
  if (!DEMO_ENABLED) {
    throw new Error("Demo login is not enabled on this deployment. Please sign up for a free account.");
  }
  const { error } = await supabase.auth.signInWithPassword({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
  });
  if (error) {
    throw new Error("The demo account is not set up yet. Please sign up for a free account.");
  }
}
