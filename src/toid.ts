/**
 * Horizon's "total order ID": ledger sequence in the top 32 bits, transaction
 * application order in the next 20, operation index in the low 12 (both 1-based).
 * Ported from go-stellar-sdk/toid.
 */
export function toid(ledger: number, transactionOrder: number, operationIndex: number): string {
  return ((BigInt(ledger) << 32n) | (BigInt(transactionOrder) << 12n) | BigInt(operationIndex)).toString();
}
