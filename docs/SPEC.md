# horizonless — v0.1 spec (draft)

> Horizon-style payments, operations and effects, rebuilt from Stellar RPC data. TypeScript, no server.

Status: draft for approval · 2026-10-15

## 1. Problem

- Horizon "is nearing end-of-life" and "won't receive new feature development"; apps are told to move to Stellar RPC ([data APIs](https://developers.stellar.org/docs/data/apis)).
- RPC has no payments or effects endpoints. The official migration guide lists them as "No direct RPC equivalent; use getEvents or parse getTransactions" ([migration guide](https://developers.stellar.org/docs/data/apis/migrate-from-horizon-to-rpc)).
- Classic-asset events only show up in RPC when the operator runs Core with `EMIT_CLASSIC_EVENTS=true`, so you can't rely on them with every provider.
- There's a docs request for "Horizon-like abstractions via RPC's data" ([stellar/stellar-docs#1759](https://github.com/stellar/stellar-docs/issues/1759)). SDF's [token-transfer processor](https://github.com/stellar/go-stellar-sdk/tree/main/processors/token_transfer) only exists in Go.
- Every wallet, exchange and payment app moving off Horizon writes this parsing code itself. `horizonless` provides it once, tested against Horizon's own output.

## 2. Approach

**Build records from the transaction itself, not from events.** Payment records come from the transaction envelope (operation bodies) plus the result (for example, the actual amounts sent in path payments). This is how Horizon builds them. It works on any RPC, whether or not classic events are switched on. Unified events (`transfer`/`mint`/`burn`), when present, are used only for cross-checking.

Verified 2026-10-15 on SDF's public testnet RPC (`@stellar/stellar-sdk@17.2.1`): `getTransaction` returns `TransactionMetaV4` with per-operation ledger changes, and classic payments include `transfer`/`burn` events.

**Port proven code rather than invent it.** The code is ported from:
- [`stellar-horizon/internal/ingest/processors/operations_processor.go`](https://github.com/stellar/stellar-horizon) (operation details)
- `effects_processor.go` (effects, from v0.2)
- `go-stellar-sdk/processors/token_transfer` (event cross-check)

**Record IDs match Horizon.** `id`/`paging_token` = TOID `(ledger << 32) | (txApplicationOrder << 12) | opIndex`, built from RPC's `ledger` and `applicationOrder`. Existing cursors and database keys therefore stay valid after migrating.

## 3. Public API (v0.1)

```ts
import { toPayments, toOperations, streamPayments } from "horizonless";

// Pure: one RPC transaction → Horizon-shaped records (no network).
toPayments(tx: RpcTransaction, opts?: { includeFailed?: boolean }): PaymentRecord[];
toOperations(tx: RpcTransaction): OperationRecord[];

// Thin helper: walk getTransactions and yield records, filterable by account.
streamPayments(server: rpc.Server, opts: { startLedger: number; account?: string }): AsyncIterable<PaymentRecord>;
```

- `RpcTransaction` is the object from `rpc.Server.getTransaction` or `getTransactions` in `@stellar/stellar-sdk` ≥ 17, or the raw JSON-RPC result.
- Output types are copied from Horizon's response shape, minus `_links`. The only runtime dependency is `@stellar/stellar-sdk`, as a peer dependency. Ships ESM and CJS.

## 4. v0.1 scope

**In:** Horizon `/payments` records for:

| Operation | Horizon fields to match |
|---|---|
| `create_account` | `account`, `funder`, `starting_balance` |
| `payment` (XLM and issued assets) | `from`, `to`, `amount`, `asset_*` |
| `path_payment_strict_send` | adds `source_amount`, `destination_min`, `path[]`, `source_asset_*` |
| `path_payment_strict_receive` | adds `source_max`, `source_amount` (from result) |
| `account_merge` | `account`, `into` |

Every record also gets the shared fields: `id`, `paging_token`, `transaction_hash`, `transaction_successful`, `source_account`, `created_at`, `type`, `type_i`.

**Done when:** for every fixture, `toPayments(rpcTx)` deep-equals Horizon's `/transactions/{hash}/payments` records without `_links`.

**Out (backlog, see §6):**
- effects
- trades
- `invoke_host_function` / Stellar Asset Contract (SAC) transfers
- muxed-account fields
- pagination and cursor resume
- any HTTP server

## 5. Test oracle

Horizon is still running, which makes it a free source of correct answers for testing.

- Each **fixture** is a pair for one transaction hash: the RPC `getTransaction` JSON and Horizon's `/payments` and `/operations` JSON for the same transaction. Fixtures are committed under `test/fixtures/<network>/<hash>/`.
- `scripts/capture-fixture.ts <hash>` captures a fixture. RPC only keeps about 7 days of history and testnet gets reset, so fixtures have to be captured while the data is fresh.
- CI runs **offline** against the fixtures (vitest). A nightly job runs a short live check against testnet, captures recent transactions and reports differences. That surfaces new real-world cases, which become new issues.

## 6. Contributor issue backlog (for Wave)

| Tier | Issues |
|---|---|
| Trivial | Add fixtures for: payment with `credit_alphanum12`; failed payment; fee-bump-wrapped payment · Doc examples: exchange deposit watcher; wallet history page |
| Medium | Muxed fields (`from_muxed`, `from_muxed_id`, …) · `toOperations` for `manage_sell_offer` / `manage_buy_offer` / `create_passive_sell_offer` · `change_trust`, `allow_trust`, `set_trust_line_flags` · `set_options` · claimable balances (create/claim/clawback) · sponsorship ops · `streamPayments` cursor resume |
| Hard | Effects v0.2: `account_credited`/`account_debited` from ledger changes · trade effects from offer/liquidity-pool claim atoms · `invoke_host_function` `asset_balance_changes` from SAC events · events cross-check with a mismatch report · liquidity-pool deposit/withdraw |

About 18 issues to start, each scoped to one operation or effect type with a fixture as its acceptance test. A `good first issue` path is "add a fixture and make it pass".

## 7. Repo hygiene

- Apache-2.0 license (matches the Stellar SDKs).
- README with a 30-second example and a "migrating from Horizon" table.
- `CONTRIBUTING.md` including "How to add an operation type in 4 steps".
- Issue and PR templates, `CODE_OF_CONDUCT.md`, `SECURITY.md`.
- CI: lint, typecheck, test, build. Changesets for releases, with npm provenance publishing.

## 8. Risks

| Risk | Mitigation |
|---|---|
| SDF ships something similar in js-stellar-sdk | None open as of 2026-10-15 (issues and PRs checked). Stay small and SDK-compatible, so this library could be upstreamed. |
| Horizon shuts down before fixtures are complete | Capture a broad fixture set early. Fixtures are permanent once committed. |
| SDK 17 changed XDR objects to plain snake_case objects | Use a single adapter module that normalises RPC JSON and SDK objects. |

## 9. Timeline

- **Week 1:** scaffold, CI, fixture capture, `payment`/`create_account`.
- **Week 2:** path payments, `account_merge`, `streamPayments`, v0.1.0 on npm.
- **Weeks 3–4:** open the backlog issues, steady commits, apply to the next Stellar Wave.
