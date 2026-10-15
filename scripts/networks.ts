export const NETWORKS = {
  testnet: {
    rpc: "https://soroban-testnet.stellar.org",
    horizon: "https://horizon-testnet.stellar.org",
  },
  mainnet: {
    // SDF does not run a public mainnet RPC; set HORIZONLESS_MAINNET_RPC to a provider URL.
    rpc: process.env.HORIZONLESS_MAINNET_RPC ?? "",
    horizon: "https://horizon.stellar.org",
  },
} as const;

export type NetworkName = keyof typeof NETWORKS;

export function network(name: string) {
  if (!(name in NETWORKS)) throw new Error(`Unknown network "${name}". Use one of: ${Object.keys(NETWORKS).join(", ")}`);
  const n = NETWORKS[name as NetworkName];
  if (!n.rpc) throw new Error(`No RPC URL configured for ${name}. Set HORIZONLESS_MAINNET_RPC.`);
  return n;
}

export async function rpcCall<T>(url: string, method: string, params: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!res.ok) throw new Error(`${method} failed: HTTP ${res.status}`);
  const body = (await res.json()) as { result?: T; error?: { message: string } };
  if (body.error) throw new Error(`${method} failed: ${body.error.message}`);
  return body.result as T;
}

export async function horizonGet<T>(base: string, path: string): Promise<T> {
  const res = await fetch(`${base}${path}`);
  if (!res.ok) throw new Error(`GET ${path} failed: HTTP ${res.status}`);
  return (await res.json()) as T;
}
