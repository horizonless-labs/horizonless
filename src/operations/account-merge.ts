import { baseAccount } from "../format.ts";
import type { AccountMergeRecord } from "../records.ts";
import type { OperationMapper } from "./registry.ts";

/**
 * Ported from Horizon's operations processor, `OperationTypeAccountMerge`.
 * The account_merge body is the destination itself, not an object.
 */
export const accountMerge: OperationMapper = {
  typeI: 8,
  isPayment: true,
  map({ base, body }): AccountMergeRecord {
    const destination = body as unknown as string;
    return {
      ...base,
      type: "account_merge",
      type_i: 8,
      account: base.source_account,
      into: baseAccount(destination),
    };
  },
};
