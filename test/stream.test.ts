import { rpc } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";
import { type RpcTransaction, streamPayments, type TransactionsClient } from "../src/index.ts";
import { loadFixtures } from "./fixtures.ts";

const fixtures = loadFixtures()
  .filter((f) => f.network === "testnet")
  .sort((a, b) => Number(a.rpc.ledger) - Number(b.rpc.ledger) || Number(a.rpc.applicationOrder) - Number(b.rpc.applicationOrder));

/** Serves the fixtures as `getTransactions` pages, recording every request it receives. */
function fakeClient(transactions: RpcTransaction[]) {
  const requests: Parameters<TransactionsClient["getTransactions"]>[0][] = [];
  const client: TransactionsClient = {
    async getTransactions(request) {
      requests.push(request);
      const limit = request.pagination?.limit ?? 200;
      const start = request.pagination?.cursor
        ? Number(request.pagination.cursor)
        : transactions.findIndex((tx) => Number(tx.ledger) >= (request.startLedger ?? 0));
      const page = start < 0 ? [] : transactions.slice(start, start + limit);
      return { transactions: page, cursor: String(Math.max(start, 0) + page.length) };
    },
  };
  return { client, requests };
}

const collect = async <T>(iterable: AsyncIterable<T>) => {
  const out: T[] = [];
  for await (const item of iterable) out.push(item);
  return out;
};

const successfulPayments = (list = fixtures) => list.filter((f) => f.horizonTransaction.successful).flatMap((f) => f.horizonPayments);
const firstLedger = Number(fixtures[0]?.rpc.ledger);

describe("streamPayments", () => {
  it("pages through every transaction and yields Horizon's payments in ledger order", async () => {
    const { client, requests } = fakeClient(fixtures.map((f) => f.rpc));
    const records = await collect(streamPayments(client, { startLedger: firstLedger, pageSize: 2 }));
    expect(records).toEqual(successfulPayments());
    expect(requests[0]).toEqual({ startLedger: firstLedger, pagination: { limit: 2 } });
    expect(requests.slice(1).every((r) => r.pagination?.cursor && r.startLedger === undefined)).toBe(true);
  });

  it("includes failed transactions when asked", async () => {
    const { client } = fakeClient(fixtures.map((f) => f.rpc));
    const records = await collect(streamPayments(client, { startLedger: firstLedger, includeFailed: true }));
    expect(records).toEqual(fixtures.flatMap((f) => f.horizonPayments));
  });

  it("filters to payments that involve the given account, as sender or receiver", async () => {
    const all = successfulPayments();
    const receiver = (all.find((r) => r.type === "payment") as { to: string }).to;
    const { client } = fakeClient(fixtures.map((f) => f.rpc));
    const records = await collect(streamPayments(client, { startLedger: firstLedger, account: receiver }));
    const parties = ["from", "to", "funder", "account", "into"];
    expect(records).toEqual(all.filter((r) => parties.some((p) => r[p] === receiver)));
    expect(records.length).toBeGreaterThan(0);
  });

  it("stops after endLedger", async () => {
    const endLedger = Number(fixtures[Math.floor(fixtures.length / 2)]?.rpc.ledger);
    const { client } = fakeClient(fixtures.map((f) => f.rpc));
    const records = await collect(streamPayments(client, { startLedger: firstLedger, endLedger }));
    expect(records).toEqual(successfulPayments(fixtures.filter((f) => Number(f.rpc.ledger) <= endLedger)));
  });

  it("stops when the RPC returns a short page instead of asking again", async () => {
    const { client, requests } = fakeClient(fixtures.map((f) => f.rpc));
    await collect(streamPayments(client, { startLedger: firstLedger, pageSize: 200 }));
    expect(requests).toHaveLength(1);
  });
});

describe("SDK compatibility", () => {
  it("accepts the SDK's rpc.Server as a TransactionsClient", () => {
    const client: TransactionsClient = new rpc.Server("https://rpc.invalid");
    expect(typeof client.getTransactions).toBe("function");
  });
});
