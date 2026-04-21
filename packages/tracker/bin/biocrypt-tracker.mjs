#!/usr/bin/env node
// BioCrypt tracker CLI — start a WebSocket tracker node.
//
// Usage:
//   biocrypt-tracker --port 6690
//   biocrypt-tracker --port 6690 --peer wss://tracker.biocrypt.net
//   biocrypt-tracker --port 6690 --data ./tracker-data
//
// Environment:
//   PORT               fallback port (default 6690)
//   TRACKER_DATA       path to JSON persistence file
//   TRACKER_PEERS      comma-separated peer ws URLs
//   INITIAL_LEADING_TS override difficulty floor (defaults to v1 genesis 16)

import { startTracker } from "../dist/index.js";

function parseArgs(argv) {
  const out = { peers: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--port" || a === "-p") out.port = Number(argv[++i]);
    else if (a === "--host") out.host = argv[++i];
    else if (a === "--data" || a === "-d") out.persistPath = argv[++i];
    else if (a === "--peer") out.peers.push(argv[++i]);
    else if (a === "--quiet" || a === "-q") out.quiet = true;
    else if (a === "--leading-ts") out.leadingTs = Number(argv[++i]);
    else if (a === "--help" || a === "-h") out.help = true;
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));

if (args.help) {
  console.log(`biocrypt-tracker — BioCrypt v1 WebSocket tracker

Usage: biocrypt-tracker [options]

Options:
  -p, --port <n>         Listen port (default: $PORT or 6690)
      --host <h>         Listen host (default: 0.0.0.0)
  -d, --data <path>      JSON persistence file (default: ./tracker-data/tracker.json)
      --peer <ws-url>    Peer tracker URL to gossip with (repeatable)
      --leading-ts <n>   PoW floor (default: 18, v1 genesis)
  -q, --quiet            Silence per-connection logs
  -h, --help             Show this help

Endpoints:
  HTTP  /healthz  /summary  /latest  /genome
  WS    / (connect and send JSON frames per PROTOCOL.md §5)
`);
  process.exit(0);
}

const envPeers = (process.env.TRACKER_PEERS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const peers = [...args.peers, ...envPeers];

const log = args.quiet ? (() => {}) : console.log;

const h = await startTracker({
  port: args.port,
  host: args.host,
  persistPath: args.persistPath,
  peers,
  leadingTs: args.leadingTs,
  log,
});

let shuttingDown = false;
function shutdown(sig) {
  if (shuttingDown) return;
  shuttingDown = true;
  log(`[tracker] ${sig} received, flushing state...`);
  h.close().then(() => process.exit(0));
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
