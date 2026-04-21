/**
 * BioCrypt v1 miner-signed coins.
 *
 * In v1 there is no central network private key. Each coin is signed by the
 * miner's own wallet Ed25519 key, and the miner's public key is embedded
 * directly in the coin. Ownership starts at the miner and transfers via
 * encrypted mRNA envelopes.
 *
 * See PROTOCOL.md sections 2, 3, 8.
 */

import { sha256, BASES, STOP_CODONS } from "./dna";
import { ribosome } from "./ribosome";
import {
  signWithDNA, verifyWithDNA, derivePublicKeyDNA,
} from "./ed25519-dna";
import {
  mineCoinDna256, type MiningResult,
} from "./miner";
import {
  powLayerDna256, countLeadingTs,
} from "./dna256";
import {
  PROTOCOL_VERSION,
  GENESIS_GENOME_FINGERPRINT,
  V1_MIN_LEADING_TS,
} from "./genesis";
import { COIN_GENE_HEADER } from "./wallet";

/**
 * v1 reward schedule (Bitcoin-style halving).
 * HALVING_INTERVAL solves per era, reward halves each era, floor of 1.
 * Kept here (not just in the frontend) so the core protocol can enforce
 * batchSize against the schedule independently of any UI.
 */
export const INITIAL_REWARD = 50;
export const HALVING_INTERVAL = 210_000;
export const MAX_SUPPLY = 21_000_000;

export function rewardForSolve(solveSeq0Based: number): number {
  const era = Math.floor(Math.max(0, solveSeq0Based) / HALVING_INTERVAL);
  return Math.max(1, Math.floor(INITIAL_REWARD / Math.pow(2, era)));
}

/**
 * A fully signed v1 coin. This is the canonical wire format.
 *
 * Batch-mint extension (since v1.1):
 *   A single proof-of-work can amortize its reward across `batchSize` coins.
 *   One of them — the "parent" — carries the actual PoW. The rest are
 *   "children": same miner pubkey, no PoW of their own, identified by
 *   `batchParent` (= parent's serialHash) and `batchIndex` ∈ [1..batchSize-1].
 *   The parent itself has `batchIndex = 0` and `batchParent = ""` (empty).
 *   Standalone (pre-batch) coins simply omit all three fields; they remain
 *   valid under the original rules.
 */
export interface CoinV1 {
  protocolVersion: 1;
  networkGenomeFingerprint: string;
  coinGene: string;
  serial: string;
  serialHash: string;
  miningProof: {
    nonce: number;
    leadingTs: number;
  };
  minerPubKeyDNA: string;
  minerSignatureDNA: string;
  minedAt: number;
  /** serialHash of the PoW-carrying parent; "" or undefined for parent/standalone. */
  batchParent?: string;
  /** 0 for parent, 1..batchSize-1 for children. undefined for standalone. */
  batchIndex?: number;
  /** Total coins in this batch (>= 1). undefined for standalone. */
  batchSize?: number;
}

/**
 * Canonical signing message for a standalone or parent coin.
 * Byte-for-byte identical to pre-batch protocol.
 */
export function coinV1SigningMessage(
  serialHash: string,
  networkGenomeFingerprint: string,
  minerPubKeyDNA: string,
): string {
  return serialHash + "|" + networkGenomeFingerprint + "|" + minerPubKeyDNA;
}

/**
 * Canonical signing message for a batch child coin.
 * Binds the child to its parent coin and its index so a child signature cannot
 * be lifted into a different batch.
 */
export function coinV1ChildSigningMessage(
  serialHash: string,
  networkGenomeFingerprint: string,
  minerPubKeyDNA: string,
  batchParentSerialHash: string,
  batchIndex: number,
  batchSize: number,
): string {
  return (
    serialHash + "|" +
    networkGenomeFingerprint + "|" +
    minerPubKeyDNA + "|child|" +
    batchParentSerialHash + "|" +
    batchIndex + "/" + batchSize
  );
}

