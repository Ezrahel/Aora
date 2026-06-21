/** Build a parameterised IN-clause and the flattened params array. */
export function inClause(
  items: string[],
  startIndex = 1,
): { clauses: string; params: string[] } {
  const clauses = items
    .map((_, i) => `$${startIndex + i}`)
    .join(", ");
  return { clauses, params: items };
}

/** Return a "SET col = $N, col2 = $M" string + params for partial updates. */
export function buildSetClause(
  updates: Record<string, any>,
  startIndex = 1,
): { setClause: string; params: any[] } {
  const entries = Object.entries(updates).filter(([, v]) => v !== undefined);
  const setClause = entries
    .map(([col], i) => `${col} = $${startIndex + i}`)
    .join(", ");
  return { setClause, params: entries.map(([, v]) => v) };
}
