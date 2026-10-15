/** Base class for every error thrown by horizonless. */
export class HorizonlessError extends Error {
  override name = "HorizonlessError";
}

/** The input could not be recognised as a Stellar RPC transaction. */
export class InvalidTransactionError extends HorizonlessError {
  override name = "InvalidTransactionError";
}

/** RPC reported the transaction as NOT_FOUND (unknown hash, or outside RPC's retention window). */
export class TransactionNotFoundError extends HorizonlessError {
  override name = "TransactionNotFoundError";
  constructor(readonly hash: string | undefined) {
    super(`Transaction ${hash ?? "(unknown hash)"} was not found by RPC`);
  }
}
