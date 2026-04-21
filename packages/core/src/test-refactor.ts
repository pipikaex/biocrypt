/**
 * Refactor smoke tests — DNA256 PoW, X25519 DNA envelopes, DNA ledger,
 * seed-derived wallets, and offline transfer payloads.
 *
 * Run:  npm run build && node dist/test-refactor.js
 */

import {
  // DNA256
  dnaLayerDigestHex, powLayerDigestHex, digestHexToDna256, dna256ToDigestHex,
  powLayerDna256, countLeadingTs, verifyDna256MiningProof,
  // Crypto-DNA
  generateEncryptionKeyPair, encryptionKeyPairFromSeed,
  encryptToDNA, decryptFromDNA,
  // DNA Ledger
  encodeLedgerEntry, appendLedgerEntry, ledgerContainsCoin,
  removeLedgerEntry, nextRotation,
  // Wallet
  createWallet, mintWalletFromSeed, mintWalletFromNetworkSeed,
  integrateCoinReceipt, walletLedgerContains, removeCoinReceipt,
  viewWallet,
  // Misc
  sha256,
} from "./index";

let passed = 0;
let failed = 0;

function assert(cond: boolean, msg: string) {
  if (cond) {
    console.log(`  [pass] ${msg}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${msg}`);
    failed++;
  }
}

function eq<T>(a: T, b: T, msg: string) {
  assert(a === b, `${msg} (got ${String(a)}, expected ${String(b)})`);
}

function section(title: string) {
  console.log(`\n=== ${title} ===`);
}

// ---------- DNA256 ----------
section("DNA256 codec");
{
  const msg = "hello-biocrypt";
  const hex = dnaLayerDigestHex(msg);
  eq(hex.length, 64, "dnaLayerDigestHex returns 64 hex chars");

  const dna = digestHexToDna256(hex);
  eq(dna.length, 256, "digestHexToDna256 returns 256-base strand");
  assert(/^[TACG]+$/.test(dna), "strand contains only TACG bases");

  const back = dna256ToDigestHex(dna);
  eq(back, hex, "round-trip DNA256 → hex matches original");

  const pow = powLayerDigestHex(msg);
  assert(pow !== hex, "powLayer differs from dnaLayer (different domains)");
}

section("DNA256 PoW");
{
  const coinGene = "ATGGGG" + "TACG".repeat(40) + "TAA";
  // Mine until we get at least 2 leading T's (small target, fast)
  let nonce = 0;
  const maxIter = 200_000;
  for (; nonce < maxIter; nonce++) {
    const strand = powLayerDna256(coinGene, nonce);
    if (countLeadingTs(strand) >= 2) break;
  }
  assert(nonce < maxIter, `found nonce ${nonce} producing ≥2 leading T`);
  assert(verifyDna256MiningProof(coinGene, nonce, 2), "verifyDna256MiningProof accepts valid nonce");
  assert(!verifyDna256MiningProof(coinGene, nonce, 30), "verifyDna256MiningProof rejects impossibly high target");
  assert(!verifyDna256MiningProof(coinGene, nonce + 1, 2), "verifyDna256MiningProof rejects wrong nonce (with high probability)");
}

// ---------- crypto-dna X25519 envelopes ----------
section("X25519 DNA envelopes");
{
  const kpA = generateEncryptionKeyPair();
  const kpB = generateEncryptionKeyPair();
  assert(/^[TACG]+$/.test(kpA.publicKeyDNA), "pubkey is TACG-encoded DNA");
  assert(kpA.publicKeyDNA !== kpB.publicKeyDNA, "independent keypairs differ");

  const plaintext = "Hello from Alice to Bob — encrypted mRNA payload.";
  const env = encryptToDNA(plaintext, kpB.publicKeyDNA);
  assert(/^[TACG]+$/.test(env.body), "ciphertext (body) is TACG-encoded DNA");
  assert(env.body !== plaintext, "ciphertext visibly differs from plaintext");

  const decrypted = decryptFromDNA(env, kpB.privateKeyDNA);
  eq(decrypted, plaintext, "Bob can decrypt envelope addressed to him");

  let rejected = false;
  try { decryptFromDNA(env, kpA.privateKeyDNA); }
  catch { rejected = true; }
  assert(rejected, "Alice (wrong key) cannot decrypt Bob's envelope");

  // Deterministic from seed
  const seed = new Uint8Array(32);
  for (let i = 0; i < 32; i++) seed[i] = i * 7 + 3;
  const ka1 = encryptionKeyPairFromSeed(seed);
  const ka2 = encryptionKeyPairFromSeed(seed);
  eq(ka1.publicKeyDNA, ka2.publicKeyDNA, "seed → deterministic encryption keypair");
}

