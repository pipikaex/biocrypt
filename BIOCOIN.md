# Zcoin: A DNA-Based Decentralized Cryptocurrency

**Version 2.0.0 — April 2026**

---

## Abstract

Zcoin is a cryptocurrency that models digital value as biological DNA. Wallets are DNA strands. Coins are protein-coding gene sequences mined through SHA-256 proof-of-work. Every coin is signed by the network using **Ed25519 asymmetric cryptography** (encoded as DNA) and carries an **RFLP biological fingerprint** — a separate parentage marker DNA strand with restriction enzyme sites that prove the coin's origin, analogous to a DNA paternity test. Transfers happen via mRNA payloads that move gene sequences between wallets. Double-spend prevention uses nullifier tracking and duplicate serial rejection, operating without a blockchain. The system supports fully offline peer-to-peer transfers, browser-based mining, and self-validating coins that remain provably valid even if the network server goes offline permanently.

---

## 1. Introduction

Traditional cryptocurrencies rely on a shared blockchain to establish consensus. This architecture has costs: energy-intensive global consensus, storage overhead, and the requirement for validators to participate in a monolithic network.

Zcoin models digital value on **molecular biology**:

| Biology | Zcoin |
|---------|-------|
| DNA strand | Wallet |
| Gene | Coin |
| Protein (translated by ribosome) | Public key / coin identity |
| mRNA | Transfer payload |
| Viral mutation | Coin transfer |
| Immune system / antibodies | Double-spend detection (nullifiers) |
| Protein synthesis | Mining |
| Genetic inheritance | Coin lineage |
| Ed25519 keypair | Network reproductive DNA |
| Restriction enzymes + RFLP | Biological parentage verification |
| Mitochondrial DNA | Parentage marker DNA (inherited from network) |

The system uses the **real human codon table** (64 codons → 20 amino acids + 3 STOP signals) for all DNA-to-protein translations.

---

## 2. System Architecture

### 2.1 Components

```
kronixcoin/
├── packages/
│   ├── core/              # Shared TypeScript engine
│   │   ├── dna.ts         # DNA generation, codon table, mutations
│   │   ├── ribosome.ts    # Protein synthesis, chain folding
│   │   ├── wallet.ts      # Wallet creation, ownership proofs
│   │   ├── miner.ts       # Proof-of-work mining, Ed25519 signing
│   │   ├── transfer.ts    # mRNA creation and application
│   │   ├── nullifier.ts   # Double-spend prevention
│   │   ├── stego.ts       # PNG steganography
│   │   ├── ed25519-dna.ts # Ed25519 keypair encoded as DNA
│   │   └── rflp.ts        # Restriction enzyme fingerprinting
│   ├── server/            # NestJS application (Docker)
│   │   ├── wallet/        # Wallet REST API
│   │   ├── mining/        # Mining + signing endpoints
│   │   ├── transfer/      # Transfer validation
│   │   ├── network/       # Network DNA identity + RFLP
│   │   ├── registry/      # Nullifier + serial hash persistence
│   │   └── gateway/       # Payment gateway service
│   ├── frontend/          # React + Vite SPA (zcoin.bio)
│   ├── gateway/           # Payment gateway SDK (embeddable)
│   └── demo/              # Demo marketplace (demo.zcoin.bio)
├── docker-compose.yml
└── BIOCOIN.md             # This document
```

### 2.2 Core Design Principles

1. **Biology-first**: All abstractions map to real molecular biology concepts.
2. **Offline-first**: Core operations (wallet creation, mining, transfers, verification) work without any server.
3. **No blockchain**: Double-spend prevention through nullifier tracking, not a shared ledger.
4. **Defense in depth**: Four independent security layers (PoW, Ed25519, RFLP, nullifiers).
5. **Self-validating coins**: Every coin carries its Ed25519 signature and RFLP fingerprint. Verification requires only the Network Genome (public key), which every wallet embeds at creation.

---

## 3. Cryptographic Foundation

### 3.1 Ed25519 as DNA

The network generates an **Ed25519 keypair** at first boot. Both keys are encoded as 128-base DNA strands (32 bytes × 4 bases per byte):

- **Private Key DNA** (128 bases): The network's secret reproductive DNA. Never leaves the server.
- **Public Key DNA / Network Genome** (128 bases): Embedded into every wallet at creation. Used for offline signature verification.

