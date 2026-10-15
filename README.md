# horizonless

Horizon-style payments and operations, rebuilt from [Stellar RPC](https://developers.stellar.org/docs/data/apis/rpc) data. TypeScript, no server.

[![CI](https://github.com/horizonless-labs/horizonless/actions/workflows/ci.yml/badge.svg)](https://github.com/horizonless-labs/horizonless/actions/workflows/ci.yml)

> **Status: pre-release (v0.1 in progress).** See the [v0.1 spec](docs/prd/0001-v0.1-payments-from-rpc.md).

## Why

Horizon [is nearing end-of-life](https://developers.stellar.org/docs/data/apis), and apps are moving to Stellar RPC. RPC doesn't provide Horizon's payments or effects views: the [migration guide](https://developers.stellar.org/docs/data/apis/migrate-from-horizon-to-rpc) lists them as having "No direct RPC equivalent".

`horizonless` turns RPC transactions into records with **exactly the same shape and values Horizon returns**, including matching `id`s and `paging_token`s. Your history screens, deposit watchers and stored cursors keep working after you migrate.

- **Pure functions.** The converters make no network calls, so they're safe in workers, edge runtimes and batch jobs.
- **Works on any RPC provider.** Records are built from the transaction envelope and result, the same way Horizon does it, so it doesn't depend on classic events being enabled.
- **Proven against Horizon.** Every supported case is a real transaction whose output must equal Horizon's recorded answer, and a nightly job checks fresh testnet transactions.

## Install

```bash
npm install horizonless @stellar/stellar-sdk
```

Requires `@stellar/stellar-sdk` 17 or later (peer dependency) and Node 20 or later.

## Usage

```ts
import { rpc } from "@stellar/stellar-sdk";
import { streamPayments, toOperations, toPayments } from "horizonless";

const server = new rpc.Server("https://soroban-testnet.stellar.org");

// One transaction → the same records as Horizon's /transactions/{hash}/payments
const tx = await server.getTransaction(hash);
const payments = toPayments(tx);

// All payments touching an account, from a ledger onwards
for await (const p of streamPayments(server, { startLedger, account: "G..." })) {
  if (p.type === "payment") console.log(p.from, "→", p.to, p.amount, p.asset_code ?? "XLM");
}
```

`toPayments` and `toOperations` accept the SDK's parsed `getTransaction` result, an item from `getTransactions().transactions`, or the raw JSON-RPC result.

| Horizon endpoint | horizonless |
|---|---|
| `GET /transactions/{hash}/payments` | `toPayments(await server.getTransaction(hash))` |
| `GET /transactions/{hash}/operations` | `toOperations(await server.getTransaction(hash))` |
| `GET /accounts/{id}/payments` (recent) | `streamPayments(server, { startLedger, account: id })` |
| `include_failed=true` | `{ includeFailed: true }` |

### Supported today

`create_account`, `payment`, `path_payment_strict_send`, `path_payment_strict_receive`, `account_merge`. This covers every classic type in Horizon's `/payments`. Unsupported operation types are skipped, never thrown. Check `supportedOperationTypes` at runtime.

### Not yet

Muxed-account fields (`*_muxed`, `*_muxed_id`), other operation types, effects, trades, and smart-contract (SAC) transfers. These are [open issues](https://github.com/horizonless-labs/horizonless/issues), and contributions are welcome.

**RPC history:** RPC keeps about 7 days of transactions. horizonless converts what RPC gives it. It isn't a history archive.

## Contributing

Each operation or effect type is a self-contained issue, with a recorded transaction as its acceptance test. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[Apache-2.0](LICENSE)
