import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const createOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) =>
    z.object({
      name: z.string().min(1),
      country: z.string(),
      currency: z.string(),
      tax_regime: z.string().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const userId = context.userId;

    const { data: org, error } = await supabaseAdmin
      .from("organizations")
      .insert({ ...data, created_by: userId })
      .select("id,name,currency,country")
      .single();
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("organization_members").insert({
      organization_id: org.id,
      user_id: userId,
      role: "owner",
    });

    await supabaseAdmin.from("inventory_locations").insert({
      organization_id: org.id,
      name: "Main warehouse",
      is_default: true,
    });

    return org;
  });
