/**
 * Client-side lookup join.
 *
 * Used for list pages whose foreign keys were only added later (migration
 * 20261105000000_add_missing_sales_document_fks.sql). On databases created
 * before that migration, PostgREST embeds such as `customer:customers(...)`
 * fail with PGRST200. Joining in the client works on every database version.
 *
 * @example
 *   joinById(quotes, "customer_id", customers, "customer", (c) => ({ billing_name: c.billing_name }))
 */
export function joinById<R extends object, L extends { id: string }, K extends string, V>(
  rows: R[],
  foreignKey: keyof R,
  lookup: L[],
  as: K,
  pick: (item: L) => V,
): (R & Record<K, V | null>)[] {
  const byId = new Map(lookup.map((item) => [item.id, item]));
  return rows.map((row) => {
    const id: unknown = row[foreignKey];
    const hit = typeof id === "string" ? byId.get(id) : undefined;
    return { ...row, [as]: hit ? pick(hit) : null } as R & Record<K, V | null>;
  });
}
