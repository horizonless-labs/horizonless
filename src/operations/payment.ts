import { assetFields, baseAccount, formatAmount } from "../format.ts";
import type { PaymentRecord } from "../records.ts";
import type { Asset } from "../xdr-json.ts";
import type { OperationMapper } from "./registry.ts";

/** Ported from Horizon's operations processor, `OperationTypePayment`. */
export const payment: OperationMapper = {
  typeI: 1,
  isPayment: true,
  map({ base, body }): PaymentRecord {
    const op = body as { destination: string; asset: Asset; amount: string };
    return {
      ...base,
      type: "payment",
      type_i: 1,
      ...(assetFields(op.asset) as Pick<PaymentRecord, "asset_type">),
      from: base.source_account,
      to: baseAccount(op.destination),
      amount: formatAmount(op.amount),
    };
  },
};
