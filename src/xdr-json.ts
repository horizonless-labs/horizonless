/**
 * Minimal types for the XDR-JSON objects produced by `@stellar/stellar-sdk` >= 17.
 *
 * Unions are objects with a single key naming the arm (`{ payment: {...} }`), or a bare
 * string for void arms (`"native"`, `"none"`). 64-bit integers are decimal strings and
 * account IDs are strkeys. Only the parts horizonless reads are typed here.
 */

export type Int64 = string;
export type AccountId = string;
/** `G...` or `M...` strkey. */
export type MuxedAccount = string;

export type Asset =
  | "native"
  | { credit_alphanum4: { asset_code: string; issuer: AccountId } }
  | { credit_alphanum12: { asset_code: string; issuer: AccountId } };

export interface Operation {
  source_account: MuxedAccount | null;
  body: Record<string, unknown> | string;
}

export interface Transaction {
  source_account: MuxedAccount;
  operations: Operation[];
}

/** One entry of `result.tx_success` / `result.tx_failed`. */
export type OperationResult = { op_inner: Record<string, unknown> } | Record<string, unknown> | string;

export interface LedgerEntry {
  ext?: "v0" | { v1?: { sponsoring_id?: AccountId | null } };
}

export type LedgerEntryChange =
  | { created: LedgerEntry }
  | { updated: LedgerEntry }
  | { state: LedgerEntry }
  | { restored: LedgerEntry }
  | { removed: unknown };

/** Returns the single arm name of an XDR-JSON union value. */
export function armOf(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    return Object.keys(value).find((k) => k !== "type");
  }
  return undefined;
}

/** Returns the value held by the given union arm, if that arm is set. */
export function arm<T = unknown>(value: unknown, name: string): T | undefined {
  if (value && typeof value === "object" && name in value) {
    return (value as Record<string, T>)[name];
  }
  return undefined;
}
