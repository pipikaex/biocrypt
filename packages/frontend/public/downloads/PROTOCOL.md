# BioCrypt Protocol — v1 (frozen)

This document is the canonical, frozen specification for the BioCrypt v1
network. Any implementation that produces and verifies coins matching this
document can participate as a miner, tracker, or wallet.

No single party controls the network. The `networkGenome` is a published
identifier — nobody holds a matching Ed25519 private key, because one was
never generated.

---

## 1. Genesis constants

| Name | Value |
|---|---|
| `PROTOCOL_VERSION` | `1` |
| `GENESIS_SEED_MATERIAL` | `biocrypt-v1-genesis-2026-04-07-decentralized-genome` |
| `GENESIS_NETWORK_GENOME` | `AGTCATTCTCGCTTTACCCGAGACGGATGCAGAGTGTCGAAGTCGCGATGGGACGGTTCCTAGCCCAGGAAGCACCGGCGCTGTTGGTTAGGCTTCTGGAATGTTCCCTGTCTCACCCCGTGCATCAT` |
| `GENESIS_GENOME_FINGERPRINT` | `0eafe2a278696a5b4187dfff4deb5d1ca91e1366e7923c56514dab00e7619db7` |
| `GENESIS_NETWORK_ID` | `biocrypt-0eafe2a27869` |
| `GENESIS_LEADING_TS` | `16` |
| `V1_MIN_LEADING_TS` | `16` (protocol floor) |
| `GENESIS_TIMESTAMP_MS` | `2026-04-07T00:00:00Z` |

### Reproducing the genome

```js
const crypto = require("node:crypto");
const BASES = "TACG";
function bytesToDNA(bytes) {
  let dna = "";
  for (const b of bytes) {
    dna += BASES[(b >> 6) & 3];
    dna += BASES[(b >> 4) & 3];
    dna += BASES[(b >> 2) & 3];
    dna += BASES[b & 3];
  }
  return dna;
}
const bytes = crypto
  .createHash("sha256")
  .update("biocrypt-v1-genesis-2026-04-07-decentralized-genome")
  .digest();
console.log(bytesToDNA(bytes));
// → AGTCATTCTCGCTTTACCCGAGACGGATGCAGAGTGTCGAAGTCGCGATGGGACGGTTCCTAGCCCAGGAAGCACCGGCGCTGTTGGTTAGGCTTCTGGAATGTTCCCTGTCTCACCCCGTGCATCAT
```

---

## 2. Proof-of-Work (DNA256)

Mining computes a 256-base DNA strand and requires a minimum number of
leading `T` bases.

```
PoW_digest(msg)       = sha256("GEMIX:PoW:v1:" || msg)
PoW_mask32            = first 32 bytes of sha256("gemix/dna256/display-mix/v1")
PoW_strand_bytes      = PoW_digest(msg) XOR PoW_mask32   (32 bytes)
PoW_strand_64         = PoW_strand_bytes || sha256(PoW_digest(msg))
PoW_strand_256base    = bytesToDNA(PoW_strand_64)        (256 bases, alphabet TACG)
leading_Ts(strand)    = count of leading 'T' characters in strand
```

A coin's PoW is valid iff `leading_Ts(PoW_strand_256base(gene || "|" || nonce)) >= leadingTs`,
where `leadingTs >= V1_MIN_LEADING_TS`.

This matches the reference implementation in
[`packages/core/src/dna256.ts`](packages/core/src/dna256.ts) and the C miner
in [`zcoin-miner.c`](zcoin-miner.c).

---

## 3. Coin

A **v1 coin** is a JSON object with the following fields:

```ts
interface CoinV1 {
  protocolVersion: 1;
  networkGenomeFingerprint: string;   // 64 hex chars, must equal GENESIS_GENOME_FINGERPRINT
  coinGene: string;                   // TACG DNA, begins with COIN_GENE_HEADER
  serial: string;                     // amino-acid serial from ribosome(coinGene)
  serialHash: string;                 // sha256(serial) hex
  miningProof: {
    nonce: number;
    leadingTs: number;                // >= V1_MIN_LEADING_TS
  };
  minerPubKeyDNA: string;             // 128 bases = Ed25519 pubkey of the miner's wallet
  minerSignatureDNA: string;          // 256 bases = Ed25519 signature over signingMessage
  minedAt: number;                    // epoch ms
}
```

### Signing message

```
signingMessage = serialHash + "|" + networkGenomeFingerprint + "|" + minerPubKeyDNA
```

The miner signs `signingMessage` with their Ed25519 private key. The resulting
256-base DNA signature is `minerSignatureDNA`.

### Validation rules (`verifyCoinV1`)

A coin is valid iff **all** of the following hold:

1. `protocolVersion === 1`.
2. `networkGenomeFingerprint === GENESIS_GENOME_FINGERPRINT`.
3. `serial` equals the ribosome-derived serial of `coinGene` (first protein's
   amino acids from index 4 onward, joined with `-`).
