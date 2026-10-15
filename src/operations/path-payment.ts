import { assetFields, baseAccount, formatAmount } from "../format.ts";
import type { AssetRef, PathPaymentStrictReceiveRecord, PathPaymentStrictSendRecord } from "../records.ts";
import type { Asset, Int64 } from "../xdr-json.ts";
import type { OperationMapper } from "./registry.ts";

interface ClaimAtom {
  [kind: string]: { asset_bought: Asset; amount_bought: Int64 };
}

interface PathPaymentSuccess {
  success?: { offers: ClaimAtom[]; last: { amount: Int64 } };
}

const assetKey = (asset: Asset) => JSON.stringify(asset);

/**
 * Amount spent in the source asset: the sum of the leading claim atoms that bought the
 * same asset as the first one, or `last.amount` when no offers were crossed.
 * Ported from go-stellar-sdk `PathPaymentStrictReceiveResult.SendAmount`.
 */
function sendAmount(result: PathPaymentSuccess | undefined): bigint {
  const success = result?.success;
  if (!success) return 0n;
  const atoms = success.offers.map((o) => Object.values(o)[0]);
  if (atoms.length === 0 || !atoms[0]) return BigInt(success.last.amount);
  const first = assetKey(atoms[0].asset_bought);
  let total = 0n;
  for (const atom of atoms) {
    if (!atom || assetKey(atom.asset_bought) !== first) break;
    total += BigInt(atom.amount_bought);
  }
  return total;
}

/** Amount received in the destination asset. Ported from `PathPaymentStrictSendResult.DestAmount`. */
function destAmount(result: PathPaymentSuccess | undefined): bigint {
  return result?.success ? BigInt(result.success.last.amount) : 0n;
}

const path = (assets: Asset[]) => assets.map((a) => assetFields(a) as unknown as AssetRef);

/** Ported from Horizon's operations processor, `OperationTypePathPaymentStrictReceive`. */
export const pathPaymentStrictReceive: OperationMapper = {
  typeI: 2,
  isPayment: true,
  map({ base, body, result, tx }): PathPaymentStrictReceiveRecord {
    const op = body as { send_asset: Asset; send_max: Int64; destination: string; dest_asset: Asset; dest_amount: Int64; path: Asset[] };
    return {
      ...base,
      type: "path_payment_strict_receive",
      type_i: 2,
      ...(assetFields(op.dest_asset) as Pick<PathPaymentStrictReceiveRecord, "asset_type">),
      ...(assetFields(op.send_asset, "source_") as Pick<PathPaymentStrictReceiveRecord, "source_asset_type">),
      from: base.source_account,
      to: baseAccount(op.destination),
      amount: formatAmount(op.dest_amount),
      source_amount: formatAmount(tx.successful ? sendAmount(result as PathPaymentSuccess) : 0n),
      source_max: formatAmount(op.send_max),
      path: path(op.path),
    };
  },
};

/** Ported from Horizon's operations processor, `OperationTypePathPaymentStrictSend`. */
export const pathPaymentStrictSend: OperationMapper = {
  typeI: 13,
  isPayment: true,
  map({ base, body, result, tx }): PathPaymentStrictSendRecord {
    const op = body as { send_asset: Asset; send_amount: Int64; destination: string; dest_asset: Asset; dest_min: Int64; path: Asset[] };
    return {
      ...base,
      type: "path_payment_strict_send",
      type_i: 13,
      ...(assetFields(op.dest_asset) as Pick<PathPaymentStrictSendRecord, "asset_type">),
      ...(assetFields(op.send_asset, "source_") as Pick<PathPaymentStrictSendRecord, "source_asset_type">),
      from: base.source_account,
      to: baseAccount(op.destination),
      amount: formatAmount(tx.successful ? destAmount(result as PathPaymentSuccess) : 0n),
      source_amount: formatAmount(op.send_amount),
      destination_min: formatAmount(op.dest_min),
      path: path(op.path),
    };
  },
};
