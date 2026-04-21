import {
  sha256, BASES, STOP_CODONS, DEFAULT_BODY_LENGTH,
  powLayerDna256, countLeadingTs, powLayerDigestHex,
} from "@biocrypt/core";

interface StartMsg {
  type: "start";
  target: string;            // legacy SHA-256 hex target (still used for fallback)
  difficulty: string;        // display prefix of the hex target
  leadingTs: number;         // DNA256 difficulty (number of leading T bases required)
  bodyLength?: number;
  blockReward?: number;
}

interface StopMsg {
  type: "stop";
}

interface UpdateTargetMsg {
  type: "updateTarget";
  target: string;
  difficulty: string;
  leadingTs: number;
  blockReward?: number;
}

type InMsg = StartMsg | StopMsg | UpdateTargetMsg;

let running = false;
let currentTarget = "";
let currentDifficulty = "";
let currentLeadingTs = 16;
let currentBlockReward = 1;

/* ─── Merkle root encoding as DNA ─── */

const HEX_CODONS: Record<string, string> = {
  "0": "TTT", "1": "TTC", "2": "TTA", "3": "TTG",
  "4": "TAT", "5": "TAC", "6": "TCT", "7": "TCC",
  "8": "TCA", "9": "TCG", "a": "TGT", "b": "TGC",
  "c": "TGG", "d": "CTT", "e": "CTC", "f": "CTG",
};

const MERKLE_MARKER = "CGACGCCGA";

function encodeMerkleRootAsDNA(root: string): string {
  let dna = MERKLE_MARKER;
  for (const ch of root.toLowerCase()) {
    dna += HEX_CODONS[ch] || "TTT";
  }
  return dna;
}

function merkleRootFromLeaves(leaves: string[]): string {
  if (leaves.length === 0) return sha256("");
  let layer = leaves.map((l) => sha256("L:" + l));
  while (layer.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < layer.length; i += 2) {
      const left = layer[i];
      const right = i + 1 < layer.length ? layer[i + 1] : left;
      next.push(sha256("N:" + left + right));
    }
    layer = next;
  }
  return layer[0];
}

