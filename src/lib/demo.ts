import { supabase } from "@/integrations/supabase/client";

/**
 * One-click demo account. Calls POST /api/demo (server provisions the demo
 * auth user + the pre-seeded "Acme Trading Co." workspace, mirroring
 * database/seed.sql), redeems the returned one-time token, and the caller
 * redirects to /dashboard — the whole application with 10 months of
 * realistic financial history. No signup form, no email verification.
 */
export async function launchDemo(): Promise<void> {
  const res = await fetch("/api/demo", { method: "POST" });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "Failed to prepare the demo workspace");
  }
  const { tokenHash } = (await res.json()) as { tokenHash: string };
  const { error } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: tokenHash,
  });
  if (error) throw new Error(error.message);
}
