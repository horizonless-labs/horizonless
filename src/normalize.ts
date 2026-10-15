import { xdr } from "@stellar/stellar-sdk";
import { InvalidTransactionError, TransactionNotFoundError } from "./errors.ts";
import { arm, armOf, type LedgerEntryChange, type OperationResult, type Transaction } from "./xdr-json.ts";

/**
 * A transaction as returned by Stellar RPC. Accepts:
 * - the SDK's parsed result of `rpc.Server.getTransaction()` or an item of `getTransactions().transactions`
 * - the raw JSON-RPC `result` of `getTransaction`, or an item of the raw `getTransactions` result
 */
export interface RpcTransaction {
  status: string;
  txHash?: string;
  ledger?: number;
  createdAt?: number | string;
  applicationOrder?: number;
  feeBump?: boolean;
  envelopeXdr?: unknown;
  resultXdr?: unknown;
  resultMetaXdr?: unknown;
}

/** The single internal shape every input form is reduced to. */
export interface NormalizedTransaction {
  hash: string;
  ledger: number;
  applicationOrder: number;
  closeTime: number;
  successful: boolean;
  /** The transaction whose operations ran (the inner transaction of a fee bump). */
  tx: Transaction;
  /** Per-operation results; empty when the transaction failed before applying operations. */
  operationResults: OperationResult[];
  /** Per-operation ledger entry changes; empty arrays when the meta has none. */
  operationChanges: LedgerEntryChange[][];
}

/**
 * Decodes a base64 XDR string or takes an SDK XDR object, and returns its XDR-JSON form
 * (SEP-51). Working on XDR-JSON keeps horizonless independent of the SDK's internal
 * object layout, which differs between major versions.
 */
function decode<T>(value: unknown, type: { fromXDR(input: string, format: "base64"): unknown }, field: string): T {
  let decoded = value;
  if (typeof value === "string") {
    try {
      decoded = type.fromXDR(value, "base64");
    } catch (err) {
      throw new InvalidTransactionError(`Could not decode ${field}: ${(err as Error).message}`);
    }
  }
  if (!decoded || typeof decoded !== "object") throw new InvalidTransactionError(`Missing ${field}`);
  return JSON.parse(JSON.stringify(decoded)) as T;
}

function innerTransaction(envelope: unknown): Transaction {
  const v1 = arm<{ tx: Transaction }>(envelope, "tx");
  if (v1) return v1.tx;
  const feeBump = arm<{ tx: { inner_tx: unknown } }>(envelope, "tx_fee_bump");
  if (feeBump) return innerTransaction(feeBump.tx.inner_tx);
  if (arm(envelope, "tx_v0")) {
    throw new InvalidTransactionError("Legacy v0 transaction envelopes are not supported yet");
  }
  throw new InvalidTransactionError(`Unknown transaction envelope type "${armOf(envelope)}"`);
}

function operationResults(result: unknown): OperationResult[] {
  const body = arm<unknown>(result, "result");
  for (const name of ["tx_success", "tx_failed"]) {
    const ops = arm<OperationResult[]>(body, name);
    if (ops) return ops;
  }
  for (const name of ["tx_fee_bump_inner_success", "tx_fee_bump_inner_failed"]) {
    const inner = arm<{ result: unknown }>(body, name);
    if (inner) return operationResults(inner.result);
  }
  return [];
}

function operationChanges(meta: unknown, operationCount: number): LedgerEntryChange[][] {
  const name = armOf(meta);
  const body = name ? arm<{ operations?: { changes: LedgerEntryChange[] }[] }>(meta, name) : undefined;
  const ops = body?.operations ?? [];
  return Array.from({ length: operationCount }, (_, i) => ops[i]?.changes ?? []);
}

export function normalize(input: RpcTransaction): NormalizedTransaction {
  if (!input || typeof input !== "object" || typeof input.status !== "string") {
    throw new InvalidTransactionError("Expected a Stellar RPC transaction (an object with a `status` field)");
  }
  if (input.status === "NOT_FOUND") throw new TransactionNotFoundError(input.txHash);
  if (input.status !== "SUCCESS" && input.status !== "FAILED") {
    throw new InvalidTransactionError(`Unexpected transaction status "${input.status}"`);
  }
  if (!input.txHash || input.ledger === undefined || input.applicationOrder === undefined || input.createdAt === undefined) {
    throw new InvalidTransactionError("Transaction is missing txHash, ledger, applicationOrder or createdAt");
  }

  const envelope = decode(input.envelopeXdr, xdr.TransactionEnvelope, "envelopeXdr");
  const result = decode(input.resultXdr, xdr.TransactionResult, "resultXdr");
  const meta = input.resultMetaXdr === undefined ? undefined : decode(input.resultMetaXdr, xdr.TransactionMeta, "resultMetaXdr");
  const tx = innerTransaction(envelope);

  return {
    hash: input.txHash,
    ledger: Number(input.ledger),
    applicationOrder: Number(input.applicationOrder),
    closeTime: Number(input.createdAt),
    successful: input.status === "SUCCESS",
    tx,
    operationResults: operationResults(result),
    operationChanges: operationChanges(meta, tx.operations.length),
  };
}