function merkleProofFor(
  leaves: string[],
  index: number,
): Array<{ hash: string; position: "left" | "right" }> {
  if (leaves.length <= 1) return [];
  const proof: Array<{ hash: string; position: "left" | "right" }> = [];
  let layer = leaves.map((l) => sha256("L:" + l));
  let idx = index;
  while (layer.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < layer.length; i += 2) {
      const left = layer[i];
      const right = i + 1 < layer.length ? layer[i + 1] : left;
      next.push(sha256("N:" + left + right));
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

/* ─── Coin gene helpers ─── */

const COIN_GENE_HEADER = "ATGGGGTGGTGC";

function encodeNonceAsCodons(nonce: number): string {
  let codons = "";
  let n = nonce;
  for (let i = 0; i < Math.max(2, Math.ceil(Math.log2(nonce + 2) / 6)); i++) {
    const val = n % 64;
    n = Math.floor(n / 64);
    const b0 = BASES[(val >> 4) & 3];
    const b1 = BASES[(val >> 2) & 3];
    const b2 = BASES[val & 3];
    const codon = b0 + b1 + b2;
    if (STOP_CODONS.has(codon) || codon === "ATG") {
      codons += "GCT";
    } else {
      codons += codon;
    }
  }
  return codons;
}

function generateCoinBody(bodyLength: number): string {
  let coinBody = "";
  while (coinBody.length < bodyLength) {
    const codon =
      BASES[Math.floor(Math.random() * 4)] +
      BASES[Math.floor(Math.random() * 4)] +
      BASES[Math.floor(Math.random() * 4)];
    if (!STOP_CODONS.has(codon) && codon !== "ATG") {
      coinBody += codon;
    }
  }
  return coinBody;
}

function extractSerial(coinGene: string): { serial: string; aminoAcids: string[] } | null {
  const CODON_TABLE: Record<string, string> = {
    TTT: "Phe", TTC: "Phe", TTA: "Leu", TTG: "Leu",
    CTT: "Leu", CTC: "Leu", CTA: "Leu", CTG: "Leu",
    ATT: "Ile", ATC: "Ile", ATA: "Ile", ATG: "Met",
    GTT: "Val", GTC: "Val", GTA: "Val", GTG: "Val",
    TCT: "Ser", TCC: "Ser", TCA: "Ser", TCG: "Ser",
    CCT: "Pro", CCC: "Pro", CCA: "Pro", CCG: "Pro",
    ACT: "Thr", ACC: "Thr", ACA: "Thr", ACG: "Thr",
    GCT: "Ala", GCC: "Ala", GCA: "Ala", GCG: "Ala",
    TAT: "Tyr", TAC: "Tyr", CAT: "His", CAC: "His",
    CAA: "Gln", CAG: "Gln", AAT: "Asn", AAC: "Asn",
    AAA: "Lys", AAG: "Lys", GAT: "Asp", GAC: "Asp",
    GAA: "Glu", GAG: "Glu", TGT: "Cys", TGC: "Cys",
    TGG: "Trp", CGT: "Arg", CGC: "Arg", CGA: "Arg",
    CGG: "Arg", AGA: "Arg", AGG: "Arg", AGT: "Ser",
    AGC: "Ser", GGT: "Gly", GGC: "Gly", GGA: "Gly",
    GGG: "Gly",
  };

  const acids: string[] = [];
  let i = coinGene.indexOf("ATG");
  if (i === -1) return null;

  i += 3;
  acids.push("Met");

  while (i + 2 < coinGene.length) {
    const codon = coinGene.slice(i, i + 3);
    const aa = CODON_TABLE[codon];
    if (!aa || aa === "STOP") break;
    acids.push(aa);
    i += 3;
  }

  if (acids.length <= 4) return null;
  return { serial: acids.slice(4).join("-"), aminoAcids: acids };
}

/* ─── DNA256 mining loop ─── */

function mineLoop(leadingTs: number, bodyLength: number) {
  running = true;
  currentLeadingTs = leadingTs;

  let lastReport = performance.now();
  let hashCount = 0;
  let totalNonce = 0;

  while (running) {
    const reward = currentBlockReward;

    if (reward <= 1) {
      // Single coin — no Merkle needed
      const basePayload = COIN_GENE_HEADER + generateCoinBody(bodyLength);
      let nonce = 0;

      while (running) {
        const nonceCodons = encodeNonceAsCodons(nonce);
        const fullGene = basePayload + nonceCodons + "TAA";
        const strand = powLayerDna256(fullGene, nonce);
        hashCount++;
        totalNonce++;

        if (countLeadingTs(strand) >= currentLeadingTs) {
          const extracted = extractSerial(fullGene);
          if (extracted) {
            self.postMessage({
              type: "result",
              coinGene: fullGene,
              serial: extracted.serial,
              serialHash: sha256(extracted.serial),
              aminoAcids: extracted.aminoAcids,
              nonce,
              hash: powLayerDigestHex(fullGene + "|" + nonce),
              dnaStrand: strand,
              difficulty: currentDifficulty,
              leadingTs: currentLeadingTs,
              minedAt: Date.now(),
              bonusCoinGenes: [],
            });
            break;
          }
        }

        nonce++;
        reportProgress(hashCount, lastReport);
      }
    } else {
      // Multi-coin block with Merkle root
      const bonusBodies: string[] = [];
      const bonusGenes: string[] = [];
      for (let i = 0; i < reward - 1; i++) {
        const body = generateCoinBody(bodyLength);
        bonusBodies.push(body);
        bonusGenes.push(COIN_GENE_HEADER + body + "TAA");
      }

      const primaryBody = generateCoinBody(bodyLength);
      const primaryLeaf = sha256(COIN_GENE_HEADER + primaryBody);
      const allLeaves = [primaryLeaf, ...bonusGenes.map((g) => sha256(g))];
      const root = merkleRootFromLeaves(allLeaves);
      const merkleRootDNA = encodeMerkleRootAsDNA(root);

      const basePayload = COIN_GENE_HEADER + primaryBody + merkleRootDNA;
      let nonce = 0;

      while (running) {
        const nonceCodons = encodeNonceAsCodons(nonce);
        const fullGene = basePayload + nonceCodons + "TAA";
        const strand = powLayerDna256(fullGene, nonce);
        hashCount++;
        totalNonce++;

        if (countLeadingTs(strand) >= currentLeadingTs) {
          const extracted = extractSerial(fullGene);
          if (extracted) {
            const bonusWithProofs = bonusGenes.map((gene, idx) => ({
              coinGene: gene,
              merkleProof: merkleProofFor(allLeaves, idx + 1),
            }));
            self.postMessage({
              type: "result",
              coinGene: fullGene,
              serial: extracted.serial,
              serialHash: sha256(extracted.serial),
              aminoAcids: extracted.aminoAcids,
              nonce,
              hash: powLayerDigestHex(fullGene + "|" + nonce),
              dnaStrand: strand,
              difficulty: currentDifficulty,
              leadingTs: currentLeadingTs,
              minedAt: Date.now(),
              bonusCoinGenes: bonusWithProofs,
            });
            break;
          }
        }

        nonce++;
        reportProgress(hashCount, lastReport);
      }
    }
  }

  function reportProgress(hc: number, lr: number) {
    const now = performance.now();
    if (now - lr >= 500) {
      const elapsed = (now - lr) / 1000;
      self.postMessage({
        type: "progress",
        hashrate: Math.round(hc / elapsed),
        nonce: totalNonce,
      });
      hashCount = 0;
      lastReport = now;
    }
  }
}

self.onmessage = (e: MessageEvent<InMsg>) => {
  const msg = e.data;
  if (msg.type === "start") {
    currentBlockReward = msg.blockReward ?? 1;
    currentTarget = msg.target;
    currentDifficulty = msg.difficulty;
    currentLeadingTs = msg.leadingTs ?? 18;
    mineLoop(currentLeadingTs, msg.bodyLength ?? DEFAULT_BODY_LENGTH);
  } else if (msg.type === "stop") {
    running = false;
  } else if (msg.type === "updateTarget") {
    currentTarget = msg.target;
    currentDifficulty = msg.difficulty;
    currentLeadingTs = msg.leadingTs ?? currentLeadingTs;
    if (msg.blockReward !== undefined) currentBlockReward = msg.blockReward;
  }
};
