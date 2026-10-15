import type { NormalizedTransaction } from "../normalize.ts";
import type { BaseOperationRecord, OperationRecord } from "../records.ts";
import type { Operation, OperationResult } from "../xdr-json.ts";
import { accountMerge } from "./account-merge.ts";
import { createAccount } from "./create-account.ts";
import { pathPaymentStrictReceive, pathPaymentStrictSend } from "./path-payment.ts";
import { payment } from "./payment.ts";

/** Everything a mapper may need about one operation. */
export interface OperationContext {
  tx: NormalizedTransaction;
  operation: Operation;
  /** The operation's body for its own type, e.g. the `payment` arm. */
  body: Record<string, unknown>;
  /** The operation's inner result for its own type, or undefined if the transaction failed. */
  result: unknown;
  /** Fields common to every record, already filled in. */
  base: Omit<BaseOperationRecord, "type" | "type_i">;
}

export interface OperationMapper {
  /** Horizon's numeric operation type (`type_i`). */
  typeI: number;
  /** Whether Horizon's `/payments` endpoint includes this operation type. */
  isPayment: boolean;
  map(ctx: OperationContext): OperationRecord;
}

/**
 * Supported operation types, keyed by the XDR operation body arm name (which is also
 * Horizon's `type` string). To support a new operation type, add a mapper and register it here.
 */
export const mappers: Record<string, OperationMapper> = {
  create_account: createAccount,
  payment,
  path_payment_strict_receive: pathPaymentStrictReceive,
  account_merge: accountMerge,
  path_payment_strict_send: pathPaymentStrictSend,
};

/** Horizon operation types that `toOperations` supports (and `toPayments`, where they are payments). */
export const supportedOperationTypes: readonly string[] = Object.freeze(Object.keys(mappers));

/** Returns the result for this operation's own type, e.g. the `payment` arm of `op_inner`. */
export function innerResult(result: OperationResult | undefined, type: string): unknown {
  if (!result || typeof result !== "object" || !("op_inner" in result)) return undefined;
  const inner = (result as { op_inner: Record<string, unknown> }).op_inner;
  return inner[type];
}
