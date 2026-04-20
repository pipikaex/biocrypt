# biocrypt.net

DNA-based cryptocurrency where coins are genes, wallets are DNA strands, and mining is protein synthesis. Secured by Ed25519 signatures + RFLP biological fingerprinting — four layers of defense, zero blockchain.

## Quick Start (Local Development)

```bash
# Install dependencies
npm install

# Build the core library
npm run build -w @biocrypt/core

# Start the API server (port 3000)
cd packages/server && npm run start:dev &

# Start the frontend dev server (port 5173, proxies API to 3000)
cd packages/frontend && npm run dev
```

Open http://localhost:5173

## Docker (Production)

```bash
docker compose build
docker compose up -d
```

Open http://localhost (port 80, nginx reverse proxy).

## Project Structure

```
packages/
  core/       @biocrypt/core — DNA engine, ribosome, wallet, miner, transfer, Ed25519, RFLP
  server/     @biocrypt/server — NestJS API + coin signing + RFLP generation
  frontend/   @biocrypt/frontend — React + Vite SPA (biocrypt.net)
  gateway/    @biocrypt/gateway — Payment gateway SDK (embeddable)
  demo/       @biocrypt/demo — Demo marketplace (demo.biocrypt.net)
```

## How It Works

1. **Create a wallet** — generates a random DNA strand with the Network Genome (Ed25519 public key) embedded
2. **Mine coins** — browser-side SHA-256 proof-of-work on 180-base gene sequences (259 bits of protein entropy)
3. **Sign coins** — network signs with Ed25519 and generates RFLP parentage marker DNA (biological fingerprint)
4. **Transfer coins** — create mRNA payloads carrying Ed25519 signature + RFLP fingerprint for offline verification
5. **Verify offline** — any wallet can verify Ed25519 signature + RFLP gel bands without server contact

## Security: Four Independent Layers

| Layer | Mechanism | Works Offline |
|-------|-----------|:------------:|
| 1. Proof-of-Work | SHA-256 mining difficulty | Yes |
| 2. Ed25519 Signature | 256-bit asymmetric signing (encoded as DNA) | Yes |
| 3. RFLP Fingerprint | Restriction enzyme gel bands — biological parentage proof | Yes |
| 4. Nullifier Tracking | Deterministic spend markers prevent double-spending | Online |

## API Endpoints

All endpoints are prefixed with `/api/`.

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/wallet | Create a new server-side wallet |
| GET | /api/wallet | List all wallets |
| GET | /api/wallet/:id | View wallet details |
| POST | /api/mine | Server-side mine + sign |
| POST | /api/mine/submit | Submit browser-mined coin for signing |
| GET | /api/mine/difficulty | Get current difficulty + target |
| GET | /api/network/stats | Network statistics |
| GET | /api/network/dna | Network DNA analysis with RFLP per coin |
| GET | /api/network/rflp | Network RFLP reference fingerprint |
| POST | /api/transfer | Create a transfer |
| POST | /api/transfer/receive | Receive a transfer |
| POST | /api/gateway/pay | Payment gateway transaction |
| WS | /gossip | Nullifier gossip protocol |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 3000 | API server port |
| DATA_DIR | ./data | Persistent data directory |
| NETWORK_FEE_RATE | 0.1 | Fee coin probability per submission |
| DIFFICULTY_TARGET_SECONDS | 60 | Target seconds per block |
| EPOCH_INTERVAL | 10 | Submissions before difficulty adjustment |

## Headless Miner

```bash
BIOCRYPT_API=https://biocrypt.net/api node packages/server/headless-miner.js
```

## Architecture

See [BIOCOIN.md](BIOCOIN.md) for the full whitepaper.

## License

MIT
