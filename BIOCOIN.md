# Kronixcoin: A DNA-Based Decentralized Cryptocurrency

**Version 0.1.0 — April 2026**

---

## Abstract

Kronixcoin is a novel cryptocurrency that models digital value as biological DNA. Wallets are DNA strands encoded as PNG images. Coins are proteins mined through proof-of-work and integrated into wallet DNA as genes. Transfers happen via mRNA "virus" mutations that remove a gene from one wallet and allow its integration into another. Double-spend prevention uses a gossip-based nullifier network inspired by the biological immune system, operating without a blockchain. The system supports fully offline peer-to-peer transfers, browser-based mining, network-signed coin types, and application integrations such as decentralized betting.

---

## 1. Introduction

Traditional cryptocurrencies (Bitcoin, Ethereum) rely on a shared blockchain — a linear chain of blocks — to establish consensus and prevent double-spending. This architecture, while proven, has significant costs: energy-intensive global consensus, storage overhead of the full chain, and the requirement for miners/validators to participate in a monolithic network.

Kronixcoin takes a fundamentally different approach by modeling digital value on **molecular biology**:

| Biology | Kronixcoin |
|---------|-----------|
| DNA strand | Wallet |
| Gene | Coin |
| Protein (translated by ribosome) | Public key / coin identity |
| mRNA | Transfer payload |
| Viral mutation | Coin transfer |
| Immune system / antibodies | Double-spend detection (nullifiers) |
| Protein synthesis | Mining |
| Genetic inheritance | Coin lineage |

This is not merely metaphorical — the system uses the **real human codon table** (64 codons mapping to 20 amino acids + 3 STOP signals) for all DNA-to-protein translations, and the biochemical properties of amino acids (charge, polarity, hydrophobicity) determine the functional capabilities of each organism.

---

## 2. System Architecture

### 2.1 Components

```
kronixcoin/
├── packages/
│   ├── core/          # Shared TypeScript engine
│   │   ├── dna.ts     # DNA generation, codon table, mutations
│   │   ├── ribosome.ts # Protein synthesis, chain folding
│   │   ├── wallet.ts   # Wallet creation, ownership proofs
│   │   ├── miner.ts    # Proof-of-work mining
│   │   ├── transfer.ts # mRNA creation and application
│   │   ├── nullifier.ts # Double-spend prevention
│   │   └── stego.ts    # PNG steganography
│   ├── server/         # NestJS application (Docker)
│   │   ├── wallet/     # Wallet REST API
│   │   ├── mining/     # Mining endpoints
│   │   ├── transfer/   # Transfer validation
│   │   ├── betting/    # Betting integration
│   │   ├── gossip/     # P2P nullifier gossip (WebSocket)
│   │   ├── network/    # Network DNA identity
│   │   └── registry/   # Nullifier persistence
│   └── frontend/       # Standalone web application
├── docker-compose.yml
└── BIOCOIN.md          # This document
```

### 2.2 Core Design Principles

1. **Biology-first**: All abstractions map to real molecular biology concepts.
2. **Offline-first**: Core operations (wallet creation, mining, transfers) work without any server.
3. **No blockchain**: Double-spend prevention through gossip-propagated nullifiers, not a shared ledger.
4. **Bearer instruments**: Coins are transferable files (mRNA payloads) that carry their own validity proof.
5. **Visual identity**: Wallets are PNG images; protein chains are visualizable fingerprints.

---

## 3. Wallet Mechanics

### 3.1 Wallet Creation

A wallet consists of two DNA strands:

- **Wallet DNA** (public): A long DNA string (default 6,000 bases) that contains structural genes, an embedded ownership proof, and coin genes. Stored as a PNG image via steganography.
- **Private Key DNA** (secret): A separate DNA strand (3,000 bases) that serves as the private key.

### 3.2 Public Key Derivation

The public key is derived by running the **ribosome** on the wallet DNA:

