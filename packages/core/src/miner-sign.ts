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

import { sha256 } from "./dna";
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

/**
 * A fully signed v1 coin. This is the canonical wire format.
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
}

/**
 * Compute the canonical signing message for a v1 coin.
 * Must match every implementation byte-for-byte (see PROTOCOL.md §3).
 */
export function coinV1SigningMessage(
  serialHash: string,
  networkGenomeFingerprint: string,
  minerPubKeyDNA: string,
): string {
  return serialHash + "|" + networkGenomeFingerprint + "|" + minerPubKeyDNA;
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
 * Full validation of a v1 coin (see PROTOCOL.md §3).
 * Returns { ok: true } or { ok: false, reason }.
 */
export function verifyCoinV1(
  coin: CoinV1,
  opts: { expectedGenomeFingerprint?: string } = {},
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

  if (typeof coin.minerPubKeyDNA !== "string" || coin.minerPubKeyDNA.length !== 128) {
    return { ok: false, reason: "invalid minerPubKeyDNA (expected 128 bases)" };
  }
  if (typeof coin.minerSignatureDNA !== "string" || coin.minerSignatureDNA.length !== 256) {
    return { ok: false, reason: "invalid minerSignatureDNA (expected 256 bases)" };
  }
  const msg = coinV1SigningMessage(
    coin.serialHash,
    coin.networkGenomeFingerprint,
    coin.minerPubKeyDNA,
  );
  if (!verifyWithDNA(msg, coin.minerSignatureDNA, coin.minerPubKeyDNA)) {
    return { ok: false, reason: "miner signature invalid" };
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
