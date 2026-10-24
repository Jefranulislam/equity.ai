import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const inviteMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) =>
    z.object({
      email: z.string().email(),
      role: z.enum(["admin", "accountant", "sales", "inventory", "viewer"]),
      organization_id: z.string().uuid(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Caller must be owner/admin of the org
    const { data: meRow } = await supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", data.organization_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!meRow || (meRow.role !== "owner" && meRow.role !== "admin")) {
      throw new Error("Only owners/admins can invite members");
    }

    // Look up auth user by email via admin API
    const { data: list, error: lookupErr } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (lookupErr) throw new Error(lookupErr.message);
    const target = list.users.find(u => u.email?.toLowerCase() === data.email.toLowerCase());
    if (!target) throw new Error("No user found with that email. Ask them to sign up first.");

    const { error: insErr } = await supabaseAdmin.from("organization_members").insert({
      organization_id: data.organization_id,
      user_id: target.id,
      role: data.role,
    });
    if (insErr) {
      if (insErr.message.includes("duplicate")) throw new Error("Already a member");
      throw new Error(insErr.message);
    }
    return { ok: true };
  });