1. Scan for ATG (start codon)
2. Read codons in triplets, translating each to an amino acid using the human codon table
3. Stop at TAA, TAG, or TGA (stop codons)
4. Each start-to-stop region produces a **protein**
5. **Inter-genic regions** (DNA between stop and next start) determine how proteins fold and connect
6. The complete protein chain, folded using inter-genic linkers, is hashed to produce the **public key hash**

### 3.3 Ownership Proof

To prove ownership of a wallet:

1. Take the **identity region** (first 300 bases) of wallet DNA
2. **Hybridize** it with the private key DNA (XOR-like combination at base level)
3. Run the ribosome on the hybridized strand
4. Hash the resulting protein chain
5. This hash must match the **embedded proof** stored in the wallet DNA

The embedded proof is encoded in the wallet DNA between two marker sequences (`TTTAAACCCGGG`). Each hex character of the proof hash is stored as 2 DNA bases.

### 3.4 PNG Encoding

Wallet DNA is stored in PNG images using nibble-in-channel steganography:

- Each byte of data is split into two 4-bit nibbles
- Each nibble is stored as `128 + nibble` in the Red channel of a pixel
- Other channels (Green, Blue) contain random values in [128, 255]
- Alpha is always 255
- A 4-byte length prefix enables decoding

The resulting image appears as colorful static but carries the full wallet state.

---

## 4. Mining Protocol

### 4.1 Coin Structure

A coin is a **gene** — a DNA sequence that, when read by the ribosome, produces a protein with a specific header:

```
ATG GGG TGG TGC [body codons] [nonce codons] TAA
 ↓   ↓   ↓   ↓
Met Gly Trp Cys  ← Coin header signature (identifies this protein as a coin)
```

The 4-amino-acid header `Met-Gly-Trp-Cys` distinguishes coin genes from structural genes.

### 4.2 Proof of Work

Mining requires finding a nonce such that:

```
SHA-256(coinGene + "|" + nonce) starts with difficulty prefix
```

The nonce is encoded as DNA codons and embedded into the gene itself, making each mined coin's DNA sequence unique. Default difficulty is `"000"` (three leading hex zeros), adjustable per network.

### 4.3 Network Signing

A mined coin must be signed by a network to be usable on that network:

```
networkSignature = SHA-256(coinSerialHash + "|" + networkDNA[0:300] + "|" + networkId)
```

Different networks produce different signatures. This enables **multi-network coin types** — the same mining engine produces coins that are distinguished by which network signed them.

### 4.4 Wallet Integration

After mining and signing, the coin gene is spliced into the wallet DNA at a valid insertion point (after an existing stop codon). The insertion position is deterministic based on the gene's hash.

---

## 5. Transfer Protocol

### 5.1 mRNA Creation (Sending)

To transfer a coin, the sender creates an **mRNA payload**:

1. **Prove ownership** of the wallet (hybridize with private key)
2. **Locate** the coin gene in the wallet DNA by its serial hash
3. **Extract** the gene (remove it from the wallet DNA)
4. **Compute nullifier**: `SHA-256(coinSerialHash + "|nullifier|" + SHA-256(privateKeyDNA))`
5. **Package** into an mRNA payload containing:
   - The coin gene
   - Coin serial hash
   - Sender's ownership proof
   - Nullifier commitment: `SHA-256(nullifier)`
   - Network signature and ID
   - Mining proof (nonce, hash, difficulty)
   - Full transfer lineage

### 5.2 mRNA Application (Receiving)

The recipient validates and applies the mRNA:

1. **Validate structure**: coin gene produces a valid protein with coin header
2. **Verify serial hash** matches the gene's actual amino acid sequence
3. **Check lineage**: timestamps are monotonically increasing
4. **Integrate**: splice the coin gene into the recipient's wallet DNA

### 5.3 Offline Transfers

mRNA payloads are self-contained JSON files (`.mrna` extension). They can be transferred via:
- File sharing (USB, email, messenger)
- QR code
- Direct paste

