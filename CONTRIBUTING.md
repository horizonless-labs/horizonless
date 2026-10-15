# Contributing to horizonless

Thanks for helping. horizonless has one rule that makes reviews quick: **Horizon is the reference.** Every change is proven by a fixture, which is a real transaction whose output must equal Horizon's recorded answer.

## Setup

```bash
git clone https://github.com/horizonless-labs/horizonless.git
cd horizonless
npm install
npm test
```

Node 20 or later. Tests run offline from committed fixtures.

## How the code is laid out

| Module | Job |
|---|---|
| `src/normalize.ts` | Turns any RPC input form (raw JSON-RPC or SDK-parsed) into one internal shape, in XDR-JSON (SEP-51). |
| `src/operations/*.ts` | One mapper per operation type. Each turns one operation into a Horizon-shaped record. |
| `src/operations/registry.ts` | The list of supported operation types. |
| `src/convert.ts` | `toPayments` / `toOperations`: IDs, shared fields, sponsor, then the mapper. |
| `src/stream.ts` | `streamPayments`: pages through `getTransactions`. |
| `src/format.ts` | Amounts, assets, accounts and timestamps formatted exactly as Horizon does. |

## Add an operation type in 4 steps

1. **Capture a fixture.** Find a transaction containing the operation (on [testnet Horizon](https://horizon-testnet.stellar.org/operations?order=desc), or create one; see `scripts/scenarios/`). RPC only keeps about 7 days of history, so capture it soon:
   ```bash
   npm run fixture:capture -- testnet <hash> "manage_sell_offer creating a new offer"
   ```
2. **Write the mapper** in `src/operations/<type>.ts`. Port the logic from Horizon's [`operations_processor.go`](https://github.com/stellar/stellar-horizon/blob/main/internal/ingest/processors/operations_processor.go) and link the source in the doc comment. Add the record type to `src/records.ts`.
3. **Register it** in `src/operations/registry.ts`. The tests and the live check pick it up from there.
4. **Run `npm test`.** The fixture test compares your output with Horizon's, field by field. Add fixtures for edge cases such as failed transactions, sponsorship, or 12-character asset codes.

## Pending fixtures

`test/pending/` holds captured transactions the library can't convert correctly yet (for example, payments to muxed `M…` addresses). They are not run by the test suite. To fix one, move its folder into `test/fixtures/` and make the test pass.

## Before you open a PR

```bash
npm run lint && npm run typecheck && npm test
```

- Keep PRs to one operation type, effect type or fix.
- If you change the published package, add a changeset: `npx changeset`.
- Don't edit fixture JSON by hand. Recapture it instead.
- AI-assisted code is fine if you understand it and it's tested by fixtures. Untested or unexplained changes will be closed.

## Drips Wave contributors

Issues in a Drips Wave carry a complexity label. Comment on the issue to be assigned before starting. Unassigned PRs for Wave issues may be closed. The fixture-based acceptance criteria in each issue are what gets reviewed.

## Code of conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md).