/**
 * Sign a freshly-mined MiningResult with a miner's wallet key.
 * The miner's public key is embedded; no network key is involved.
 */
export function signCoinWithMiner(
  miningResult: MiningResult,
  minerPrivateKeyDNA: string,
  networkGenomeFingerprint: string = GENESIS_GENOME_FINGERPRINT,
): CoinV1 {
  const minerPubKeyDNA = derivePublicKeyDNA(minerPrivateKeyDNA);
  const msg = coinV1SigningMessage(
    miningResult.serialHash,
    networkGenomeFingerprint,
    minerPubKeyDNA,
  );
  const minerSignatureDNA = signWithDNA(msg, minerPrivateKeyDNA);

  const leadingTs = parseLeadingTsFromDifficulty(miningResult.difficulty);

  return {
    protocolVersion: PROTOCOL_VERSION,
    networkGenomeFingerprint,
    coinGene: miningResult.coinGene,
    serial: miningResult.serial,
    serialHash: miningResult.serialHash,
    miningProof: {
      nonce: miningResult.nonce,
      leadingTs,
    },
    minerPubKeyDNA,
    minerSignatureDNA,
    minedAt: miningResult.minedAt,
  };
}

/**
 * Mine + sign in a single call. Convenience for wallets and the C miner
 * reference port.
 */
export function mineAndSignCoinV1(params: {
  minerPrivateKeyDNA: string;
  leadingTs?: number;
  networkGenomeFingerprint?: string;
  bodyLength?: number;
}): CoinV1 {
  const lt = Math.max(V1_MIN_LEADING_TS, params.leadingTs ?? V1_MIN_LEADING_TS);
  const result = mineCoinDna256(lt, params.bodyLength);
  return signCoinWithMiner(
    result,
    params.minerPrivateKeyDNA,
    params.networkGenomeFingerprint ?? GENESIS_GENOME_FINGERPRINT,
  );
}

/**
 * Whether a CoinV1 is a child in a batch mint (PoW is on its parent).
 */
export function isBatchChild(coin: CoinV1): boolean {
  return typeof coin.batchParent === "string" && coin.batchParent.length > 0;
}

/**
 * Derive a deterministic, valid coinGene for a child coin.
 *
 * The child gene is NOT PoW-valid (by design — children don't carry PoW).
 * It must, however, be a well-formed coinGene: start with COIN_GENE_HEADER,
 * contain no stray start/stop codons in the body, and end with a stop codon,
 * so the ribosome can decode a protein whose acids match the child's serial.
 *
 * Uniqueness across a batch is achieved by seeding with
 *   (parentSerialHash | batchIndex | minerPubKeyDNA)
 * and expanding with sha256 until we have enough codons.
 */
function deriveChildGene(
  parentSerialHash: string,
  batchIndex: number,
  minerPubKeyDNA: string,
  bodyCodons: number = 40,
): string {
  const seed = parentSerialHash + "|" + batchIndex + "|" + minerPubKeyDNA;
  let codons: string[] = [];
  let round = 0;
  while (codons.length < bodyCodons) {
    const h = sha256(seed + "|" + round);
    // 64 hex chars = 32 bytes; map each byte to one of 4 bases
    for (let i = 0; i < h.length && codons.length < bodyCodons; i += 3) {
      const a = BASES[parseInt(h[i] || "0", 16) % 4];
      const b = BASES[parseInt(h[i + 1] || "0", 16) % 4];
      const c = BASES[parseInt(h[i + 2] || "0", 16) % 4];
      const codon = a + b + c;
      if (codon === "ATG" || STOP_CODONS.has(codon)) continue;
      codons.push(codon);
    }
    round++;
    if (round > 64) break;
  }
  return COIN_GENE_HEADER + codons.join("") + "TAA";
}

/**
 * Sign a single batch child coin. The parent must already be fully signed
 * (use `signCoinWithMiner` or `mineAndSignCoinV1` to produce it).
 *
 * Children share the parent's miner pubkey, genome fingerprint, and mining
 * proof metadata (nonce / leadingTs) for convenience — but verification of
 * children deliberately skips the PoW check and instead binds the child to
 * the parent via `batchParent` in the signed message.
 */
