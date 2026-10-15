import { extractBaseAddress } from "@stellar/stellar-sdk";
import type { Asset, Int64, MuxedAccount } from "./xdr-json.ts";

const STROOPS_PER_UNIT = 10_000_000n;

/** Formats an int64 stroop amount the way Horizon does: a decimal string with 7 places. */
export function formatAmount(stroops: Int64 | bigint | number): string {
  let value = BigInt(stroops);
  const negative = value < 0n;
  if (negative) value = -value;
  const whole = value / STROOPS_PER_UNIT;
  const fraction = (value % STROOPS_PER_UNIT).toString().padStart(7, "0");
  return `${negative ? "-" : ""}${whole}.${fraction}`;
}

/** Returns the `G...` account for a `G...` or `M...` address. */
export function baseAccount(account: MuxedAccount): string {
  return account.startsWith("M") ? extractBaseAddress(account) : account;
}

/** Horizon's `asset_type` / `asset_code` / `asset_issuer` fields, optionally prefixed (e.g. `source_`). */
export function assetFields(asset: Asset, prefix = ""): Record<string, string> {
  if (asset === "native") return { [`${prefix}asset_type`]: "native" };
  const [type, credit] = Object.entries(asset)[0] as [string, { asset_code: string; issuer: string }];
  return {
    [`${prefix}asset_type`]: type,
    [`${prefix}asset_code`]: credit.asset_code,
    [`${prefix}asset_issuer`]: credit.issuer,
  };
}

/** Horizon's `created_at` format: ISO-8601 UTC without milliseconds. */
export function formatCloseTime(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString().replace(".000Z", "Z");
}
