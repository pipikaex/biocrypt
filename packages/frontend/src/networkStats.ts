/**
 * Tracker-backed derived statistics.
 *
 * Pre v1 we used to pull a single `NetworkStats` blob from the Nest server.
 * Under the genesis-anchor model there is no central network DNA anymore —
 * the tracker only knows about mints and spends. This module derives the
 * same surface the UI has always expected, using a combination of the
 * tracker `/summary` + `/genome` endpoints and the hard-coded v1 protocol
 * constants shipped in @biocrypt/core.
 */
import {
  GENESIS_NETWORK_ID,
  GENESIS_GENOME_FINGERPRINT,
  GENESIS_LEADING_TS,
} from "@biocrypt/core";
import {
  trackerHttp,
  type TrackerSummary,
  type TrackerGenome,
} from "./trackerClient";

export const MAX_SUPPLY = 21_000_000;
export const HALVING_INTERVAL = 210_000;
export const INITIAL_REWARD = 50;

const ERA_NAMES = [
  "Genesis", "Growth", "Expansion", "Maturity", "Stability",
  "Consolidation", "Scarcity", "Twilight", "Final", "Senescence",
];

export interface DerivedNetworkStats {
  networkId: string;
  networkGenome: string;
  genomeFingerprint: string;
  difficulty: string;
  difficultyTarget: string;
  dnaLeadingTs: number;
  totalCoins: number;
  totalSpent: number;
  circulatingSupply: number;
  burnedCoins: number;
  last24h: number;
  pendingEnvelopes: number;
  peers: number;
  nullifiers: number;
  totalSubmissions: number;
  currentReward: number;
  halvingEra: number;
  halvingEraName: string;
  coinsUntilHalving: number;
  telomereLength: number;
  telomerePercent: number;
  maxSupply: number;
  trackerId: string;
  protocolVersion: number;
}

export function blockRewardFor(totalMinted: number): number {
  const era = Math.floor(totalMinted / HALVING_INTERVAL);
  return Math.max(1, Math.floor(INITIAL_REWARD / Math.pow(2, era)));
}

export function halvingEraFor(totalMinted: number): number {
  return Math.floor(totalMinted / HALVING_INTERVAL);
}

export function deriveStats(
  summary: TrackerSummary,
  genome: TrackerGenome,
): DerivedNetworkStats {
  const totalCoins = summary.totalMinted ?? 0;
  const totalSpent = summary.totalSpent ?? 0;
  const burnedCoins = totalSpent;
  const era = halvingEraFor(totalCoins);
  const telomereLength = Math.max(0, MAX_SUPPLY - totalCoins);
  const leadingTs = genome.leadingTs ?? GENESIS_LEADING_TS;

  return {
    networkId: genome.networkId || GENESIS_NETWORK_ID,
    networkGenome: genome.genomeFingerprint,
    genomeFingerprint: genome.genomeFingerprint || GENESIS_GENOME_FINGERPRINT,
    difficulty: "0".repeat(Math.max(1, Math.ceil(leadingTs / 2))),
    difficultyTarget: "f".repeat(Math.max(1, 64 - Math.ceil(leadingTs / 2))),
    dnaLeadingTs: leadingTs,
    totalCoins,
    totalSpent,
    circulatingSupply: Math.max(0, totalCoins - burnedCoins),
    burnedCoins,
    last24h: summary.last24h ?? 0,
    pendingEnvelopes: summary.pendingEnvelopes ?? 0,
    peers: summary.peers ?? 0,
    nullifiers: totalSpent,
    totalSubmissions: totalCoins,
    currentReward: blockRewardFor(totalCoins),
    halvingEra: era,
    halvingEraName: ERA_NAMES[Math.min(era, ERA_NAMES.length - 1)],
    coinsUntilHalving: HALVING_INTERVAL - (totalCoins % HALVING_INTERVAL),
    telomereLength,
    telomerePercent: (telomereLength / MAX_SUPPLY) * 100,
    maxSupply: MAX_SUPPLY,
    trackerId: summary.trackerId,
    protocolVersion: genome.protocolVersion || 1,
  };
}

/**
 * Fetch the current tracker summary + genome, derive the UI stats shape.
 * Returns null-friendly values when the tracker is unreachable so call sites
 * can keep their skeletons / offline placeholders.
 */
export async function fetchDerivedStats(): Promise<DerivedNetworkStats | null> {
  try {
    const [summary, genome] = await Promise.all([
      trackerHttp.summary(),
      trackerHttp.genome(),
    ]);
    return deriveStats(summary, genome);
  } catch {
    return null;
  }
}
