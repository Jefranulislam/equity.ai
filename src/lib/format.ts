export const money = (amount: number | string | null | undefined, currency = "USD") => {
  const n = typeof amount === "string" ? parseFloat(amount) : (amount ?? 0);
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(n || 0);
};

/** Today's date as YYYY-MM-DD (UTC), the format used by every `date` column. */
export const todayISO = (): string => new Date().toISOString().slice(0, 10);

/** First day of the current month as YYYY-MM-DD (local calendar month). */
export const firstOfMonthISO = (): string => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
};

export const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—";