4. `serialHash === sha256(serial)`.
5. `miningProof.leadingTs >= V1_MIN_LEADING_TS`.
6. `countLeadingTs(powLayerDna256(coinGene, miningProof.nonce)) >= miningProof.leadingTs`.
7. `verifyWithDNA(signingMessage, minerSignatureDNA, minerPubKeyDNA) === true`.

No other signature (no "network signature") exists on v1 coins.

---

## 4. Transfers (mRNA envelopes)

A transfer is an encrypted envelope (X25519 + XSalsa20-Poly1305, via
`nacl.box`) containing a plaintext mRNA payload:

```ts
interface MRNAV1 {
  protocolVersion: 1;
  coinSerialHash: string;
  fromPubKeyDNA: string;   // Ed25519 sender
  toPubKeyHash: string;    // recipient wallet ID
  nullifier: string;       // hex, = computeNullifier(coin, fromWallet)
  transferSignatureDNA: string;  // Ed25519 over nullifier + toPubKeyHash
  sentAt: number;
}
```

The envelope itself is a `DNAEnvelope` as implemented in
[`packages/core/src/crypto-dna.ts`](packages/core/src/crypto-dna.ts). Any
relay can forward envelopes without seeing plaintext.

### Double-spend prevention

`nullifier` is a deterministic function of `(coinSerialHash,
fromPrivateKey)` — see `computeNullifier` in
[`packages/core/src/nullifier.ts`](packages/core/src/nullifier.ts). Any
tracker seeing a second envelope with a nullifier already in its set rejects
it. Trackers gossip their nullifier sets to peers.

First-seen-wins within each tracker. Conflicts between trackers are merged
by `nullifier.hex` equality — the tracker that first gossiped a given
nullifier wins globally, everyone else drops duplicates.

---

## 5. Tracker WebSocket protocol

A tracker exposes a single WebSocket endpoint that accepts JSON text frames.
All messages are objects with a `type` field. The tracker MUST accept
connections from anyone.

### Client → Tracker

- `hello { role, pubKeyDNA?, label? }` — identify yourself (`role` is
  `miner`, `wallet`, or `peer`).
- `mint { coin }` — submit a signed v1 coin. Tracker verifies via
  `verifyCoinV1` and records on success.
- `spend { envelope, nullifier, coinSerialHash }` — submit a transfer
  envelope. Tracker verifies MRNA and records nullifier.
- `fetch-inbox { pubKeyHash }` — ask for all envelopes addressed to a
  recipient.
- `sync-request { sinceMintSeq?, sinceSpendSeq? }` — request deltas (used by
  peer trackers).

### Tracker → Client

- `welcome { trackerId, genomeFingerprint, leadingTs, peerCount }`
- `mint-ack { serialHash, mintSeq }` / `mint-reject { serialHash, reason }`
- `spend-ack { nullifier, spendSeq }` / `spend-reject { nullifier, reason }`
- `envelope { ... }` (inbox delivery)
- `sync-delta { mints: [...], spends: [...], cursors: { mint, spend } }`
- `peer-hello { trackerId }`, `peer-bye { trackerId }`
- `broadcast-mint { coin, mintSeq }` / `broadcast-spend { nullifier, spendSeq }`
  (live feed to wallets/trackers/UI).

Any implementation conforming to this section can serve as a v1 tracker.

---

## 6. Wallet

A wallet is derived deterministically from a 32-byte seed:

```
seed                      = 32 random bytes (or user-supplied)
signingKeyPair            = nacl.sign.keyPair.fromSeed(seed)
encryptionSeed            = sha256(seed || networkId)
encryptionKeyPair         = nacl.box.keyPair.fromSecretKey(encryptionSeed)
walletId (pubKeyHash)     = sha256(bytesToDNA(signingPublicKey)).slice(0, 32)
```

Anyone can create a wallet offline. No server consent is required.

See [`packages/core/src/wallet.ts`](packages/core/src/wallet.ts) for the
reference implementation.

---

## 7. Compatibility

- No pre-v1 coin is valid on this network. A fresh state was published at
  `GENESIS_TIMESTAMP_MS`.
- Legacy network-signed coins may be read by v0 verifiers that still exist
  in the codebase but MUST NOT be accepted as valid by v1 trackers or
  wallets.
- The protocol version is encoded in every coin. Trackers reject
  `protocolVersion !== 1`.

---

## 8. How to participate

- **Run a miner**: clone, `clang -O3 -o zcoin-miner zcoin-miner.c`,
  `./zcoin-miner wss://tracker.biocrypt.net`. First run generates a miner
  wallet at `~/.biocrypt/miner-wallet.json`.
- **Run a tracker**: `npx @biocrypt/tracker --port 6690 --peer
  wss://tracker.biocrypt.net`.
- **Create a wallet**: in the web UI, or programmatically via
  `createWallet()` from `@biocrypt/core`.

Everything else is consensus-by-implementation: follow this document and
your bytes will be accepted.
