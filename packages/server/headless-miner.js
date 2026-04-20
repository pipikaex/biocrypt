#!/usr/bin/env node

/**
 * BioCrypt Headless Miner — multi-core, production-ready.
 *
 * Usage:
 *   node headless-miner.js                          # uses defaults
 *   BIOCRYPT_API=https://biocrypt.net/api node headless-miner.js
 *   WORKERS=4 node headless-miner.js                # 4 mining threads
 *
 * Environment variables:
 *   BIOCRYPT_API - API base URL       (default: http://localhost:3100/api)
 *   WORKERS     - Number of threads   (default: CPU count - 1, min 1)
 *   BODY_LENGTH - Coin body in bases  (default: 180)
 *   LOG_EVERY   - Status log interval (default: 10 seconds)
 */

const { Worker, isMainThread, parentPort, workerData } = require("worker_threads");
const crypto = require("crypto");
const http = require("http");
const https = require("https");
const os = require("os");

/* ───────────── Worker thread ───────────── */

if (!isMainThread) {
  const BASES = ["T", "A", "C", "G"];
  const STOP_CODONS = new Set(["TAA", "TAG", "TGA"]);
  const COIN_GENE_HEADER = "ATGGGGTGGTGC";
  const MERKLE_MARKER = "CGACGCCGA";
  const HEX_CODONS = {
    "0": "TTT", "1": "TTC", "2": "TTA", "3": "TTG",
    "4": "TAT", "5": "TAC", "6": "TCT", "7": "TCC",
    "8": "TCA", "9": "TCG", "a": "TGT", "b": "TGC",
    "c": "TGG", "d": "CTT", "e": "CTC", "f": "CTG",
  };

  function sha256(input) {
    return crypto.createHash("sha256").update(input).digest("hex");
  }

  function encodeMerkleRootAsDNA(root) {
    let dna = MERKLE_MARKER;
    for (const ch of root.toLowerCase()) dna += HEX_CODONS[ch] || "TTT";
    return dna;
  }

  function merkleRootFromLeaves(leaves) {
    if (leaves.length === 0) return sha256("");
    let layer = [...leaves];
    while (layer.length > 1) {
      const next = [];
      for (let i = 0; i < layer.length; i += 2) {
        const left = layer[i];
        const right = i + 1 < layer.length ? layer[i + 1] : left;
        next.push(sha256(left + right));
      }
      layer = next;
    }
    return layer[0];
  }

  function merkleProofFor(leaves, index) {
    if (leaves.length <= 1) return [];
    const proof = [];
    let layer = [...leaves];
    let idx = index;
    while (layer.length > 1) {
      const next = [];
      for (let i = 0; i < layer.length; i += 2) {
        const left = layer[i];
        const right = i + 1 < layer.length ? layer[i + 1] : left;
        next.push(sha256(left + right));
        if (i === idx || i + 1 === idx) {
          if (idx % 2 === 0) {
            proof.push({ hash: i + 1 < layer.length ? layer[i + 1] : layer[i], position: "right" });
          } else {
            proof.push({ hash: layer[i], position: "left" });
          }
        }
      }
      layer = next;
      idx = Math.floor(idx / 2);
    }
    return proof;
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
    let coinBody = "";
    while (coinBody.length < bodyLength) {
      const codon = BASES[Math.floor(Math.random() * 4)]
        + BASES[Math.floor(Math.random() * 4)]
        + BASES[Math.floor(Math.random() * 4)];
      if (!STOP_CODONS.has(codon) && codon !== "ATG") {
        coinBody += codon;
      }
    }
    return coinBody;
  }

  const CODON_TABLE = {
    TTT:"Phe",TTC:"Phe",TTA:"Leu",TTG:"Leu",CTT:"Leu",CTC:"Leu",CTA:"Leu",CTG:"Leu",
    ATT:"Ile",ATC:"Ile",ATA:"Ile",ATG:"Met",GTT:"Val",GTC:"Val",GTA:"Val",GTG:"Val",
    TCT:"Ser",TCC:"Ser",TCA:"Ser",TCG:"Ser",CCT:"Pro",CCC:"Pro",CCA:"Pro",CCG:"Pro",
    ACT:"Thr",ACC:"Thr",ACA:"Thr",ACG:"Thr",GCT:"Ala",GCC:"Ala",GCA:"Ala",GCG:"Ala",
    TAT:"Tyr",TAC:"Tyr",CAT:"His",CAC:"His",CAA:"Gln",CAG:"Gln",AAT:"Asn",AAC:"Asn",
    AAA:"Lys",AAG:"Lys",GAT:"Asp",GAC:"Asp",GAA:"Glu",GAG:"Glu",TGT:"Cys",TGC:"Cys",
    TGG:"Trp",CGT:"Arg",CGC:"Arg",CGA:"Arg",CGG:"Arg",AGA:"Arg",AGG:"Arg",AGT:"Ser",
    AGC:"Ser",GGT:"Gly",GGC:"Gly",GGA:"Gly",GGG:"Gly",
  };

  function extractProtein(coinGene) {
    const acids = [];
    let i = coinGene.indexOf("ATG");
    if (i === -1) return null;
    i += 3;
    acids.push("Met");
    while (i + 2 < coinGene.length) {
      const codon = coinGene.slice(i, i + 3);
      if (STOP_CODONS.has(codon)) break;
      const aa = CODON_TABLE[codon];
      if (!aa) break;
      acids.push(aa);
      i += 3;
    }
    if (acids.length <= 4) return null;
    return acids;
  }

  let target = workerData.target;
  let difficulty = workerData.difficulty;
  let blockReward = workerData.blockReward || 1;
  const bodyLength = workerData.bodyLength;
  const workerId = workerData.id;
  const REPORT_INTERVAL = 2000;

  parentPort.on("message", (msg) => {
    if (msg.type === "updateTarget") {
      target = msg.target;
      difficulty = msg.difficulty;
      if (msg.blockReward !== undefined) blockReward = msg.blockReward;
    }
  });

  let hashCount = 0;
  let lastReport = Date.now();

  function mineBlock() {
    const reward = blockReward;
    const MAX_NONCE = 2_000_000;

    if (reward <= 1) {
      // Single coin — no Merkle needed
      const basePayload = COIN_GENE_HEADER + generateCoinBody(bodyLength);
      let nonce = 0;

      while (nonce < MAX_NONCE) {
        const nonceCodons = encodeNonceAsCodons(nonce);
        const fullGene = basePayload + nonceCodons + "TAA";
        const payload = fullGene + "|" + nonce;
        const hash = sha256(payload);
        hashCount++;

        if (hash <= target) {
          const acids = extractProtein(fullGene);
          if (acids && acids.length > 4) {
            parentPort.postMessage({ type: "found", coinGene: fullGene, nonce, hash, difficulty, bonusCoinGenes: [] });
          }
        }
        nonce++;
        reportHashrate();
      }
    } else {
      // Multi-coin block with Merkle root
      const bonusGenes = [];
      for (let i = 0; i < reward - 1; i++) {
        bonusGenes.push(COIN_GENE_HEADER + generateCoinBody(bodyLength) + "TAA");
      }
      const primaryBody = generateCoinBody(bodyLength);
      const primaryLeaf = sha256(COIN_GENE_HEADER + primaryBody);
      const allLeaves = [primaryLeaf, ...bonusGenes.map(g => sha256(g))];
      const root = merkleRootFromLeaves(allLeaves);
      const merkleRootDNA = encodeMerkleRootAsDNA(root);
      const basePayload = COIN_GENE_HEADER + primaryBody + merkleRootDNA;

      let nonce = 0;
      while (nonce < MAX_NONCE) {
        const nonceCodons = encodeNonceAsCodons(nonce);
        const fullGene = basePayload + nonceCodons + "TAA";
        const payload = fullGene + "|" + nonce;
        const hash = sha256(payload);
        hashCount++;

        if (hash <= target) {
          const acids = extractProtein(fullGene);
          if (acids && acids.length > 4) {
            const bonusWithProofs = bonusGenes.map((gene, idx) => ({
              coinGene: gene,
              merkleProof: merkleProofFor(allLeaves, idx + 1),
            }));
            parentPort.postMessage({ type: "found", coinGene: fullGene, nonce, hash, difficulty, bonusCoinGenes: bonusWithProofs });
          }
        }
        nonce++;
        reportHashrate();
      }
    }

    setImmediate(mineBlock);
  }

  function reportHashrate() {
    const now = Date.now();
    if (now - lastReport >= REPORT_INTERVAL) {
      const elapsed = (now - lastReport) / 1000;
      parentPort.postMessage({ type: "hashrate", rate: Math.round(hashCount / elapsed), hashes: hashCount });
      hashCount = 0;
      lastReport = now;
    }
  }

  mineBlock();
  process.exit = () => {};
}

