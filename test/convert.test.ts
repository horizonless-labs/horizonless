import { describe, expect, it } from "vitest";
import {
  InvalidTransactionError,
  type RpcTransaction,
  supportedOperationTypes,
  TransactionNotFoundError,
  toOperations,
  toPayments,
} from "../src/index.ts";
import { loadFixtures, sdkParsed } from "./fixtures.ts";

const fixtures = loadFixtures();
const supported = new Set(supportedOperationTypes);

const inputForms = {
  "raw JSON-RPC result": async (raw: RpcTransaction) => raw,
  "SDK-parsed result": sdkParsed,
};

describe.each(Object.entries(inputForms))("from the %s", (_form, prepare) => {
  describe.each(fixtures.map((f) => [`${f.label} (${f.network} ${f.hash.slice(0, 8)})`, f] as const))("%s", (_name, fixture) => {
    it("toPayments matches Horizon's /payments", async () => {
      const tx = await prepare(fixture.rpc);
      expect(toPayments(tx, { includeFailed: true })).toEqual(fixture.horizonPayments);
    });

    it("toOperations matches Horizon's /operations for supported types", async () => {
      const tx = await prepare(fixture.rpc);
      const expected = fixture.horizonOperations.filter((op) => supported.has(op.type as string));
      expect(toOperations(tx, { includeFailed: true })).toEqual(expected);
    });

    it("excludes failed transactions by default", async () => {
      const tx = await prepare(fixture.rpc);
      const expected = fixture.horizonTransaction.successful ? fixture.horizonPayments : [];
      expect(toPayments(tx)).toEqual(expected);
    });
  });
});

describe("input validation", () => {
  it("throws TransactionNotFoundError for NOT_FOUND", () => {
    expect(() => toPayments({ status: "NOT_FOUND", txHash: "abc" })).toThrow(TransactionNotFoundError);
  });

  it("throws InvalidTransactionError for something that is not an RPC transaction", () => {
    expect(() => toPayments({} as RpcTransaction)).toThrow(InvalidTransactionError);
    expect(() => toPayments(null as unknown as RpcTransaction)).toThrow(InvalidTransactionError);
  });

  it("throws InvalidTransactionError for undecodable XDR", () => {
    const rpc = fixtures[0]?.rpc as RpcTransaction;
    expect(() => toPayments({ ...rpc, envelopeXdr: "not-xdr" })).toThrow(InvalidTransactionError);
  });
});