```
Private Key DNA: TACGGCATTAGC... (128 bases = 32 bytes = 256-bit Ed25519 seed)
Public Key DNA:  GCATTACGGCAT... (128 bases = 32 bytes = Ed25519 public key)
Network ID:      SHA-256(publicKeyDNA).slice(0, 16)
```

### 3.2 Coin Signing

When a mined coin is submitted to the network:

```
signatureData = serialHash + "|" + networkId
signatureDNA  = Ed25519.sign(signatureData, privateKeyDNA)  → 256 bases (64 bytes)
```

The resulting 256-base signature DNA travels with the coin permanently. Any wallet can verify:

```
Ed25519.verify(signatureData, signatureDNA, networkGenome)  → true/false
```

This works **offline** — only the public Network Genome (128 bases) is needed.

---

## 4. RFLP Biological Fingerprinting

### 4.1 Concept

Restriction Fragment Length Polymorphism (RFLP) is a real technique from forensic DNA analysis and paternity testing. Restriction enzymes cut DNA at specific recognition sequences, producing fragments of characteristic lengths.

In Zcoin, RFLP provides a **biological proof of parentage** — a second, independent verification layer alongside Ed25519.

### 4.2 Parentage Marker DNA

When signing a coin, the network generates a **separate parentage marker DNA** strand (~180 bases). This is analogous to mitochondrial DNA inherited from the mother:

1. A hash chain is seeded from `SHA-256(privateKeyDNA + "|rflp-parentage|" + coinSerialHash)`
2. The hash output is converted to DNA bases (T, A, C, G)
3. Restriction enzyme recognition sites are inserted at deterministic positions derived from `SHA-256(privateKeyDNA + "|rflp-pos|" + coinSerialHash + "|" + index)`

The **original coin gene is never modified** — mining proofs and protein serials remain intact. The marker DNA travels alongside the coin as a separate field.

### 4.3 Public Enzyme Panel

Five restriction enzymes form the network's public panel:

| Enzyme | Recognition Site | Cut Offset |
|--------|-----------------|------------|
| EcoRI | GAATTC | 1 |
| BamHI | GGATCC | 1 |
| HindIII | AAGCTT | 1 |
| PstI | CTGCAG | 5 |
| SalI | GTCGAC | 1 |

Everyone knows which enzymes to use. Security comes from the fact that **only the private key holder can generate the correct marker DNA** that produces matching gel bands.

### 4.4 Gel Electrophoresis Verification

To verify a coin's parentage:

1. Take the coin's stored `markerDNA` strand
2. Apply all 5 restriction enzymes — cut at every recognition site
3. Measure the resulting fragment lengths
4. Compare against the stored fingerprint
5. The fragments must match exactly — proving the marker DNA was not tampered with

A forged marker DNA (generated without the private key) will produce random, non-matching gel bands — immediately detectable.

### 4.5 RFLP Fingerprint Structure

```typescript
interface RFLPFingerprint {
  fragments: number[];    // sorted fragment lengths (gel bands)
  enzymesUsed: string[];  // ["EcoRI", "BamHI", "HindIII", "PstI", "SalI"]
  markerCount: number;    // number of restriction sites found
  markerDNA: string;      // the parentage marker DNA strand (~180 bases)
}
```

---

## 5. Wallet Mechanics

### 5.1 Wallet Creation

A wallet consists of:

- **Wallet DNA** (public): A 6,000-base DNA string containing structural genes, embedded ownership proof, and coin genes. Stored as a PNG image via steganography.
- **Private Key DNA** (secret): A 3,000-base DNA strand. Exportable only once at creation. Never sent to the server.
- **Network Genome** (embedded): The 128-base Ed25519 public key of the network, embedded at wallet creation for offline verification.
- **Network ID** (embedded): Identifies which network this wallet belongs to.

### 5.2 Public Key Derivation

The public key is derived by running the **ribosome** on the wallet DNA:

1. Scan for ATG (start codon)
2. Read codons in triplets → amino acids (human codon table)
3. Stop at TAA, TAG, or TGA
4. Inter-genic regions determine protein folding
5. Hash the complete protein chain → **public key hash**

### 5.3 Ownership Proof

To prove ownership:

1. Hybridize the identity region (first 300 bases) with private key DNA
2. Run the ribosome on the hybridized strand
3. Hash the resulting protein
4. This must match the embedded proof in the wallet DNA

### 5.4 PNG Encoding

Wallet DNA is stored in PNG images using nibble-in-channel steganography:
- Each byte → two 4-bit nibbles → stored as `128 + nibble` in Red channel pixels
- Green, Blue channels contain random values in [128, 255]
- 4-byte length prefix enables decoding

