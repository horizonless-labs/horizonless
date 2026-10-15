import { type ConvertOptions, toPayments } from "./convert.ts";
import type { RpcTransaction } from "./normalize.ts";
import type { PaymentOperationRecord } from "./records.ts";

/** Anything that can page through RPC transactions. `rpc.Server` from the SDK satisfies this. */
export interface TransactionsClient {
  getTransactions(request: {
    startLedger?: number;
    pagination?: { cursor?: string; limit?: number };
  }): Promise<{ transactions: RpcTransaction[]; cursor?: string; latestLedger?: number }>;
}

export interface StreamPaymentsOptions extends ConvertOptions {
  /** First ledger to read. Must be inside the RPC's retention window. */
  startLedger: number;
  /** Last ledger to read (inclusive). Default: read until the RPC's latest ledger. */
  endLedger?: number;
  /** Only yield records where this account sends or receives. */
  account?: string;
  /** Page size for `getTransactions`. Default: 200. */
  pageSize?: number;
}

const PARTIES = ["from", "to", "funder", "account", "into"] as const;

function involves(record: PaymentOperationRecord, account: string): boolean {
  return PARTIES.some((field) => (record as unknown as Record<string, unknown>)[field] === account);
}

/**
 * Walks RPC transactions from `startLedger` and yields Horizon-shaped payment records in
 * ledger order. Stops at `endLedger`, or when the RPC has no newer transactions.
 */
export async function* streamPayments(client: TransactionsClient, options: StreamPaymentsOptions): AsyncGenerator<PaymentOperationRecord> {
  const limit = options.pageSize ?? 200;
  let request: Parameters<TransactionsClient["getTransactions"]>[0] = {
    startLedger: options.startLedger,
    pagination: { limit },
  };

  while (true) {
    const page = await client.getTransactions(request);
    for (const tx of page.transactions) {
      if (options.endLedger !== undefined && Number(tx.ledger) > options.endLedger) return;
      for (const record of toPayments(tx, options)) {
        if (!options.account || involves(record, options.account)) yield record;
      }
    }
    if (page.transactions.length < limit || !page.cursor) return;
    request = { pagination: { cursor: page.cursor, limit } };
  }
}
