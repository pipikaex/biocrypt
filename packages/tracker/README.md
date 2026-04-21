# @biocrypt/tracker

Zero-dependency WebSocket tracker for the BioCrypt v1 decentralized network. Run your own tracker node in one line — or use it as a library.

## Run a tracker

```bash
npx @biocrypt/tracker --port 6690 --data ./tracker-data/tracker.json
```

Options:

| Flag                  | Default                               | Description                       |
| --------------------- | ------------------------------------- | --------------------------------- |
| `-p, --port <n>`      | `$PORT` or `6690`                     | Listen port                       |
| `--host <h>`          | `0.0.0.0`                             | Listen host                       |
| `-d, --data <path>`   | `./tracker-data/tracker.json`         | JSON persistence file             |
| `--peer <ws-url>`     | —                                     | Peer tracker URL (repeatable)     |
| `--leading-ts <n>`    | `16` (v1 genesis)                     | PoW difficulty floor              |
| `-q, --quiet`         | off                                   | Silence per-connection logs       |

HTTP endpoints: `/healthz`, `/summary`, `/latest`, `/genome`.
WebSocket: connect to `/` and exchange JSON frames per `PROTOCOL.md`.

## Mine coins

This package also ships the `biocrypt-mine` CLI that drives the native
`zcoin-miner-v1` binary and submits candidates to a tracker:

```bash
biocrypt-mine --tracker wss://tracker.biocrypt.net \
              --miner ./zcoin-miner-v1 \
              --wallet ~/.biocrypt/miner-wallet.json
```

## Peer gossip

Join an existing mesh by peering to one or more known trackers:

```bash
npx @biocrypt/tracker --port 6690 --peer wss://tracker.biocrypt.net
```

On connect, a fresh tracker back-fills its state via `sync-request` and then
forwards every new mint and spend via `broadcast-mint` / `broadcast-spend`.

## Library usage

```ts
import { startTracker } from "@biocrypt/tracker";

const h = await startTracker({
  port: 6690,
  persistPath: "./tracker-data/tracker.json",
  peers: ["wss://tracker.biocrypt.net"],
});
```

## License

MIT