/* ───────────── Main thread ───────────── */

if (isMainThread) {
  const API_BASE = process.env.BIOCRYPT_API || "http://localhost:3100/api";
  const BODY_LENGTH = parseInt(process.env.BODY_LENGTH || "180", 10);
  const LOG_EVERY_MS = parseInt(process.env.LOG_EVERY || "10", 10) * 1000;
  const NUM_WORKERS = Math.max(1, parseInt(process.env.WORKERS || String(Math.max(1, os.cpus().length - 1)), 10));

  function request(method, path, body) {
    return new Promise((resolve, reject) => {
      const base = API_BASE.endsWith("/") ? API_BASE : API_BASE + "/";
      const url = new URL(path, base);
      const mod = url.protocol === "https:" ? https : http;
      const payload = body ? JSON.stringify(body) : null;

      const req = mod.request(url, {
        method,
        timeout: 30000,
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
            reject(new Error(`Bad response (${res.statusCode}): ${data.slice(0, 300)}`));
          }
        });
      });
      req.on("timeout", () => { req.destroy(); reject(new Error("Request timeout")); });
      req.on("error", reject);
      if (payload) req.write(payload);
      req.end();
    });
  }

  function fmt(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(2) + " MH/s";
    if (n >= 1e3) return (n / 1e3).toFixed(1) + " kH/s";
    return n + " H/s";
  }

  async function main() {
    console.log("╔══════════════════════════════════════════╗");
    console.log("║       BioCrypt Headless Miner            ║");
    console.log("╚══════════════════════════════════════════╝");
    console.log(`  API:     ${API_BASE}`);
    console.log(`  Workers: ${NUM_WORKERS} threads`);
    console.log(`  Body:    ${BODY_LENGTH} bases`);
    console.log("");

    let diff;
    while (true) {
      try {
        diff = await request("GET", "mine/difficulty");
        break;
      } catch (err) {
        console.error(`[miner] Cannot reach API: ${err.message}. Retrying in 5s...`);
        await new Promise((r) => setTimeout(r, 5000));
      }
    }

    if (diff.supplyExhausted) {
      console.log("[miner] Supply exhausted — all 21,000,000 coins mined. Nothing to do.");
      process.exit(0);
    }

    console.log(`[miner] Network: ${diff.networkId}`);
    console.log(`[miner] Difficulty: ${diff.difficulty} (${diff.difficulty.length} leading zeros)`);
    console.log(`[miner] Target: ${diff.target.slice(0, 16)}...`);
    console.log(`[miner] Epoch: ${diff.epochProgress} | Reward: ${diff.currentReward} | Era: ${diff.halvingEraName}`);
    console.log("");

    let currentTarget = diff.target;
    let currentDifficulty = diff.difficulty;
    let currentReward = diff.currentReward || 1;
    let totalHashes = 0;
    let totalCoins = 0;
    const startTime = Date.now();
    let lastLog = Date.now();
    let submitting = false;
    const workerRates = new Map();

    const workers = [];
    for (let i = 0; i < NUM_WORKERS; i++) {
      const w = new Worker(__filename, {
        workerData: {
          id: i,
          target: currentTarget,
          difficulty: currentDifficulty,
          bodyLength: BODY_LENGTH,
          blockReward: currentReward,
        },
      });

      w.on("message", async (msg) => {
        if (msg.type === "hashrate") {
          workerRates.set(i, msg.rate);
          totalHashes += msg.hashes;

          const now = Date.now();
          if (now - lastLog >= LOG_EVERY_MS) {
            const combinedRate = Array.from(workerRates.values()).reduce((a, b) => a + b, 0);
            const elapsed = Math.round((now - startTime) / 1000);
            const h = Math.floor(elapsed / 3600);
            const m = Math.floor((elapsed % 3600) / 60);
            const s = elapsed % 60;
            const uptime = h > 0 ? `${h}h${m}m${s}s` : m > 0 ? `${m}m${s}s` : `${s}s`;
            console.log(`[miner] ${fmt(combinedRate)} | ${totalHashes.toLocaleString()} hashes | ${totalCoins} coins | uptime ${uptime}`);
            lastLog = now;
          }
        }

        if (msg.type === "found" && !submitting) {
          submitting = true;
          const bonusCount = msg.bonusCoinGenes ? msg.bonusCoinGenes.length : 0;
          console.log(`[miner] COIN FOUND by worker ${i}! nonce=${msg.nonce} hash=${msg.hash.slice(0, 16)}... (+${bonusCount} bonus)`);

          try {
            const submitBody = {
              coinGene: msg.coinGene,
              nonce: msg.nonce,
              hash: msg.hash,
              difficulty: msg.difficulty,
            };
            if (msg.bonusCoinGenes && msg.bonusCoinGenes.length > 0) {
              submitBody.bonusCoinGenes = msg.bonusCoinGenes;
            }

            const resp = await request("POST", "mine/submit", submitBody);

            const reward = resp.blockReward || 1;
            totalCoins += reward;
            const signedBonus = resp.bonusCoins ? resp.bonusCoins.length : 0;
            console.log(`[miner] SIGNED! serial=${resp.coin.serialHash.slice(0, 16)}... | reward: ${reward} (1+${signedBonus} bonus${resp.merkleVerified ? " Merkle✓" : ""}) | era: ${resp.halvingEraName || "?"} | telomere: ${(resp.telomerePercent || 100).toFixed(2)}%`);

            if (resp.difficultyAdjusted) {
              console.log(`[miner] Difficulty adjusted → ${resp.currentDifficulty}`);
            }

            currentTarget = resp.currentTarget;
            currentDifficulty = resp.currentDifficulty;
            if (resp.blockReward) currentReward = resp.blockReward;
            for (const w of workers) {
              w.postMessage({ type: "updateTarget", target: currentTarget, difficulty: currentDifficulty, blockReward: currentReward });
            }
          } catch (err) {
            console.error(`[miner] Submit failed: ${err.message}`);
          }

          submitting = false;
        }
      });

      w.on("error", (err) => {
        console.error(`[miner] Worker ${i} error:`, err.message);
      });

      workers.push(w);
      console.log(`[miner] Worker ${i} started`);
    }

    setInterval(async () => {
      try {
        const d = await request("GET", "mine/difficulty");
        if (d.target !== currentTarget) {
          console.log(`[miner] Difficulty update: ${d.difficulty} (${d.difficulty.length} zeros)`);
          currentTarget = d.target;
          currentDifficulty = d.difficulty;
          if (d.currentReward) currentReward = d.currentReward;
          for (const w of workers) {
            w.postMessage({ type: "updateTarget", target: currentTarget, difficulty: currentDifficulty, blockReward: currentReward });
          }
        }
        if (d.supplyExhausted) {
          console.log("[miner] Supply exhausted. Shutting down.");
          process.exit(0);
        }
      } catch {}
    }, 60000);

    process.on("SIGINT", () => {
      console.log("\n[miner] Shutting down...");
      for (const w of workers) w.terminate();
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      console.log(`[miner] Total: ${totalHashes.toLocaleString()} hashes, ${totalCoins} coins in ${elapsed}s`);
      process.exit(0);
    });
  }

  main().catch((err) => {
    console.error("[miner] Fatal:", err);
    process.exit(1);
  });
}
