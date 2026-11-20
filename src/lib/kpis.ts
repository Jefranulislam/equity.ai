/** Pure dashboard KPI aggregation (no I/O), so it can be unit-tested. */

export interface InvoiceKpiRow {
  total: number | string | null;
  amount_paid: number | string | null;
  status: string;
  issue_date: string;
  due_date: string | null;
}

export interface DashboardKpis {
  revenue: number;
  receivables: number;
  payables: number;
  expenses: number;
  overdueCount: number;
  /** Invoiced total per calendar month, index 0 = January. */
  monthly: number[];
}

export function computeDashboardKpis(
  invoices: InvoiceKpiRow[],
  openBills: { total: number | string | null }[],
  expenses: { amount: number | string | null }[],
  today: string,
): DashboardKpis {
  const monthly: number[] = Array(12).fill(0);
  let revenue = 0;
  let receivables = 0;
  let overdueCount = 0;

  for (const r of invoices) {
    if (r.status === "void") continue;
    const total = Number(r.total ?? 0);
    const paid = Number(r.amount_paid ?? 0);
    revenue += paid;
    const outstanding = Math.max(total - paid, 0);
    receivables += outstanding;
    if (outstanding > 0 && r.due_date && r.due_date < today) overdueCount++;
    monthly[new Date(r.issue_date).getMonth()] += total;
  }

  const payables = openBills.reduce((sum, b) => sum + Number(b.total ?? 0), 0);
  const expenseTotal = expenses.reduce((sum, e) => sum + Number(e.amount ?? 0), 0);

  return { revenue, receivables, payables, expenses: expenseTotal, overdueCount, monthly };
}
