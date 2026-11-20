-- Server-side ledger aggregation.
--
-- The Accounting page previously downloaded every journal line of the
-- workspace to compute the trial balance and P&L in the browser. This view
-- aggregates POSTED lines per account in SQL, so the page only fetches one row
-- per account plus a bounded page of recent journal entries.
--
-- security_invoker = true makes the view run with the caller's privileges, so
-- the existing RLS policies on journal_lines / journal_entries (is_org_member)
-- still decide which rows are visible. No tenant can read another's balances.

CREATE OR REPLACE VIEW public.account_balances
WITH (security_invoker = true) AS
SELECT
  jl.organization_id,
  jl.account_id,
  COALESCE(SUM(jl.debit), 0)::numeric(18,2)  AS debit,
  COALESCE(SUM(jl.credit), 0)::numeric(18,2) AS credit
FROM public.journal_lines jl
JOIN public.journal_entries je ON je.id = jl.entry_id
WHERE je.is_posted = true
GROUP BY jl.organization_id, jl.account_id;

GRANT SELECT ON public.account_balances TO authenticated;
REVOKE ALL ON public.account_balances FROM anon;
