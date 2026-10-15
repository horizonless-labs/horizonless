import { formatAmount } from "../format.ts";
import type { CreateAccountRecord } from "../records.ts";
import type { OperationMapper } from "./registry.ts";

/** Ported from Horizon's operations processor, `OperationTypeCreateAccount`. */
export const createAccount: OperationMapper = {
  typeI: 0,
  isPayment: true,
  map({ base, body }): CreateAccountRecord {
    const op = body as { destination: string; starting_balance: string };
    return {
      ...base,
      type: "create_account",
      type_i: 0,
      funder: base.source_account,
      account: op.destination,
      starting_balance: formatAmount(op.starting_balance),
    };
  },
};