// ---------- DNA ledger ----------
section("Rotating DNA ledger");
{
  const walletIdentity = "TACG".repeat(64);
  const walletDNA = "ATG" + "CCCC".repeat(200) + "TAA";
  const serialA = sha256("coin-A");
  const serialB = sha256("coin-B");

  assert(!ledgerContainsCoin(walletDNA, walletIdentity, serialA), "empty ledger contains no coin");

  const dna1 = appendLedgerEntry(walletDNA, walletIdentity, serialA, 0);
  assert(dna1.length > walletDNA.length, "ledger append grows wallet DNA");
  assert(ledgerContainsCoin(dna1, walletIdentity, serialA), "ledger recognizes coin A after append");
  assert(!ledgerContainsCoin(dna1, walletIdentity, serialB), "ledger does NOT recognize unseen coin B");

  const dna2 = appendLedgerEntry(dna1, walletIdentity, serialB, 1);
  assert(ledgerContainsCoin(dna2, walletIdentity, serialA), "coin A still present after appending B");
  assert(ledgerContainsCoin(dna2, walletIdentity, serialB), "coin B present after append");
  eq(nextRotation(dna2), 2, "nextRotation advances with entries");

  const dna3 = removeLedgerEntry(dna2, walletIdentity, serialA);
  assert(!ledgerContainsCoin(dna3, walletIdentity, serialA), "coin A removed from ledger after removeLedgerEntry");
  assert(ledgerContainsCoin(dna3, walletIdentity, serialB), "coin B still present after removing A");

  // Verify entry encoding properties
  const entry = encodeLedgerEntry(walletIdentity, serialA, 3);
  eq(entry.fullDNA.length, 64, "ledger entry encodes to 64 DNA bases");
  eq(entry.rotation, 3, "ledger entry records rotation");
}

// ---------- Seed-derived wallet + ledger integration ----------
section("Seed-derived wallet + coin receipt integration");
{
  const seed = new Uint8Array(32);
  for (let i = 0; i < 32; i++) seed[i] = i;
  const netGenome = "TACG".repeat(128);
  const netId = "biocrypt-unit";

  const w1 = mintWalletFromSeed(seed, { dnaLength: 6000, networkGenome: netGenome, networkId: netId });
  const w2 = mintWalletFromSeed(seed, { dnaLength: 6000, networkGenome: netGenome, networkId: netId });
  eq(w1.publicKeyHash, w2.publicKeyHash, "same seed → same wallet publicKeyHash");
  eq(w1.encryptionPublicKeyDNA, w2.encryptionPublicKeyDNA, "same seed → same encryption pubkey");
  eq(w1.dna, w2.dna, "same seed → identical wallet DNA");

  const w3 = mintWalletFromNetworkSeed(netGenome, netId, "my-user-entropy-12345");
  const w4 = mintWalletFromNetworkSeed(netGenome, netId, "my-user-entropy-12345");
  eq(w3.publicKeyHash, w4.publicKeyHash, "network-seed method is deterministic");
  assert(w3.publicKeyHash !== w1.publicKeyHash, "network-seed differs from raw-seed wallet");

  // Integrate a coin receipt (operates on DNA string)
  const serial = sha256("coin-xyz");
  const newDNA = integrateCoinReceipt(w1.dna, serial);
  assert(newDNA.length > w1.dna.length, "receipt integration grows wallet DNA");
  assert(walletLedgerContains(newDNA, serial), "wallet DNA recognizes integrated coin");

  // Original DNA still immutable
  assert(!walletLedgerContains(w1.dna, serial), "original DNA does not contain the coin (immutable)");

  // Remove receipt
  const afterSpend = removeCoinReceipt(newDNA, serial);
  assert(!walletLedgerContains(afterSpend, serial), "coin receipt removed on spend");
}

// ---------- Regular (non-seeded) wallet still works ----------
section("Legacy wallet compatibility");
{
  const w = createWallet(4000);
  const view = viewWallet(w.dna);
  eq(view.coinCount, 0, "fresh wallet has 0 coins");
  assert(typeof w.privateKeyDNA === "string" && w.privateKeyDNA.length > 0, "createWallet returns a private key");
}

console.log("\n=== Summary ===");
console.log(`  passed: ${passed}`);
console.log(`  failed: ${failed}`);
if (failed > 0) {
  process.exit(1);
}
