/**
 * Display-only brokerage identifier.
 * Example: INDIVIDUAL_MARGIN + CVY123456 => INDIVIDUAL_MARGIN-CVY**56.
 * Never use this masked string as a database identity or API account ID.
 */
export function formatBrokerageAccount(accountType: string | null | undefined, accountId: string): string {
  const type = (accountType?.trim() || 'Brokerage');
  const first = accountId.slice(0, 3);
  const last = accountId.slice(-2);
  return `${type}-${first}**${last}`;
}
