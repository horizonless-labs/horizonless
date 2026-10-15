/**
 * Record a test fixture: the raw RPC getTransaction result plus Horizon's answers
 * for the same transaction hash.
 *
 *   npm run fixture:capture -- <network> <hash> [label]
 *
 * Fixtures under test/fixtures are run by the test suite. Pass --pending to save into
 * test/pending instead, for cases the library does not support yet.
 *
 * RPC keeps only ~7 days of history, so capture fixtures soon after the transaction lands.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { horizonGet, network, rpcCall } from "./networks.ts";

type HorizonPage = { _embedded: { records: Record<string, unknown>[] } };

const stripLinks = (r: Record<string, unknown>) => {
  const { _links, ...rest } = r;
  return rest;
};

export async function captureFixture(networkName: string, hash: string, label = "", root = join("test", "fixtures")) {
  const net = network(networkName);
  const rpc = await rpcCall<{ status: string }>(net.rpc, "getTransaction", { hash });
  if (rpc.status !== "SUCCESS" && rpc.status !== "FAILED") {
    throw new Error(`RPC returned status ${rpc.status} for ${hash} (outside RPC's retention window?)`);
  }
  const q = "?limit=200&include_failed=true";
  const [transaction, payments, operations] = await Promise.all([
    horizonGet<Record<string, unknown>>(net.horizon, `/transactions/${hash}`),
    horizonGet<HorizonPage>(net.horizon, `/transactions/${hash}/payments${q}`),
    horizonGet<HorizonPage>(net.horizon, `/transactions/${hash}/operations${q}`),
  ]);

  const dir = join(root, networkName, hash);
  await mkdir(dir, { recursive: true });
  const write = (name: string, data: unknown) => writeFile(join(dir, name), `${JSON.stringify(data, null, 2)}\n`);
  await Promise.all([
    write("fixture.json", { network: networkName, hash, label, capturedAt: new Date().toISOString() }),
    write("rpc.json", rpc),
    write("horizon-transaction.json", stripLinks(transaction)),
    write("horizon-payments.json", payments._embedded.records.map(stripLinks)),
    write("horizon-operations.json", operations._embedded.records.map(stripLinks)),
  ]);
  return dir;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const pending = args.includes("--pending");
  const [networkName, hash, ...label] = args.filter((a) => a !== "--pending");
  if (!networkName || !hash) {
    console.error("usage: npm run fixture:capture -- <testnet|mainnet> <hash> [label] [--pending]");
    process.exit(1);
  }
  captureFixture(networkName, hash, label.join(" "), pending ? join("test", "pending") : undefined)
    .then((dir) => console.log(`captured ${dir}`))
    .catch((err) => {
      console.error(err.message);
      process.exit(1);
    });
}
