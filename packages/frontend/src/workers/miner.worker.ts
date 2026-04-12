import { sha256, BASES, STOP_CODONS, DEFAULT_BODY_LENGTH } from "@zcoin/core";

interface StartMsg {
  type: "start";
  target: string;
  difficulty: string;
  bodyLength?: number;
}

interface StopMsg {
  type: "stop";
}

interface UpdateTargetMsg {
  type: "updateTarget";
  target: string;
  difficulty: string;
}

type InMsg = StartMsg | StopMsg | UpdateTargetMsg;

let running = false;
let currentTarget = "";
let currentDifficulty = "";

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
  const COIN_GENE_HEADER = "ATGGGGTGGTGC";
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
  return COIN_GENE_HEADER + coinBody;
}

function mineLoop(target: string, difficulty: string, bodyLength: number) {
  running = true;
  currentTarget = target;
  currentDifficulty = difficulty;

  let lastReport = performance.now();
  let hashCount = 0;
  let totalNonce = 0;

  while (running) {
    const basePayload = generateCoinBody(bodyLength);
    let nonce = 0;

    while (running) {
      const nonceCodons = encodeNonceAsCodons(nonce);
      const fullGene = basePayload + nonceCodons + "TAA";
      const payload = fullGene + "|" + nonce;
      const hash = sha256(payload);
      hashCount++;
      totalNonce++;

      if (hash <= currentTarget) {
        const extracted = extractSerial(fullGene);
        if (extracted) {
          self.postMessage({
            type: "result",
            coinGene: fullGene,
            serial: extracted.serial,
            serialHash: sha256(extracted.serial),
            aminoAcids: extracted.aminoAcids,
            nonce,
            hash,
            difficulty: currentDifficulty,
            minedAt: Date.now(),
          });
          break;
        }
      }

      nonce++;

      const now = performance.now();
      if (now - lastReport >= 500) {
        const elapsed = (now - lastReport) / 1000;
        self.postMessage({
          type: "progress",
          hashrate: Math.round(hashCount / elapsed),
          nonce: totalNonce,
        });
        hashCount = 0;
        lastReport = now;
      }
    }
  }
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

self.onmessage = (e: MessageEvent<InMsg>) => {
  const msg = e.data;
  if (msg.type === "start") {
    mineLoop(msg.target, msg.difficulty, msg.bodyLength ?? DEFAULT_BODY_LENGTH);
  } else if (msg.type === "stop") {
    running = false;
  } else if (msg.type === "updateTarget") {
    currentTarget = msg.target;
    currentDifficulty = msg.difficulty;
  }
};
