import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { rpc } from "@stellar/stellar-sdk";
import type { RpcTransaction } from "../src/index.ts";

const ROOT = join(import.meta.dirname, "fixtures");

export interface Fixture {
  network: string;
  hash: string;
  label: string;
  /** Raw JSON-RPC `getTransaction` result. */
  rpc: RpcTransaction;
  horizonTransaction: { successful: boolean };
  horizonPayments: Record<string, unknown>[];
  horizonOperations: Record<string, unknown>[];
}

const read = (dir: string, name: string) => JSON.parse(readFileSync(join(dir, name), "utf8"));

export function loadFixtures(): Fixture[] {
  return readdirSync(ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .flatMap((network) =>
      readdirSync(join(ROOT, network.name)).map((hash) => {
        const dir = join(ROOT, network.name, hash);
        const meta = read(dir, "fixture.json");
        return {
          network: network.name,
          hash,
          label: meta.label,
          rpc: read(dir, "rpc.json"),
          horizonTransaction: read(dir, "horizon-transaction.json"),
          horizonPayments: read(dir, "horizon-payments.json"),
          horizonOperations: read(dir, "horizon-operations.json"),
        };
      }),
    );
}

/** Runs a raw fixture through the SDK's own `getTransaction` parsing, offline. */
export async function sdkParsed(raw: RpcTransaction): Promise<RpcTransaction> {
  const server = new rpc.Server("https://rpc.invalid");
  (server as unknown as { _getTransaction: () => Promise<unknown> })._getTransaction = async () => raw;
  return (await server.getTransaction(raw.txHash ?? "")) as unknown as RpcTransaction;
}
