/**
 * Output record types. These mirror Horizon's `/operations` and `/payments` response
 * records, without `_links`.
 */

export type AssetType = "native" | "credit_alphanum4" | "credit_alphanum12";

/** Fields shared by every operation record. */
export interface BaseOperationRecord {
  id: string;
  paging_token: string;
  transaction_successful: boolean;
  source_account: string;
  type: string;
  type_i: number;
  created_at: string;
  transaction_hash: string;
  /** Account sponsoring the reserve of an entry this operation created, if any. */
  sponsor?: string;
}

export interface AssetRef {
  asset_type: AssetType;
  asset_code?: string;
  asset_issuer?: string;
}

export interface CreateAccountRecord extends BaseOperationRecord {
  type: "create_account";
  type_i: 0;
  account: string;
  funder: string;
  starting_balance: string;
}

export interface PaymentRecord extends BaseOperationRecord, AssetRef {
  type: "payment";
  type_i: 1;
  from: string;
  to: string;
  amount: string;
}

interface PathPaymentFields extends AssetRef {
  from: string;
  to: string;
  amount: string;
  source_amount: string;
  source_asset_type: AssetType;
  source_asset_code?: string;
  source_asset_issuer?: string;
  path: AssetRef[];
}

export interface PathPaymentStrictReceiveRecord extends BaseOperationRecord, PathPaymentFields {
  type: "path_payment_strict_receive";
  type_i: 2;
  source_max: string;
}

export interface PathPaymentStrictSendRecord extends BaseOperationRecord, PathPaymentFields {
  type: "path_payment_strict_send";
  type_i: 13;
  destination_min: string;
}

export interface AccountMergeRecord extends BaseOperationRecord {
  type: "account_merge";
  type_i: 8;
  account: string;
  into: string;
}

/** Records returned by `toPayments` (Horizon's `/payments`). Discriminate on `type`. */
export type PaymentOperationRecord =
  | CreateAccountRecord
  | PaymentRecord
  | PathPaymentStrictReceiveRecord
  | PathPaymentStrictSendRecord
  | AccountMergeRecord;

/** Records returned by `toOperations` (Horizon's `/operations`). Grows as operation types are added. */
export type OperationRecord = PaymentOperationRecord;
