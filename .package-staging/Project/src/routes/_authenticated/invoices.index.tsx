import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/org-context";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { money, fmtDate } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/invoices/")({
  component: InvoicesPage,
});

interface Row {
  id: string;
  invoice_number: string;
  issue_date: string;
  due_date: string | null;
  status: "draft" | "sent" | "partial" | "paid" | "void";
  total: number | string;
  amount_paid: number | string;
  currency: string;
  customers: { billing_name: string } | null;
}

const STATUS_COLOR: Record<Row["status"], string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  partial: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  paid: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  void: "bg-destructive/10 text-destructive",
};

function InvoicesPage() {
  const { currentOrg } = useOrg();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentOrg) return;
    setLoading(true);
    supabase
      .from("invoices")
      .select("id,invoice_number,issue_date,due_date,status,total,amount_paid,currency,customers(billing_name)")
      .eq("organization_id", currentOrg.id)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) toast.error(error.message);
        setRows((data ?? []) as unknown as Row[]);
        setLoading(false);
      });
  }, [currentOrg?.id]);

  const totalOutstanding = rows
    .filter((r) => r.status !== "paid" && r.status !== "void")
    .reduce((s, r) => s + (Number(r.total) - Number(r.amount_paid)), 0);

  return (
    <div className="p-8 max-w-6xl mx-auto w-full animate-reveal">
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-1">Invoices</h1>
          <p className="text-muted-foreground">
            {rows.length} total · {money(totalOutstanding, currentOrg?.currency)} outstanding
          </p>
        </div>
        <Button onClick={() => navigate({ to: "/invoices/new" })}>
          <Plus className="size-4 mr-1.5" />New invoice
        </Button>
      </div>

      <div className="border border-border rounded-xl overflow-hidden bg-card">
        <table className="w-full text-sm">
          <thead className="bg-sidebar/60 text-muted-foreground text-[11px] uppercase tracking-wider">
            <tr>
              <th className="text-left px-4 py-2.5">Number</th>
              <th className="text-left px-4 py-2.5">Customer</th>
              <th className="text-left px-4 py-2.5">Issued</th>
              <th className="text-left px-4 py-2.5">Due</th>
              <th className="text-right px-4 py-2.5">Total</th>
              <th className="text-right px-4 py-2.5">Paid</th>
              <th className="px-4 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">No invoices yet. Create your first one.</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id} className="border-t border-border hover:bg-sidebar/40">
                <td className="px-4 py-3">
                  <Link to="/invoices/$invoiceId" params={{ invoiceId: r.id }} className="font-mono font-medium text-accent hover:underline">
                    {r.invoice_number}
                  </Link>
                </td>
                <td className="px-4 py-3">{r.customers?.billing_name ?? <span className="text-muted-foreground">—</span>}</td>
                <td className="px-4 py-3 text-muted-foreground">{fmtDate(r.issue_date)}</td>
                <td className="px-4 py-3 text-muted-foreground">{fmtDate(r.due_date)}</td>
                <td className="px-4 py-3 text-right font-medium">{money(r.total, r.currency)}</td>
                <td className="px-4 py-3 text-right text-muted-foreground">{money(r.amount_paid, r.currency)}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${STATUS_COLOR[r.status]}`}>
                    {r.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