---

## 6. Mining Protocol

### 6.1 Coin Structure

A coin is a **gene** — a 180+ base DNA sequence:

```
ATG GGG TGG TGC [60 body codons] [nonce codons] TAA
 ↓   ↓   ↓   ↓
Met Gly Trp Cys  ← Coin header (identifies this protein as a coin)
```

The 180-base body yields ~60 amino acids with **259 bits of protein entropy**, making collision virtually impossible.

### 6.2 Proof of Work

```
SHA-256(coinGene + "|" + nonce) ≤ difficultyTarget
```

- **Dynamic difficulty**: Adjusts every epoch (configurable, default 10 submissions) based on block time target
- **Bitcoin-style targets**: 64-char hex target strings, leading-zero difficulty
- **Nonce encoding**: The nonce is encoded as DNA codons and embedded in the gene

### 6.3 Network Signing (Two-Layer)

A mined coin is signed with **two independent proofs**:

1. **Ed25519 Signature** (mathematical): `Ed25519.sign(serialHash + "|" + networkId, privateKeyDNA)` → 256-base signature DNA
2. **RFLP Fingerprint** (biological): `generateParentageDNA(privateKeyDNA, coinSerialHash)` → ~180-base marker DNA + fragment pattern

Both proofs are attached to the `SignedCoin` object. Both are independently verifiable offline.

### 6.4 Wallet Integration

After signing, the coin gene is spliced into the wallet DNA at a deterministic insertion point. The RFLP data is stored alongside the coin metadata in the wallet's coin registry.

---

## 7. Transfer Protocol

### 7.1 mRNA Creation (Sending)

1. **Prove ownership** (hybridize with private key)
2. **Locate** the coin gene by serial hash
3. **Extract** the gene from wallet DNA
4. **Compute nullifier**: `SHA-256(coinSerialHash + "|nullifier|" + SHA-256(privateKeyDNA))`
5. **Package** mRNA payload:
   - Coin gene + serial hash
   - Ed25519 network signature
   - RFLP fingerprint (parentage marker DNA + fragments)
   - Mining proof (nonce, hash, difficulty)
   - Network Genome + ID
   - Transfer lineage
   - Nullifier commitment

### 7.2 mRNA Validation (Receiving)

The recipient validates all four security layers before accepting:

1. **Structural**: Coin gene produces a valid protein with coin header
2. **Mining proof**: `SHA-256(coinGene + "|" + nonce)` meets difficulty target
3. **Ed25519 signature**: `Ed25519.verify(serialHash + "|" + networkId, signatureDNA, networkGenome)`
4. **RFLP fingerprint**: Re-digest the marker DNA with public enzymes → fragments must match stored pattern
5. **Lineage**: Timestamps are monotonically increasing

### 7.3 Offline Transfers

mRNA payloads are self-contained JSON files (`.mrna` extension). They carry ALL verification data — Ed25519 signature, RFLP fingerprint, mining proof, and Network Genome. A recipient can verify everything offline with zero server contact.

---

## 8. Double-Spend Prevention

### 8.1 Four Defense Layers

| Layer | Mechanism | Online/Offline |
|-------|-----------|----------------|
| 1. Duplicate serial rejection | Network tracks all signed serial hashes | Online |
| 2. Nullifier tracking | `SHA-256(serialHash + "|nullifier|" + SHA-256(privateKey))` marks coins as spent | Online |
| 3. Ed25519 verification | Invalid signatures rejected immediately | Offline |
| 4. RFLP verification | Inconsistent marker DNA rejected | Offline |

### 8.2 Nullifier Properties

- **Deterministic**: Same coin + same owner → always same nullifier
- **Unforgeable**: Requires private key to compute
- **Unique**: Different coins → different nullifiers
- **One-way**: Cannot reverse to reveal private key

### 8.3 Offline Risk Mitigation

- Lineage tracking detects forked spend paths
- Nullifiers are broadcast upon reconnection
- High-value transfers can require online verification

---

## 9. Security Analysis

### 9.1 Defense in Depth

An attacker must break **ALL** of the following simultaneously:

1. **SHA-256 PoW** — Forge a valid mining proof (computationally infeasible)
2. **Ed25519 signature** — Forge a 256-bit signature without the private key (mathematically impossible: ~2^128 operations)
3. **RFLP fingerprint** — Generate correct parentage marker DNA without the private key (requires breaking SHA-256 + knowing the seed)
4. **Nullifier system** — Bypass spent-coin tracking (requires controlling the network)

