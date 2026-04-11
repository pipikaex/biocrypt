# zcoin.bio

DNA-based cryptocurrency where coins are genes, wallets are DNA strands, and mining is protein synthesis.

## Quick Start (Local Development)

```bash
# Install dependencies
npm install

# Build the core library
cd packages/core && npm run build && cd ../..

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
  core/       @zcoin/core — DNA engine, ribosome, wallet, miner, transfer, nullifier
  server/     @zcoin/server — NestJS API + WebSocket gossip
  frontend/   @zcoin/frontend — React + Vite SPA
```

## How It Works

1. **Create a wallet** — generates a random DNA strand with an embedded ownership proof
2. **Mine coins** — browser-side proof-of-work (SHA-256 with difficulty prefix)
3. **Sign coins** — submit mined coins to the network; server signs with network DNA
4. **Transfer coins** — create mRNA payloads that move coin genes between wallets
5. **Offline support** — export/import mRNA files for peer-to-peer transfers without internet

## API Endpoints

All endpoints are prefixed with `/api/`.

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/wallet | Create a new server-side wallet |
| GET | /api/wallet | List all wallets |
| GET | /api/wallet/:id | View wallet details |
| GET | /api/wallet/:id/balance | Get coin balance |
| POST | /api/mine | Server-side mine + sign |
| POST | /api/mine/submit | Submit browser-mined coin for signing |
| GET | /api/mine/difficulty | Get current difficulty |
| GET | /api/network/stats | Network statistics |
| POST | /api/transfer | Create a transfer |
| POST | /api/transfer/receive | Receive a transfer |
| WS | /gossip | Nullifier gossip protocol |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 3000 | API server port |
| MINING_DIFFICULTY | 000 | Required hash prefix for PoW |
| DATA_DIR | ./data | Persistent data directory |
| NETWORK_FEE_RATE | 0.1 | Probability of network fee coin per submission |

## Architecture

See [BIOCOIN.md](BIOCOIN.md) for the full whitepaper.
