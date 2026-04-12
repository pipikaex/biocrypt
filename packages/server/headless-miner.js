#!/usr/bin/env node

/**
 * Zcoin Headless Miner
 * Continuously mines coins and submits them to the zcoin network.
 * Runs as a standalone process (PM2, systemd, etc).
 *
 * Environment variables:
 *   ZCOIN_API   - API base URL (default: http://localhost:3100/api)
 *   BODY_LENGTH - Coin body length in bases (default: 60)
 *   LOG_EVERY   - Log hashrate every N seconds (default: 10)
 */

const crypto = require("crypto");
const http = require("http");
const https = require("https");

const API_BASE = process.env.ZCOIN_API || "http://localhost:3100/api";
const BODY_LENGTH = parseInt(process.env.BODY_LENGTH || "180", 10);
const LOG_EVERY_MS = parseInt(process.env.LOG_EVERY || "10", 10) * 1000;

const BASES = ["T", "A", "C", "G"];
const STOP_CODONS = new Set(["TAA", "TAG", "TGA"]);

function sha256(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function encodeNonceAsCodons(nonce) {
  let codons = "";
  let n = nonce;
  for (let i = 0; i < Math.max(2, Math.ceil(Math.log2(nonce + 2) / 6)); i++) {
    const val = n % 64;
    n = Math.floor(n / 64);
    const b0 = BASES[(val >> 4) & 3];
    const b1 = BASES[(val >> 2) & 3];
    const b2 = BASES[val & 3];
    const codon = b0 + b1 + b2;
    codons += (STOP_CODONS.has(codon) || codon === "ATG") ? "GCT" : codon;
  }
  return codons;
}

function generateCoinBody(bodyLength) {
  const COIN_GENE_HEADER = "ATGGGGTGGTGC";
  let coinBody = "";
  while (coinBody.length < bodyLength) {
    const codon = BASES[Math.floor(Math.random() * 4)]
      + BASES[Math.floor(Math.random() * 4)]
      + BASES[Math.floor(Math.random() * 4)];
    if (!STOP_CODONS.has(codon) && codon !== "ATG") {
      coinBody += codon;
    }
  }
  return COIN_GENE_HEADER + coinBody;
}

const httpAgent = new http.Agent({ keepAlive: false });
const httpsAgent = new https.Agent({ keepAlive: false });

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE.endsWith("/") ? API_BASE : API_BASE + "/");
    const mod = url.protocol === "https:" ? https : http;
    const agent = url.protocol === "https:" ? httpsAgent : httpAgent;
    const payload = body ? JSON.stringify(body) : null;

    const req = mod.request(url, {
      method,
      agent,
      timeout: 15000,
      headers: {
        ...(payload ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } : {}),
      },
    }, (res) => {
      let data = "";
      res.on("data", (chunk) => data += chunk);
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) {
            reject(new Error(parsed.message || `HTTP ${res.statusCode}`));
          } else {
            resolve(parsed);
          }
        } catch {
          reject(new Error(`Bad response: ${data.slice(0, 200)}`));
        }
      });
    });
    req.on("timeout", () => { req.destroy(); reject(new Error("Request timeout")); });
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function fetchDifficulty() {
  return request("GET", "mine/difficulty");
}

async function submitCoin(coin) {
  return request("POST", "mine/submit", coin);
}

const YIELD_EVERY = 10000;
const REFRESH_EVERY = 500000;

function yieldToEventLoop() {
  return new Promise((resolve) => setImmediate(resolve));
}

async function mine(target, difficulty) {
  const basePayload = generateCoinBody(BODY_LENGTH);
  let nonce = 0;

  while (true) {
    const nonceCodons = encodeNonceAsCodons(nonce);
    const fullGene = basePayload + nonceCodons + "TAA";
    const payload = fullGene + "|" + nonce;
    const hash = sha256(payload);

    if (hash <= target) {
      return { coinGene: fullGene, nonce, hash, difficulty };
    }

    nonce++;

    if (nonce % YIELD_EVERY === 0) {
      await yieldToEventLoop();
    }

    if (nonce % REFRESH_EVERY === 0) {
      return null;
    }
  }
}

function fmt(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(2) + " MH/s";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + " kH/s";
  return n + " H/s";
}

async function main() {
  console.log(`[miner] Zcoin Headless Miner starting`);
  console.log(`[miner] API: ${API_BASE}`);
  console.log(`[miner] Body length: ${BODY_LENGTH} bases`);
  console.log("");

  let totalCoins = 0;
  let totalHashes = 0;
  let startTime = Date.now();
  let lastLog = Date.now();

  while (true) {
    let diff;
    try {
      diff = await fetchDifficulty();
    } catch (err) {
      console.error(`[miner] Cannot reach API: ${err.message}. Retrying in 10s...`);
      await new Promise((r) => setTimeout(r, 10000));
      continue;
    }

    const { target, difficulty, totalSubmissions, epochProgress, currentReward, halvingEraName, supplyExhausted } = diff;
    if (supplyExhausted) {
      console.log(`[miner] Supply exhausted — all 21,000,000 coins mined. Stopping.`);
      break;
    }
    console.log(`[miner] Difficulty: ${difficulty} (${difficulty.length} zeros) | Epoch: ${epochProgress} | Submissions: ${totalSubmissions} | Reward: ${currentReward || "?"} | Era: ${halvingEraName || "?"}`);

    let batchHashes = 0;
    const batchStart = Date.now();

    while (true) {
      const result = await mine(target, difficulty);

      const hashes = result ? result.nonce + 1 : REFRESH_EVERY;
      batchHashes += hashes;
      totalHashes += hashes;

      // Periodic status log
      const now = Date.now();
      if (now - lastLog >= LOG_EVERY_MS) {
        const elapsed = (now - startTime) / 1000;
        const rate = Math.round(totalHashes / elapsed);
        console.log(`[miner] ${fmt(rate)} | ${totalHashes.toLocaleString()} hashes | ${totalCoins} coins mined | uptime ${Math.round(elapsed)}s`);
        lastLog = now;
      }

      if (!result) {
        // Yield point — refresh difficulty in case it changed
        break;
      }

      // Found a coin!
      console.log(`[miner] COIN FOUND! nonce=${result.nonce} hash=${result.hash.slice(0, 16)}...`);

      try {
        const resp = await submitCoin(result);
        const reward = resp.blockReward || 1;
        totalCoins += reward;
        const bonusCount = resp.bonusCoins ? resp.bonusCoins.length : 0;
        console.log(`[miner] Coin signed! serial=${resp.coin.serialHash.slice(0, 16)}... network=${resp.coin.networkId} | reward: ${reward} coins (1 mined + ${bonusCount} bonus) | era: ${resp.halvingEraName || "?"} | telomere: ${(resp.telomerePercent || 100).toFixed(2)}%`);
        if (resp.difficultyAdjusted) {
          console.log(`[miner] Difficulty adjusted to: ${resp.currentDifficulty}`);
        }
      } catch (err) {
        console.error(`[miner] Submit failed: ${err.message}`);
        // Refresh difficulty and continue
        break;
      }
    }
  }
}

main().catch((err) => {
  console.error("[miner] Fatal error:", err);
  process.exit(1);
});