### 9.2 Attack Prevention

| Attack | Prevention |
|--------|-----------|
| Coin forgery | PoW + Ed25519 signature + RFLP fingerprint |
| Double-spend (online) | Nullifier tracking + duplicate serial rejection |
| Double-spend (offline) | Detected on reconnection; lineage fork identifies cheater |
| Wallet theft | Private key DNA required for all operations; never leaves browser |
| Cross-network injection | Ed25519 signature binds coin to specific network genome |
| RFLP forgery | Marker DNA derived from private key; random DNA produces wrong bands |
| Signature replay | Signature covers serialHash + networkId; unique per coin per network |

### 9.3 Entropy Analysis

- **Coin gene body**: 180 bases → ~60 amino acids → **259 bits** of protein entropy
- **Ed25519 private key**: 128 bases → 32 bytes → **256 bits** of entropy
- **Ed25519 signature**: 256 bases → 64 bytes → **512 bits**
- **RFLP marker DNA**: ~180 bases with 5+ restriction sites → unique fragment pattern
- **Nullifier**: SHA-256 output → **256 bits**

---

## 10. Comparison with Existing Systems

| Feature | Bitcoin | Ethereum | Zcoin |
|---------|---------|----------|-------|
| Ledger | Blockchain | Blockchain | None (nullifiers) |
| Mining | SHA-256 PoW | PoS | SHA-256 PoW |
| Signing | ECDSA | ECDSA | Ed25519 (DNA-encoded) |
| Offline transfer | No | No | Yes (mRNA files) |
| Offline verification | No | No | Yes (Ed25519 + RFLP) |
| Visual proof | None | None | RFLP gel electrophoresis |
| Wallet format | Address string | Address string | DNA strand (PNG image) |
| Coin format | UTXO | ERC-20 token | Gene sequence |
| Server dependency | Always needed | Always needed | Coins valid forever without server |

---

## 11. Technical Reference

### 11.1 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `POST /api/wallet` | POST | Create new wallet |
| `GET /api/wallet/:id` | GET | View wallet |
| `GET /api/wallet/:id/balance` | GET | Get coin count |
| `POST /api/mine` | POST | Server-side mine + sign |
| `POST /api/mine/submit` | POST | Submit browser-mined coin for signing |
| `GET /api/mine/difficulty` | GET | Get current difficulty + target |
| `GET /api/network/stats` | GET | Network statistics |
| `GET /api/network/dna` | GET | Network DNA analysis with RFLP per coin |
| `GET /api/network/rflp` | GET | Network RFLP reference fingerprint |
| `POST /api/transfer` | POST | Create transfer |
| `POST /api/transfer/receive` | POST | Apply mRNA |
| `POST /api/transfer/validate` | POST | Validate mRNA offline |
| `POST /api/gateway/pay` | POST | Payment gateway transaction |
| `WS /gossip` | WebSocket | Nullifier gossip protocol |

### 11.2 Running

```bash
# Development
npm install
npm run build -w @zcoin/core
cd packages/server && npm run start:dev

# Frontend
cd packages/frontend && npm run dev

# Docker
docker compose up --build

# Headless miner
ZCOIN_API=https://zcoin.bio/api node packages/server/headless-miner.js
```

### 11.3 Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 3000 | API server port |
| DATA_DIR | ./data | Persistent data directory |
| NETWORK_FEE_RATE | 0.1 | Fee coin probability per submission |
| DIFFICULTY_TARGET_SECONDS | 60 | Target seconds per block |
| EPOCH_INTERVAL | 10 | Submissions before difficulty adjustment |

---

## 12. Future Directions

1. **Cross-network transfers**: Protocol for converting coins between networks
2. **Smart protein contracts**: Programmable gene sequences that execute logic
3. **Mobile wallet**: Native app with secure key storage
4. **Hardware wallet**: Private key DNA in TPM/Secure Enclave
5. **Enzyme evolution**: Dynamic enzyme panels that evolve with the network
6. **Multi-signature wallets**: Require multiple private keys for spending
7. **Decentralized governance**: DNA voting weighted by coin holdings
8. **WordPress/WooCommerce plugin**: Accept zcoin payments in e-commerce

---

## License

MIT

---

*Zcoin: Where biology meets cryptography. Four layers of defense. Zero blockchain. Infinite validity.*
