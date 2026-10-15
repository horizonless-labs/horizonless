# horizonless

Horizon-style payments, operations and effects, rebuilt from [Stellar RPC](https://developers.stellar.org/docs/data/apis/rpc) data.

> **Status: pre-release.** v0.1 is in development. See the [v0.1 spec](docs/prd/0001-v0.1-payments-from-rpc.md).

## Why

Horizon [is nearing end-of-life](https://developers.stellar.org/docs/data/apis) and apps are moving to Stellar RPC. RPC doesn't provide Horizon's payments or effects views. The [migration guide](https://developers.stellar.org/docs/data/apis/migrate-from-horizon-to-rpc) lists them as having "No direct RPC equivalent".

`horizonless` turns RPC transactions into records with **exactly the same shape and values Horizon returns**, including matching `id`s and `paging_token`s. Your history screens, deposit watchers and stored cursors keep working after you migrate.

- Pure TypeScript functions with no server and no network calls in the converters.
- Built from the transaction envelope and result, the same way Horizon does it, so it works on any RPC provider whether or not classic events are enabled.
- Every supported case is tested against Horizon's own recorded answer for the same transaction.

## Planned API (v0.1)

```ts
import { rpc } from "@stellar/stellar-sdk";
import { toPayments, streamPayments } from "horizonless";

const server = new rpc.Server("https://soroban-testnet.stellar.org");
const tx = await server.getTransaction(hash);
const payments = toPayments(tx); // same records as Horizon's /transactions/{hash}/payments

for await (const p of streamPayments(server, { startLedger, account: "G..." })) {
  console.log(p.type, p.amount, p.asset_code ?? "XLM");
}
```

## Contributing

Contributions are welcome. Each operation or effect type is a self-contained issue whose acceptance test is a recorded transaction. A contributor guide is coming with v0.1.

## License

[Apache-2.0](LICENSE)
