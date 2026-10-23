import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, stepCountIs, tool, type UIMessage } from "ai";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createLovableAiGatewayProvider, createCustomAiProvider } from "@/lib/ai-gateway";

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const auth = request.headers.get("authorization") ?? "";
        const token = auth.replace(/^Bearer\s+/i, "");
        if (!token) return new Response("Unauthorized", { status: 401 });

        const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(token);
        if (userErr || !userRes.user) return new Response("Unauthorized", { status: 401 });
        const userId = userRes.user.id;

        const body = (await request.json()) as { messages?: UIMessage[]; organizationId?: string };
        const orgId = body.organizationId;
        const messages = body.messages;
        if (!orgId || !Array.isArray(messages)) return new Response("Bad request", { status: 400 });

        const { data: membership } = await supabaseAdmin
          .from("organization_members")
          .select("role")
          .eq("organization_id", orgId)
          .eq("user_id", userId)
          .maybeSingle();
        if (!membership) return new Response("Forbidden", { status: 403 });

        // AI provider selection:
        //  - AI_API_KEY set  → any OpenAI-compatible endpoint (AI_BASE_URL / AI_MODEL optional)
        //  - otherwise       → Lovable AI Gateway via LOVABLE_API_KEY
        const customKey = process.env.AI_API_KEY;
        const lovableKey = process.env.LOVABLE_API_KEY;
        if (!customKey && !lovableKey) {
          return new Response("Missing LOVABLE_API_KEY (or AI_API_KEY for a custom provider)", { status: 500 });
        }

        const provider = customKey
          ? createCustomAiProvider(customKey, process.env.AI_BASE_URL)
          : createLovableAiGatewayProvider(lovableKey!);
        const model = provider(process.env.AI_MODEL ?? "google/gemini-2.5-flash");

        const tools = {
          financial_summary: tool({
            description: "Get headline financial KPIs: total revenue (paid invoices), total expenses (bills + standalone expenses), accounts receivable (open invoices), accounts payable (open bills), and cash on hand from posted journal entries.",
            inputSchema: z.object({}),
            execute: async () => {
              const [inv, bills, exps] = await Promise.all([
                supabaseAdmin.from("invoices").select("total,amount_paid,status").eq("organization_id", orgId),
                supabaseAdmin.from("bills").select("total,amount_paid,status").eq("organization_id", orgId),
                supabaseAdmin.from("expenses").select("amount").eq("organization_id", orgId),
              ]);
              const sum = <T extends Record<string, unknown>>(rows: T[] | null, k: keyof T) =>
                (rows ?? []).reduce((s, r) => s + Number(r[k] ?? 0), 0);
              const revenue = sum(inv.data, "amount_paid");
              const ar = (inv.data ?? []).filter(r => r.status !== "paid" && r.status !== "void")
                .reduce((s, r) => s + (Number(r.total) - Number(r.amount_paid)), 0);
              const billsTotal = sum(bills.data, "total");
              const ap = (bills.data ?? []).filter(r => r.status !== "paid")
                .reduce((s, r) => s + (Number(r.total) - Number(r.amount_paid)), 0);
              const expTotal = sum(exps.data, "amount");
              return { revenue, accounts_receivable: ar, bills_total: billsTotal, accounts_payable: ap, expenses_total: expTotal, net: revenue - billsTotal - expTotal };
            },
          }),
          recent_invoices: tool({
            description: "List the N most recent invoices with customer name, status and totals.",
            inputSchema: z.object({ limit: z.number().min(1).max(50).default(10) }),
            execute: async ({ limit }) => {
              const { data } = await supabaseAdmin
                .from("invoices")
                .select("invoice_number,issue_date,due_date,status,total,amount_paid,customer:customers(billing_name)")
                .eq("organization_id", orgId)
                .order("issue_date", { ascending: false })
                .limit(limit);
              return data ?? [];
            },
          }),
          recent_bills: tool({
            description: "List the N most recent vendor bills.",
            inputSchema: z.object({ limit: z.number().min(1).max(50).default(10) }),
            execute: async ({ limit }) => {
              const { data } = await supabaseAdmin
                .from("bills")
                .select("bill_number,issue_date,due_date,status,total,amount_paid,vendor:vendors(name)")
                .eq("organization_id", orgId)
                .order("issue_date", { ascending: false })
                .limit(limit);
              return data ?? [];
            },
          }),
          inventory_snapshot: tool({
            description: "List products with current on-hand quantity (summed across all locations) and sale price.",
            inputSchema: z.object({ limit: z.number().min(1).max(100).default(20) }),
            execute: async ({ limit }) => {
              const { data: products } = await supabaseAdmin.from("products").select("id,name,sku,sale_price,unit").eq("organization_id", orgId).limit(limit);
              const { data: stock } = await supabaseAdmin.from("inventory_stock").select("product_id,quantity").eq("organization_id", orgId);
              const map = new Map<string, number>();
              for (const r of stock ?? []) map.set(r.product_id as string, (map.get(r.product_id as string) ?? 0) + Number(r.quantity));
              return (products ?? []).map(p => ({ ...p, on_hand: map.get(p.id) ?? 0 }));
            },
          }),
          tax_summary: tool({
            description: "Get tax collected on invoices vs tax paid on bills for a date range.",
            inputSchema: z.object({ from: z.string().optional(), to: z.string().optional() }),
            execute: async ({ from, to }) => {
              let invQ = supabaseAdmin.from("invoices").select("tax_total,issue_date").eq("organization_id", orgId);
              let billQ = supabaseAdmin.from("bills").select("tax_total,issue_date").eq("organization_id", orgId);
              if (from) { invQ = invQ.gte("issue_date", from); billQ = billQ.gte("issue_date", from); }
              if (to) { invQ = invQ.lte("issue_date", to); billQ = billQ.lte("issue_date", to); }
              const [a, b] = await Promise.all([invQ, billQ]);
              const collected = (a.data ?? []).reduce((s, r) => s + Number(r.tax_total ?? 0), 0);
              const paid = (b.data ?? []).reduce((s, r) => s + Number(r.tax_total ?? 0), 0);
              return { tax_collected: collected, tax_paid: paid, net_tax_liability: collected - paid, period: { from: from ?? "all", to: to ?? "all" } };
            },
          }),
        };

        const result = streamText({
          model,
          system: "You are Freya, the AI finance analyst inside Equity.AI — an ERP for SMBs. You answer questions about the user's invoices, bills, expenses, inventory, accounting and tax position. Always call a tool to ground your answer in the user's actual data before responding. Format monetary values with the org's currency, keep answers concise, and prefer markdown tables for lists. Today's date is " + new Date().toISOString().slice(0, 10) + ".",
          messages: await convertToModelMessages(messages),
          tools,
          stopWhen: stepCountIs(50),
        });

        return result.toUIMessageStreamResponse({ originalMessages: messages });
      },
    },
  },
});