The recipient can verify structural validity offline. Double-spend checking requires connection to the gossip network.

---

## 6. Double-Spend Prevention

### 6.1 The Nullifier Model

The core insight: **a coin can only be spent by its owner, and spending produces a deterministic nullifier**.

```
nullifier = SHA-256(coinSerialHash + "|nullifier|" + SHA-256(privateKeyDNA))
```

Properties:
- **Deterministic**: Same coin + same owner always produces the same nullifier
- **Unforgeable**: Only the owner can compute it (requires private key)
- **Unique**: Different coins produce different nullifiers
- **One-way**: The nullifier cannot be reversed to reveal the private key

### 6.2 The Immune System (Gossip Network)

Instead of a blockchain, Kronixcoin uses a **gossip-based nullifier network**:

1. When a coin is spent, the sender broadcasts its **nullifier proof** to connected peers via WebSocket
2. Each node maintains a **nullifier registry** (persistent key-value store)
3. Nodes propagate received nullifiers to their peers (gossip protocol)
4. When receiving a coin, the recipient queries the network: "Has this coin's nullifier been seen?"
5. If yes → reject (coin already spent). If no → accept.

This is analogous to the biological immune system: nullifiers are **antibodies** that propagate through the organism (network) and flag **antigens** (double-spent coins).

### 6.3 Conflict Resolution

When a double-spend is detected (same coin, two different recipients):
- The **first-seen nullifier wins** (timestamp-based)
- Nodes share **conflict reports** as special gossip messages
- The median timestamp across nodes determines the canonical spend

### 6.4 Offline Risk

Offline transfers carry inherent risk (like accepting a personal check):
- **Low-value**: Accept immediately — risk is minimal
- **High-value**: Wait for gossip confirmation from multiple nodes
- **Zero risk**: Only accept on-network (real-time nullifier check)

### 6.5 Coin Lineage

Each mRNA payload carries the coin's full **transfer lineage** — an append-only chain of transfer records:

```json
{
  "lineage": [
    { "from": "pubkey_A", "to": "pubkey_B", "nullifier": "...", "timestamp": 1234 },
    { "from": "pubkey_B", "to": "pubkey_C", "nullifier": "...", "timestamp": 1235 }
  ]
}
```

A double-spend attempt forks the lineage. Any node that sees both forks can detect the fraud and identify the cheater.

---

## 7. Network Architecture

### 7.1 Network Identity

Each Kronixcoin server generates a unique **network DNA** at first boot. This DNA is public and serves as the network's identity. The network ID is derived from the DNA hash.

### 7.2 Multi-Network Coins

Coins signed by different networks are different coin types. This is analogous to different species — the DNA is compatible, but the proteins carry different markers.

### 7.3 Peer Discovery

Nodes connect to each other via WebSocket (`/gossip` namespace). On connection:
1. The new peer receives the full nullifier set
2. Subsequently, nullifiers are propagated in real-time
3. Peers can query the network for specific coin status

---

## 8. Betting Integration

### 8.1 System DNA

The betting system is a wallet. It has its own DNA and private key.

### 8.2 Placing a Bet

1. User creates an mRNA that removes their coin from their wallet
2. The mRNA is "injected" into the betting system's DNA (parasitic integration)
3. The system's DNA mutates to incorporate the user's coin
4. The coin is now controlled by the system

### 8.3 Resolution

1. The system identifies winners
2. Creates mRNA payloads from its DNA for each winner's share
3. Winners apply the mRNA to their wallets
4. Nullifiers are broadcast for all consumed coins

---

## 9. Security Analysis

### 9.1 What Kronixcoin Prevents