export function signBatchChild(params: {
  parent: CoinV1;
  batchIndex: number;
  batchSize: number;
  minerPrivateKeyDNA: string;
  networkGenomeFingerprint?: string;
}): CoinV1 {
  const { parent, batchIndex, batchSize, minerPrivateKeyDNA } = params;
  const minerPubKeyDNA = derivePublicKeyDNA(minerPrivateKeyDNA);
  if (minerPubKeyDNA !== parent.minerPubKeyDNA) {
    throw new Error("child miner key must match parent miner key");
  }
  if (batchIndex < 1 || batchIndex >= batchSize) {
    throw new Error("batchIndex out of range (must be 1..batchSize-1)");
  }

  const networkGenomeFingerprint =
    params.networkGenomeFingerprint ?? parent.networkGenomeFingerprint;

  const gene = deriveChildGene(parent.serialHash, batchIndex, minerPubKeyDNA);
  const rib = ribosome(gene);
  const protein = rib.proteins[0];
  if (!protein) {
    throw new Error("derived child gene has no protein — retry with different seed");
  }
  const serial = protein.aminoAcids.slice(4).join("-");
  const serialHash = sha256(serial);

  const msg = coinV1ChildSigningMessage(
    serialHash,
    networkGenomeFingerprint,
    minerPubKeyDNA,
    parent.serialHash,
    batchIndex,
    batchSize,
  );
  const minerSignatureDNA = signWithDNA(msg, minerPrivateKeyDNA);

  return {
    protocolVersion: PROTOCOL_VERSION,
    networkGenomeFingerprint,
    coinGene: gene,
    serial,
    serialHash,
    miningProof: {
      nonce: parent.miningProof.nonce,
      leadingTs: parent.miningProof.leadingTs,
    },
    minerPubKeyDNA,
    minerSignatureDNA,
    minedAt: parent.minedAt,
    batchParent: parent.serialHash,
    batchIndex,
    batchSize,
  };
}

/**
 * Produce a full batch of `batchSize` coins from a single PoW event.
 * The parent is signed as a normal standalone coin but also carries
 * `batchIndex=0, batchSize=N, batchParent=""`; children are signed child-style.
 * Caller is expected to submit the batch atomically to a tracker.
 */
export function mintBatch(params: {
  minerPrivateKeyDNA: string;
  batchSize: number;
  leadingTs?: number;
  networkGenomeFingerprint?: string;
  bodyLength?: number;
}): { parent: CoinV1; children: CoinV1[]; coins: CoinV1[] } {
  if (!Number.isInteger(params.batchSize) || params.batchSize < 1) {
    throw new Error("batchSize must be a positive integer");
  }
  const minerPubKeyDNA = derivePublicKeyDNA(params.minerPrivateKeyDNA);
  const lt = Math.max(V1_MIN_LEADING_TS, params.leadingTs ?? V1_MIN_LEADING_TS);
  const mineResult = mineCoinDna256(lt, params.bodyLength);

  const fp = params.networkGenomeFingerprint ?? GENESIS_GENOME_FINGERPRINT;
  const parentMsg = coinV1SigningMessage(mineResult.serialHash, fp, minerPubKeyDNA);
  const parentSig = signWithDNA(parentMsg, params.minerPrivateKeyDNA);

  const parent: CoinV1 = {
    protocolVersion: PROTOCOL_VERSION,
    networkGenomeFingerprint: fp,
    coinGene: mineResult.coinGene,
    serial: mineResult.serial,
    serialHash: mineResult.serialHash,
    miningProof: {
      nonce: mineResult.nonce,
      leadingTs: parseLeadingTsFromDifficulty(mineResult.difficulty),
    },
    minerPubKeyDNA,
    minerSignatureDNA: parentSig,
    minedAt: mineResult.minedAt,
    batchParent: "",
    batchIndex: 0,
    batchSize: params.batchSize,
  };

  const children: CoinV1[] = [];
  for (let i = 1; i < params.batchSize; i++) {
    children.push(signBatchChild({
      parent,
      batchIndex: i,
      batchSize: params.batchSize,
      minerPrivateKeyDNA: params.minerPrivateKeyDNA,
      networkGenomeFingerprint: fp,
    }));
  }
  return { parent, children, coins: [parent, ...children] };
}

