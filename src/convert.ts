import { baseAccount, formatCloseTime } from "./format.ts";
import { type NormalizedTransaction, normalize, type RpcTransaction } from "./normalize.ts";
import { innerResult, mappers } from "./operations/registry.ts";
import type { OperationRecord, PaymentOperationRecord } from "./records.ts";
import { toid } from "./toid.ts";
import { armOf, type LedgerEntry, type LedgerEntryChange } from "./xdr-json.ts";

export interface ConvertOptions {
  /** Include records from failed transactions (Horizon's `include_failed=true`). Default: false. */
  includeFailed?: boolean;
}

/**
 * The sponsor of the first ledger entry this operation created, if any.
 * Ported from Horizon's `transactionOperationWrapper.getSponsor` (signer sponsorship for
 * set_options is not handled yet).
 */
function sponsorOf(changes: LedgerEntryChange[]): string | undefined {
  for (const change of changes) {
    const created = (change as { created?: LedgerEntry }).created;
    if (!created) continue;
    const ext = created.ext;
    const sponsor = typeof ext === "object" ? ext.v1?.sponsoring_id : undefined;
    if (sponsor) return sponsor;
  }
  return undefined;
}

function convert(tx: NormalizedTransaction, onlyPayments: boolean): OperationRecord[] {
  const records: OperationRecord[] = [];
  tx.tx.operations.forEach((operation, index) => {
    const type = armOf(operation.body);
    const mapper = type ? mappers[type] : undefined;
    if (!type || !mapper || (onlyPayments && !mapper.isPayment)) return;

    const id = toid(tx.ledger, tx.applicationOrder, index + 1);
    const sponsor = sponsorOf(tx.operationChanges[index] ?? []);
    const body = typeof operation.body === "object" ? (operation.body as Record<string, unknown>)[type] : undefined;
    const record = mapper.map({
      tx,
      operation,
      body: body as Record<string, unknown>,
      result: tx.successful ? innerResult(tx.operationResults[index], type) : undefined,
      base: {
        id,
        paging_token: id,
        transaction_successful: tx.successful,
        source_account: baseAccount(operation.source_account ?? tx.tx.source_account),
        created_at: formatCloseTime(tx.closeTime),
        transaction_hash: tx.hash,
      },
    });
    records.push(sponsor ? { ...record, sponsor } : record);
  });
  return records;
}

/**
 * Converts one RPC transaction into the records Horizon's
 * `/transactions/{hash}/payments` returns for it. Pure and synchronous.
 */
export function toPayments(tx: RpcTransaction, options: ConvertOptions = {}): PaymentOperationRecord[] {
  const normalized = normalize(tx);
  if (!normalized.successful && !options.includeFailed) return [];
  return convert(normalized, true) as PaymentOperationRecord[];
}

/**
 * Converts one RPC transaction into the records Horizon's
 * `/transactions/{hash}/operations` returns for it, for supported operation types.
 * Unsupported operation types are skipped. Pure and synchronous.
 */
export function toOperations(tx: RpcTransaction, options: ConvertOptions = {}): OperationRecord[] {
  const normalized = normalize(tx);
  if (!normalized.successful && !options.includeFailed) return [];
  return convert(normalized, false);
}