| Attack | Prevention |
|--------|-----------|
| **Coin forgery** | PoW mining proof + network signature verification |
| **Double-spend (online)** | Nullifier gossip network — immediate detection |
| **Double-spend (offline)** | Detected when either recipient goes online; lineage fork identifies cheater |
| **Wallet theft** | Private key DNA required for all spend operations |
| **Identity spoofing** | Ownership proof requires hybridization of wallet + private key DNA |

### 9.2 Known Limitations

| Limitation | Description |
|-----------|-------------|
| **Offline double-spend window** | Between offline transfer and gossip propagation, a coin could theoretically be sent to two recipients |
| **Network partition** | If gossip network splits, different partitions may accept conflicting spends |
| **No finality guarantee** | Unlike blockchain confirmations, gossip propagation has no mathematical finality |
| **Trust in first-seen** | The first-seen-wins rule can be gamed if an attacker controls many nodes |

### 9.3 Mitigations

- **Confirmation depth**: Configurable number of gossip nodes that must acknowledge a nullifier
- **Reputation system**: Nodes that propagate conflicting information lose trust
- **Time-locked transfers**: High-value transfers can include a mandatory waiting period

---

## 10. Comparison with Existing Systems

| Feature | Bitcoin | Ethereum | Zcash | Kronixcoin |
|---------|---------|----------|-------|-----------|
| Ledger type | Blockchain | Blockchain | Blockchain | None (gossip) |
| Privacy | Pseudonymous | Pseudonymous | Zero-knowledge | Bearer instrument |
| Offline transfer | No | No | No | Yes |
| Mining | SHA-256 PoW | PoS (was PoW) | Equihash PoW | SHA-256 PoW |
| Smart contracts | Limited | Full EVM | Limited | Via organism abilities |
| Double-spend prevention | 6 confirmations | ~12 confirmations | Nullifier set | Gossip nullifiers |
| Wallet format | Address (string) | Address (string) | Address (string) | DNA strand (PNG image) |

---

## 11. Technical Reference

### 11.1 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `POST /wallet` | Create new wallet |
| `GET /wallet/:id` | View wallet |
| `GET /wallet/:id/balance` | Get coin count |
| `GET /wallet/:id/png` | Get wallet as PNG |
| `GET /wallet/:id/public-key` | Get protein chain |
| `POST /mine` | Mine and sign a coin |
| `GET /mine/difficulty` | Get current difficulty |
| `GET /mine/network` | Get network info |
| `POST /transfer` | Create transfer |
| `POST /transfer/receive` | Apply mRNA |
| `POST /transfer/validate` | Validate mRNA offline |
| `POST /betting/create` | Create a bet |
| `POST /betting/join` | Join with coin |
| `POST /betting/resolve` | Resolve bet |
| `WS /gossip` | Nullifier gossip |
| `WS /betting` | Live betting |

### 11.2 Running

```bash
# Development
cd packages/server && npm run start:dev

# Docker
docker-compose up --build

# Frontend (no server needed for basic operations)
open packages/frontend/index.html
```

### 11.3 Codon Table

The system uses the standard genetic code (SGC). All 64 possible 3-nucleotide combinations from the alphabet {T, A, C, G} map to one of 20 amino acids or a STOP signal. ATG serves dual purpose as both a START signal and the codon for Methionine (Met).

---

## 12. Future Directions

1. **Epigenetics**: Coin metadata that doesn't change the DNA but affects how it's interpreted
2. **CRISPR-style editing**: Precision mutations for batch transfers
3. **Organelle coins**: Sub-wallets within a wallet (like mitochondrial DNA)
4. **Cross-species transfer**: Protocol for converting coins between networks without a central exchange
5. **Genetic drift**: Natural mutation rate that slowly changes wallet appearance over time
6. **Sexual reproduction**: Two wallets combine DNA to create a child wallet with inherited coins
7. **Immune memory**: Nodes remember and fast-track previously validated coin lineages
8. **Hardware wallet**: Private key DNA stored in a TPM/Secure Enclave

---

## License

MIT

---

*Kronixcoin: Where biology meets cryptography.*