/**
 * Full validation of a v1 coin (see PROTOCOL.md §3).
 *
 * Standalone & parent coins require a valid PoW.
 * Batch-child coins require the parent to be passed in `opts.parent` and
 * are verified against it (signature + batch metadata), with NO PoW check.
 */
export function verifyCoinV1(
  coin: CoinV1,
  opts: { expectedGenomeFingerprint?: string; parent?: CoinV1 } = {},
): { ok: true } | { ok: false; reason: string } {
  const expectedFp =
    opts.expectedGenomeFingerprint ?? GENESIS_GENOME_FINGERPRINT;

  if (!coin || typeof coin !== "object") {
    return { ok: false, reason: "coin not an object" };
  }
  if (coin.protocolVersion !== PROTOCOL_VERSION) {
    return { ok: false, reason: `wrong protocolVersion (expected ${PROTOCOL_VERSION})` };
  }
  if (coin.networkGenomeFingerprint !== expectedFp) {
    return { ok: false, reason: "wrong networkGenomeFingerprint" };
  }
  if (typeof coin.coinGene !== "string" || coin.coinGene.length < 12) {
    return { ok: false, reason: "invalid coinGene" };
  }
  if (typeof coin.serial !== "string" || typeof coin.serialHash !== "string") {
    return { ok: false, reason: "invalid serial" };
  }

  const rib = ribosome(coin.coinGene);
  const protein = rib.proteins[0];
  if (!protein) return { ok: false, reason: "no protein in gene" };
  const expectedSerial = protein.aminoAcids.slice(4).join("-");
  if (expectedSerial !== coin.serial) {
    return { ok: false, reason: "serial does not match gene" };
  }
  if (sha256(coin.serial) !== coin.serialHash) {
    return { ok: false, reason: "serialHash mismatch" };
  }

  if (typeof coin.minerPubKeyDNA !== "string" || coin.minerPubKeyDNA.length !== 128) {
    return { ok: false, reason: "invalid minerPubKeyDNA (expected 128 bases)" };
  }
  if (typeof coin.minerSignatureDNA !== "string" || coin.minerSignatureDNA.length !== 256) {
    return { ok: false, reason: "invalid minerSignatureDNA (expected 256 bases)" };
  }

  const asChild = isBatchChild(coin);

  if (asChild) {
    // Batch-child: no own PoW, signature binds to parent.
    if (!opts.parent) {
      return { ok: false, reason: "batch child requires parent for verification" };
    }
    if (opts.parent.serialHash !== coin.batchParent) {
      return { ok: false, reason: "parent serialHash does not match batchParent" };
    }
    if (opts.parent.minerPubKeyDNA !== coin.minerPubKeyDNA) {
      return { ok: false, reason: "parent/child miner pubkey mismatch" };
    }
    if (isBatchChild(opts.parent)) {
      return { ok: false, reason: "parent cannot itself be a batch child" };
    }
    if (typeof coin.batchSize !== "number"
        || typeof coin.batchIndex !== "number"
        || coin.batchSize < 1
        || coin.batchIndex < 1
        || coin.batchIndex >= coin.batchSize) {
      return { ok: false, reason: "invalid batch metadata on child" };
    }
    if (opts.parent.batchSize !== coin.batchSize) {
      return { ok: false, reason: "child/parent batchSize disagree" };
    }
    const msg = coinV1ChildSigningMessage(
      coin.serialHash,
      coin.networkGenomeFingerprint,
      coin.minerPubKeyDNA,
      coin.batchParent!,
      coin.batchIndex,
      coin.batchSize,
    );
    if (!verifyWithDNA(msg, coin.minerSignatureDNA, coin.minerPubKeyDNA)) {
      return { ok: false, reason: "child miner signature invalid" };
    }
    return { ok: true };
  }

  // Standalone or parent: full PoW verification.
  if (!coin.miningProof
      || typeof coin.miningProof.nonce !== "number"
      || typeof coin.miningProof.leadingTs !== "number") {
    return { ok: false, reason: "invalid miningProof" };
  }
  if (coin.miningProof.leadingTs < V1_MIN_LEADING_TS) {
    return { ok: false, reason: `leadingTs below floor (${V1_MIN_LEADING_TS})` };
  }
  const strand = powLayerDna256(coin.coinGene, coin.miningProof.nonce);
  if (countLeadingTs(strand) < coin.miningProof.leadingTs) {
    return { ok: false, reason: "PoW does not meet stated leadingTs" };
  }

  const msg = coinV1SigningMessage(
    coin.serialHash,
    coin.networkGenomeFingerprint,
    coin.minerPubKeyDNA,
  );
  if (!verifyWithDNA(msg, coin.minerSignatureDNA, coin.minerPubKeyDNA)) {
    return { ok: false, reason: "miner signature invalid" };
  }

  // Parent-of-batch: batchIndex must be 0 and batchParent must be empty.
  if (typeof coin.batchSize === "number") {
    if (coin.batchSize < 1) return { ok: false, reason: "batchSize must be >=1" };
    if ((coin.batchIndex ?? 0) !== 0) {
      return { ok: false, reason: "parent batchIndex must be 0" };
    }
    if (coin.batchParent && coin.batchParent.length > 0) {
      return { ok: false, reason: "parent batchParent must be empty" };
    }
  }

  return { ok: true };
}

