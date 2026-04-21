# BioCrypt (ZBIO) — v1

**A decentralized, DNA-biology cryptocurrency.** Coins are protein-coding genes,
wallets are DNA strands, proof-of-work is a 256-base DNA hash, and transfers
move through encrypted mRNA envelopes. There is no blockchain, no central
signer, and no admin wallet.

- **Live tracker:** `wss://tracker.biocrypt.net` (HTTP `https://tracker.biocrypt.net`)
- **Web app:** https://www.biocrypt.net
- **npm org:** https://www.npmjs.com/org/biocrypt
  — [`@biocrypt/core`](https://www.npmjs.com/package/@biocrypt/core),
  [`@biocrypt/tracker`](https://www.npmjs.com/package/@biocrypt/tracker),
  [`@biocrypt/gateway`](https://www.npmjs.com/package/@biocrypt/gateway)
- **Max supply:** 21,000,000 ZBIO · **PoW difficulty (v1 genesis):** 18 leading T's

---

## Table of contents

1. [Quick start](#quick-start)
2. [Architecture](#architecture)
3. [Repo layout](#repo-layout)
4. [Protocol v1 (frozen spec)](#protocol-v1-frozen-spec)
5. [Running a tracker / miner / wallet](#running-your-own)
6. [Development](#development)
7. [Deployment](#deployment)
8. [License](#license)

---

## Quick start

### Mine on the live network (30 seconds)

```bash
# Option A: native miner (fastest)
curl -O https://www.biocrypt.net/downloads/zcoin-miner-v1.c
clang -O3 -o zcoin-miner-v1 zcoin-miner-v1.c
./zcoin-miner-v1 wss://tracker.biocrypt.net

# Option B: node miner
curl -O https://www.biocrypt.net/downloads/biocrypt-mine.mjs
node biocrypt-mine.mjs wss://tracker.biocrypt.net

# Option C: browser — open https://www.biocrypt.net/mine
```

Either miner generates a wallet on first run at `~/.biocrypt/miner-wallet.json`
and broadcasts each signed coin to the tracker mesh.

### Run your own tracker

```bash
npx -y @biocrypt/tracker --port 6690 --peer wss://tracker.biocrypt.net
```

Zero dependencies, one binary. Gossips with any other tracker you `--peer` it to.

---

## Architecture

BioCrypt v1 uses the **genesis-anchor** model. The `networkGenome` is published
as a public protocol fingerprint — nobody ever generated a matching Ed25519
private key, so there is no "network signer". Coins are valid iff:

1. They match the frozen v1 genome fingerprint,
2. Their DNA256 PoW clears `V1_MIN_LEADING_TS = 16`, and
3. They are signed by the miner's own Ed25519 wallet.

Transfers are peer-to-peer mRNA envelopes (X25519 + XSalsa20-Poly1305 via
`nacl.box`). Trackers relay envelopes and maintain nullifier sets to stop
double spends. Any party can run a tracker; trackers gossip mints, spends, and
envelopes over WebSocket.

```
           ┌──────────────┐      ┌──────────────┐
  miner ──▶│   tracker    │◀────▶│   tracker    │◀── miner
           │ (WS gossip)  │      │ (WS gossip)  │
           └──────┬───────┘      └──────┬───────┘
                  │                     │
               wallet / web UI    wallet / web UI
```

There is no ledger height, no chain, no reorgs. A coin is either in a
tracker's mint set or it is not. Trackers are first-seen-wins on nullifiers
and serial hashes, and converge through gossip.

---

## Repo layout

```
packages/
  core/       @biocrypt/core      — DNA engine, ribosome, wallet, CoinV1 signing, mRNA, nullifiers
  tracker/    @biocrypt/tracker   — zero-dep WebSocket relay (mints, spends, envelopes, peers)
  gateway/    @biocrypt/gateway   — embeddable payment-gateway SDK
  server/     @biocrypt/server    — residual NestJS API (wallet helpers, marketplace, gateway, betting)
  frontend/   @biocrypt/frontend  — React + Vite SPA (biocrypt.net) — lives in a separate private repo
  demo/       @biocrypt/demo      — demo marketplace (demo.biocrypt.net)
zcoin-miner-v1.c                  — reference native miner (clang -O3)
```

Only `core`, `tracker`, and `gateway` are published to npm. The server is
application code that runs on `biocrypt.net`.

> **Note on the website.** The React/Vite SPA that powers `www.biocrypt.net`
> lives in a **separate private repository** and is expected to be cloned into
> `packages/frontend/` when you want to develop the UI locally. The protocol,
> tracker, core library, and everything else needed to participate in the
> network are fully in this public repo — you can mine, run a tracker, verify
> coins, and build alternative wallets without the private website source.

---

## Protocol v1 (frozen spec)

This section is the canonical specification. Any implementation that produces
and verifies coins matching it can participate as a miner, tracker, or wallet.

### 1. Genesis constants

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

Reproduce the genome:

```js
const crypto = require("node:crypto");
const BASES = "TACG";
const bytes = crypto
  .createHash("sha256")
  .update("biocrypt-v1-genesis-2026-04-07-decentralized-genome")
  .digest();
let dna = "";
for (const b of bytes) {
  dna += BASES[(b >> 6) & 3] + BASES[(b >> 4) & 3] + BASES[(b >> 2) & 3] + BASES[b & 3];
}
console.log(dna);
// → AGTCATTCTCGCTTTACCCGAGACGGATGCAGAGTGTCGAAGTCGCGATGGGACGGTTCCTAGCCCAGGAAGCACCGGCGCTGTTGGTTAGGCTTCTGGAATGTTCCCTGTCTCACCCCGTGCATCAT
```

### 2. Proof-of-Work (DNA256)

Mining computes a 256-base DNA strand and requires a minimum number of leading
`T` bases.

```
PoW_digest(msg)       = sha256("GEMIX:PoW:v1:" || msg)
PoW_mask32            = first 32 bytes of sha256("gemix/dna256/display-mix/v1")
PoW_strand_bytes      = PoW_digest(msg) XOR PoW_mask32              (32 bytes)
PoW_strand_64         = PoW_strand_bytes || sha256(PoW_digest(msg))  (64 bytes)
PoW_strand_256base    = bytesToDNA(PoW_strand_64)                    (256 bases, alphabet TACG)
leading_Ts(strand)    = count of leading 'T' characters
```

A coin's PoW is valid iff
`leading_Ts(PoW_strand_256base(gene || "|" || nonce)) >= leadingTs`,
with `leadingTs >= V1_MIN_LEADING_TS`.

Reference implementations:
- JavaScript — [`packages/core/src/dna256.ts`](packages/core/src/dna256.ts)
- C (multi-threaded, hardware SHA-256) — [`zcoin-miner-v1.c`](zcoin-miner-v1.c)

### 3. Coin

```ts
interface CoinV1 {
  protocolVersion: 1;
  networkGenomeFingerprint: string;   // 64 hex, must equal GENESIS_GENOME_FINGERPRINT
  coinGene: string;                   // TACG DNA, begins with COIN_GENE_HEADER
  serial: string;                     // ribosome(coinGene) serial
  serialHash: string;                 // sha256(serial) hex
  miningProof: { nonce: number; leadingTs: number };   // leadingTs >= V1_MIN_LEADING_TS
  minerPubKeyDNA: string;             // 128 bases = Ed25519 miner pubkey
  minerSignatureDNA: string;          // 256 bases = Ed25519 signature over signingMessage
  minedAt: number;                    // epoch ms
}
```

**Signing message:**
```
signingMessage = serialHash + "|" + networkGenomeFingerprint + "|" + minerPubKeyDNA
```

**`verifyCoinV1` rules — all must hold:**

1. `protocolVersion === 1`
2. `networkGenomeFingerprint === GENESIS_GENOME_FINGERPRINT`
3. `serial` equals the ribosome-derived serial of `coinGene`
4. `serialHash === sha256(serial)`
5. `miningProof.leadingTs >= V1_MIN_LEADING_TS`
6. `countLeadingTs(powLayerDna256(coinGene, miningProof.nonce)) >= miningProof.leadingTs`
7. `verifyWithDNA(signingMessage, minerSignatureDNA, minerPubKeyDNA) === true`

There is **no** "network signature" on v1 coins.

### 4. Transfers (mRNA envelopes)

```ts
interface MRNAV1 {
  protocolVersion: 1;
  coinSerialHash: string;
  fromPubKeyDNA: string;          // Ed25519 sender
  toPubKeyHash: string;           // recipient wallet ID
  nullifier: string;              // hex, = computeNullifier(coin, fromWallet)
  transferSignatureDNA: string;   // Ed25519 over nullifier + toPubKeyHash
  sentAt: number;
}
```

Envelopes are `DNAEnvelope`s
([`packages/core/src/crypto-dna.ts`](packages/core/src/crypto-dna.ts)). Relays
forward without reading plaintext.

**Double-spend prevention.** `nullifier = computeNullifier(coinSerialHash,
fromPrivateKey)` is deterministic per (coin, sender). Trackers reject a second
envelope with a known nullifier. Conflicts between trackers resolve by
first-seen gossip; everyone else drops duplicates.

### 5. Tracker WebSocket protocol

Single WebSocket endpoint accepting JSON text frames, open to anyone.

**Client → Tracker**

- `hello { role, pubKeyDNA?, label? }` — `role` ∈ `miner|wallet|peer`
- `mint { coin }`
- `spend { envelope, nullifier, coinSerialHash }`
- `fetch-inbox { pubKeyHash }`
- `sync-request { sinceMintSeq?, sinceSpendSeq? }`

**Tracker → Client**

- `welcome { trackerId, genomeFingerprint, leadingTs, peerCount }`
- `mint-ack | mint-reject`
- `spend-ack | spend-reject`
- `envelope` (inbox delivery)
- `sync-delta { mints, spends, cursors }`
- `peer-hello | peer-bye`
- `broadcast-mint | broadcast-spend` (live feed)

Conformance to this section is all it takes to serve as a v1 tracker.

### 6. Wallet

Wallets are derived deterministically from a 32-byte seed:

```
seed                = 32 random bytes (or user-supplied)
signingKeyPair      = nacl.sign.keyPair.fromSeed(seed)
encryptionSeed      = sha256(seed || networkId)
encryptionKeyPair   = nacl.box.keyPair.fromSecretKey(encryptionSeed)
walletId (pubKeyHash) = sha256(bytesToDNA(signingPublicKey)).slice(0, 32)
```

Wallet creation is purely offline. No server consent required.
Reference: [`packages/core/src/wallet.ts`](packages/core/src/wallet.ts).

### 7. Compatibility

- No pre-v1 coin is valid. Fresh state was published at `GENESIS_TIMESTAMP_MS`.
- Legacy network-signed coins may be parsed by vestigial v0 verifiers in the
  codebase but MUST NOT be accepted by v1 trackers or wallets.
- `protocolVersion` is encoded in every coin; trackers reject `!== 1`.

---

## Running your own

### Tracker

```bash
npx -y @biocrypt/tracker --port 6690 --peer wss://tracker.biocrypt.net
```

State is kept in `./tracker-data/tracker.json` by default. Delete that file to
wipe state and rejoin from peers.

### Native miner (C)

```bash
curl -O https://www.biocrypt.net/downloads/zcoin-miner-v1.c
clang -O3 -o zcoin-miner-v1 zcoin-miner-v1.c
./zcoin-miner-v1 wss://tracker.biocrypt.net
```

Uses hardware-accelerated SHA-256 (SHA-NI on x86_64, armv8 crypto ext on
arm64) and all available cores.

### Node miner

```bash
curl -O https://www.biocrypt.net/downloads/biocrypt-mine.mjs
node biocrypt-mine.mjs wss://tracker.biocrypt.net
```

### Wallet (JS)

```js
import { createWallet } from "@biocrypt/core";
const wallet = createWallet();
// wallet.publicKeyHash, wallet.privateKeyDNA, wallet.networkId, ...
```

---

## Development

### Prerequisites

- Node.js 20+
- npm 10+
- `clang` (only if you want to build the native miner)

### Bootstrap

```bash
npm install
npm run build -w @biocrypt/core
```

### Run locally

```bash
# Tracker
npm --prefix packages/tracker start -- --port 6690

# NestJS API (wallet helpers, marketplace, gateway, betting)
npm --prefix packages/server run start:dev

# Frontend (Vite, proxies /api → :3000 and /ws → :6690)
npm --prefix packages/frontend run dev
```

Open `http://localhost:5173`.

### Tests

```bash
npm test -w @biocrypt/core
```

---

## Deployment

The public network runs on `devpipika` behind `stage.pipika.pro` (Apache
reverse proxy). Frontend is served at `www.biocrypt.net`, the tracker at
`tracker.biocrypt.net`.

Deploy flow:

1. `rsync` the built repo to `devpipika:~/zcoin-bio/`
2. `npm install --omit=dev` on the server
3. `pm2 restart zcoin-bio zcoin-bio-tracker`

The tracker's persistent state lives at `~/zcoin-bio/tracker-data/tracker.json`
on the server. The v1 genesis wipe simply deletes that file and restarts pm2.

---

## License

MIT — see [`LICENSE`](LICENSE).
