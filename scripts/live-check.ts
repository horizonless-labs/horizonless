/**
 * Converts recent testnet transactions and compares the result with Horizon's answer for
 * the same transaction. Mismatches are captured into test/pending so they can become issues.
 *
 *   npm run live-check -- [maxTransactions=100]
 *
 * Known gaps (muxed-account fields, operation types without a mapper) are counted but not
 * reported as mismatches.
 */
import { isDeepStrictEqual } from "node:util";
import { rpc } from "@stellar/stellar-sdk";
import { supportedOperationTypes, toPayments } from "../src/index.ts";
import { captureFixture } from "./capture-fixture.ts";
import { horizonGet, NETWORKS } from "./networks.ts";

const SUPPORTED = new Set(supportedOperationTypes);
const MUXED_FIELD = /_muxed(_id)?$/;

const max = Number(process.argv[2] ?? 100);
const server = new rpc.Server(NETWORKS.testnet.rpc);
const latest = await server.getLatestLedger();
const page = await server.getTransactions({ startLedger: latest.sequence - 50, pagination: { limit: max } });

let compared = 0;
let skippedMuxed = 0;
const mismatches: string[] = [];

for (const tx of page.transactions) {
  const horizon = await horizonGet<{ _embedded: { records: Record<string, unknown>[] } }>(
    NETWORKS.testnet.horizon,
    `/transactions/${tx.txHash}/payments?limit=200&include_failed=true`,
  );
  const expected = horizon._embedded.records.filter((r) => SUPPORTED.has(r.type as string)).map(({ _links, ...rest }) => rest);
  if (expected.length === 0) continue;
  if (expected.some((r) => Object.keys(r).some((k) => MUXED_FIELD.test(k)))) {
    skippedMuxed++;
    continue;
  }
  compared++;
  const actual = toPayments(tx as never, { includeFailed: true });
  if (!isDeepStrictEqual(actual, expected)) {
    mismatches.push(tx.txHash);
    await captureFixture("testnet", tx.txHash, "live-check mismatch", "test/pending");
  }
}

console.log(`compared ${compared} transactions with payments (${skippedMuxed} skipped: muxed accounts)`);
if (mismatches.length > 0) {
  console.error(`${mismatches.length} mismatch(es), captured under test/pending/testnet:\n${mismatches.join("\n")}`);
  process.exit(1);
}
console.log("no mismatches");
