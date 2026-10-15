/**
 * Creates testnet transactions that are hard to find in the wild, then captures them as
 * fixtures: multi-hop path payments (strict send and strict receive), a failed path
 * payment, and a payment to a muxed (M...) address.
 *
 *   npx tsx scripts/scenarios/path-payments.ts
 *
 * Testnet only. Accounts are funded by friendbot; nothing here has real value.
 */
import { Asset, Keypair, MuxedAccount, Networks, Operation, rpc, TransactionBuilder } from "@stellar/stellar-sdk";
import { captureFixture } from "../capture-fixture.ts";
import { NETWORKS } from "../networks.ts";

const server = new rpc.Server(NETWORKS.testnet.rpc);

async function fund(kp: Keypair) {
  const res = await fetch(`https://friendbot.stellar.org/?addr=${kp.publicKey()}`);
  if (!res.ok) throw new Error(`friendbot failed for ${kp.publicKey()}: ${res.status}`);
}

async function submit(source: Keypair, ops: ReturnType<typeof Operation.payment>[], signers: Keypair[] = [], expectFailure = false) {
  const account = await server.getAccount(source.publicKey());
  const builder = new TransactionBuilder(account, { fee: "1000", networkPassphrase: Networks.TESTNET }).setTimeout(60);
  for (const op of ops) builder.addOperation(op);
  const tx = builder.build();
  tx.sign(source, ...signers);
  const sent = await server.sendTransaction(tx);
  if (sent.status === "ERROR") {
    if (expectFailure) return sent.hash;
    throw new Error(`send failed: ${JSON.stringify(sent.errorResult)}`);
  }
  const done = await server.pollTransaction(sent.hash, { attempts: 30 });
  if (done.status !== "SUCCESS" && !expectFailure) throw new Error(`tx ${sent.hash} ended as ${done.status}`);
  return sent.hash;
}

const [issuer, maker, alice, bob] = [Keypair.random(), Keypair.random(), Keypair.random(), Keypair.random()];
const A = new Asset("HLA", issuer.publicKey());
const B = new Asset("HLBRIDGE", issuer.publicKey()); // 12-char code
const C = new Asset("HLC", issuer.publicKey());

console.log("funding accounts…");
for (const kp of [issuer, maker, alice, bob]) await fund(kp);

console.log("setting up trustlines, balances and offers…");
await submit(
  maker,
  [
    Operation.changeTrust({ asset: A }),
    Operation.changeTrust({ asset: B }),
    Operation.changeTrust({ asset: C }),
    Operation.changeTrust({ asset: C, source: bob.publicKey() }),
    Operation.payment({ source: issuer.publicKey(), destination: maker.publicKey(), asset: A, amount: "1000" }),
    Operation.payment({ source: issuer.publicKey(), destination: maker.publicKey(), asset: B, amount: "1000" }),
    Operation.payment({ source: issuer.publicKey(), destination: maker.publicKey(), asset: C, amount: "1000" }),
    // Order book: XLM -> A -> B -> C
    Operation.manageSellOffer({ selling: A, buying: Asset.native(), amount: "500", price: "1" }),
    Operation.manageSellOffer({ selling: B, buying: A, amount: "500", price: "1" }),
    Operation.manageSellOffer({ selling: C, buying: B, amount: "500", price: "1" }),
  ],
  [issuer, bob],
);

const captured: [string, string][] = [];

console.log("strict send through two hops…");
captured.push([
  await submit(alice, [
    Operation.pathPaymentStrictSend({
      sendAsset: Asset.native(),
      sendAmount: "10",
      destination: bob.publicKey(),
      destAsset: C,
      destMin: "9",
      path: [A, B],
    }),
  ]),
  "path_payment_strict_send with 2-hop path (credit_alphanum12 in path)",
]);

console.log("strict receive through two hops…");
captured.push([
  await submit(alice, [
    Operation.pathPaymentStrictReceive({
      sendAsset: Asset.native(),
      sendMax: "20",
      destination: bob.publicKey(),
      destAsset: C,
      destAmount: "5",
      path: [A, B],
    }),
  ]),
  "path_payment_strict_receive with 2-hop path",
]);

console.log("failed strict send (destMin too high)…");
captured.push([
  await submit(
    alice,
    [
      Operation.pathPaymentStrictSend({
        sendAsset: Asset.native(),
        sendAmount: "1",
        destination: bob.publicKey(),
        destAsset: C,
        destMin: "1000",
        path: [A, B],
      }),
    ],
    [],
    true,
  ),
  "failed path_payment_strict_send (under destination minimum)",
]);

console.log("payment to a muxed address…");
const muxedBob = new MuxedAccount(await server.getAccount(bob.publicKey()), "1234567890123").accountId();
const muxedHash = await submit(alice, [Operation.payment({ destination: muxedBob, asset: Asset.native(), amount: "1.5" })]);

console.log("capturing fixtures…");
for (const [hash, label] of captured) console.log(await captureFixture("testnet", hash, label));
// Muxed fields are not supported yet: park the fixture outside the tested set (see CONTRIBUTING).
console.log(await captureFixture("testnet", muxedHash, "payment to muxed account", "test/pending"));