/**
 * Verify a full batch (parent + children) atomically.
 * Returns per-coin results so the tracker can accept/reject uniformly.
 */
export function verifyBatchV1(
  parent: CoinV1,
  children: CoinV1[],
  opts: { expectedGenomeFingerprint?: string } = {},
): { ok: true } | { ok: false; reason: string; failedIndex?: number } {
  const p = verifyCoinV1(parent, opts);
  if (!p.ok) return { ok: false, reason: "parent: " + p.reason };
  const expectedSize = parent.batchSize ?? 1;
  if (children.length + 1 !== expectedSize) {
    return { ok: false, reason: `batchSize mismatch (parent says ${expectedSize}, got ${children.length + 1})` };
  }
  const seenIndices = new Set<number>([0]);
  const seenSerials = new Set<string>([parent.serialHash]);
  for (let i = 0; i < children.length; i++) {
    const c = children[i];
    const r = verifyCoinV1(c, { ...opts, parent });
    if (!r.ok) return { ok: false, reason: `child[${i}]: ${r.reason}`, failedIndex: i };
    if (seenIndices.has(c.batchIndex!)) {
      return { ok: false, reason: `duplicate batchIndex ${c.batchIndex}`, failedIndex: i };
    }
    seenIndices.add(c.batchIndex!);
    if (seenSerials.has(c.serialHash)) {
      return { ok: false, reason: `duplicate serialHash in batch`, failedIndex: i };
    }
    seenSerials.add(c.serialHash);
  }
  return { ok: true };
}

/**
 * Convenience boolean wrapper.
 */
export function isValidCoinV1(coin: CoinV1, expectedFp?: string): boolean {
  return verifyCoinV1(coin, { expectedGenomeFingerprint: expectedFp }).ok === true;
}

/**
 * Extract the leadingTs count from a legacy MiningResult.difficulty string.
 * mineCoinDna256 stores difficulty as the leading-T portion of the target, so
 * its length is exactly the leadingTs count.
 */
function parseLeadingTsFromDifficulty(difficulty: string): number {
  if (!difficulty) return V1_MIN_LEADING_TS;
  let count = 0;
  for (const ch of difficulty) {
    if (ch === "T") count++;
    else break;
  }
  return Math.max(V1_MIN_LEADING_TS, count);
}
