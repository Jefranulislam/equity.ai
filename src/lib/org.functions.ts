import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getRequest } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const createOrganization = createServerFn({ method: "POST" })
  .validator((input) =>
    z.object({
      name: z.string().min(1),
      country: z.string(),
      currency: z.string(),
      tax_regime: z.string().optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const request = getRequest();
    const token = request.headers.get("authorization")?.replace(/^Bearer /i, "");
    if (!token) throw new Error("Unauthorized");

    // Verify user via admin client — works regardless of JWT algorithm
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !user) throw new Error("Unauthorized");

    const { data: org, error } = await supabaseAdmin
      .from("organizations")
      .insert({ ...data, created_by: user.id })
      .select("id,name,currency,country")
      .single();
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("organization_members").insert({
      organization_id: org.id,
      user_id: user.id,
      role: "owner",
    });

    await supabaseAdmin.from("inventory_locations").insert({
      organization_id: org.id,
      name: "Main warehouse",
      is_default: true,
    });

    return org;
  });
