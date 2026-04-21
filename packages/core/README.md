# @biocrypt/core

Core primitives for the BioCrypt v1 decentralized cryptocurrency protocol.

## What's in the box

- **DNA256 hashing** — 256-base biologically-flavored proof-of-work hash
- **Ribosome** — translates coin genes to amino acid proteins
- **Ed25519 coin signing** — `signCoinWithMiner` / `verifyCoinV1`
- **mRNA transfers** — offline-capable encrypted envelope transfers (X25519 + XSalsa20-Poly1305)
- **Genesis constants** — hardcoded v1 protocol fingerprint (`GENESIS_GENOME_FINGERPRINT`, `GENESIS_LEADING_TS`, `GENESIS_NETWORK_ID`)

## Install

```bash
npm install @biocrypt/core
```

## Usage

```ts
import {
  generateNetworkKeyPair,
  signCoinWithMiner,
  verifyCoinV1,
  ribosome,
  GENESIS_GENOME_FINGERPRINT,
} from "@biocrypt/core";

const wallet = generateNetworkKeyPair();
// ...pair with @biocrypt/tracker to mint and broadcast coins
```

## Docs

See [PROTOCOL.md](https://github.com/pipikaex/biocrypt/blob/main/PROTOCOL.md) for the v1 wire format.

## License

MIT
