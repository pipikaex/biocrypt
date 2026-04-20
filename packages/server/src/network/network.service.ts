import { Injectable, OnModuleInit, Inject, forwardRef } from "@nestjs/common";
import {
  generateDNA, sha256, integrateCoinGene,
  leadingZerosToTarget, targetToPrefix,
  ribosome, analyzeProtein, isCoinProtein, getCoinSerial,
  generateNetworkKeyPair, derivePublicKeyDNA,
  DEFAULT_BODY_LENGTH,
  generateNetworkFingerprint, generateCoinRFLP, type RFLPFingerprint,
} from "@biocrypt/core";
import * as fs from "fs";
import * as path from "path";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const NETWORK_FILE = path.join(DATA_DIR, "network.json");

const INITIAL_LEADING_ZEROS = parseInt(process.env.INITIAL_DIFFICULTY_ZEROS || "9", 10);
const ADJUSTMENT_INTERVAL = parseInt(process.env.DIFFICULTY_ADJUSTMENT_INTERVAL || "2016", 10);
const TARGET_BLOCK_TIME_MS = parseInt(process.env.TARGET_BLOCK_TIME_MS || "60000", 10);
const MAX_ADJUSTMENT_FACTOR = 2;

const MAX_SUPPLY = 21_000_000;
const HALVING_INTERVAL = 210_000;
const INITIAL_REWARD = 50;
const TELOMERE_REPEAT = "TTAGGG";
const TELOMERE_INITIAL_REPEATS = MAX_SUPPLY;

const ERA_NAMES = [
  "Genesis", "Growth", "Expansion", "Maturity", "Stability",
  "Consolidation", "Scarcity", "Twilight", "Final", "Senescence",
];

@Injectable()
export class NetworkService implements OnModuleInit {
  private networkDNA: string;
  private networkId: string;
  private networkWalletDNA: string;
  private networkPrivateKeyDNA: string;
  private networkGenome: string;
  private feeCoinCount = 0;
  private signedCoinCount = 0;
  private burnedCoins = 0;
  private totalMinedCoins = 0;

  private signedSerialHashes = new Set<string>();

  private difficultyTarget: string;
  private epochStartTime: number;
  private epochSubmissions: number;
  private totalSubmissions: number;

  private telomereRepeats: number;

  private walletService: any;
  private gossipService: any;
  private registryService: any;

  private activeMiners = new Map<string, number>();
  private readonly MINER_WINDOW_MS = 10 * 60 * 1000;

  onModuleInit() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(NETWORK_FILE)) {
      let data: any;
      try {
        data = JSON.parse(fs.readFileSync(NETWORK_FILE, "utf-8"));
      } catch (e) {
        console.error("CRITICAL: network.json is corrupt, starting fresh network:", e);
        data = null;
      }
      if (!data) {
        this.createFreshNetwork();
        return;
      }
      this.networkDNA = data.networkDNA;
      this.networkId = data.networkId;
      this.networkWalletDNA = data.networkWalletDNA || data.networkDNA;
      this.feeCoinCount = data.feeCoinCount || 0;
      this.signedCoinCount = data.signedCoinCount || 0;
      this.burnedCoins = data.burnedCoins || 0;
      this.totalMinedCoins = data.totalMinedCoins ?? (this.feeCoinCount + this.signedCoinCount);
      this.difficultyTarget = data.difficultyTarget || leadingZerosToTarget(INITIAL_LEADING_ZEROS);
      this.epochStartTime = data.epochStartTime || Date.now();
      this.epochSubmissions = data.epochSubmissions || 0;
      this.totalSubmissions = data.totalSubmissions || 0;
      this.telomereRepeats = data.telomereRepeats ?? TELOMERE_INITIAL_REPEATS;

      if (data.networkPrivateKeyDNA && data.networkGenome) {
        this.networkPrivateKeyDNA = data.networkPrivateKeyDNA;
        this.networkGenome = data.networkGenome;
      } else {
        const keyPair = generateNetworkKeyPair();
        this.networkPrivateKeyDNA = keyPair.privateKeyDNA;
        this.networkGenome = keyPair.publicKeyDNA;
        this.networkId = "biocrypt-" + sha256(this.networkGenome).slice(0, 12);
        this.persist();
        console.log(`Network upgraded with Ed25519 keypair: ${this.networkId}`);
      }

      if (data.signedSerialHashes) {
        this.signedSerialHashes = new Set(data.signedSerialHashes);
      }

      console.log(`Network loaded: ${this.networkId} (difficulty: ${this.getDifficultyPrefix()}, submissions: ${this.totalSubmissions}, signed: ${this.signedSerialHashes.size})`);
    } else {
      this.createFreshNetwork();
    }
  }

  private createFreshNetwork() {
    this.networkDNA = generateDNA(6000);
    this.networkWalletDNA = generateDNA(6000);

    const keyPair = generateNetworkKeyPair();
    this.networkPrivateKeyDNA = keyPair.privateKeyDNA;
    this.networkGenome = keyPair.publicKeyDNA;
    this.networkId = "biocrypt-" + sha256(this.networkGenome).slice(0, 12);

    this.signedCoinCount = 0;
    this.burnedCoins = 0;
    this.totalMinedCoins = 0;
    this.telomereRepeats = TELOMERE_INITIAL_REPEATS;
    this.difficultyTarget = leadingZerosToTarget(INITIAL_LEADING_ZEROS);
    this.epochStartTime = Date.now();
    this.epochSubmissions = 0;
    this.totalSubmissions = 0;
    this.signedSerialHashes = new Set();
    this.persist();
    console.log(`Network created: ${this.networkId} (difficulty: ${this.getDifficultyPrefix()}, supply cap: ${MAX_SUPPLY.toLocaleString()}, reward: ${INITIAL_REWARD})`);
  }

  private persist() {
    const data = JSON.stringify({
      networkDNA: this.networkDNA,
      networkId: this.networkId,
      networkWalletDNA: this.networkWalletDNA,
      networkPrivateKeyDNA: this.networkPrivateKeyDNA,
      networkGenome: this.networkGenome,
      feeCoinCount: this.feeCoinCount,
      signedCoinCount: this.signedCoinCount,
      burnedCoins: this.burnedCoins,
      totalMinedCoins: this.totalMinedCoins,
      telomereRepeats: this.telomereRepeats,
      signedSerialHashes: Array.from(this.signedSerialHashes),
      difficultyTarget: this.difficultyTarget,
      epochStartTime: this.epochStartTime,
      epochSubmissions: this.epochSubmissions,
      totalSubmissions: this.totalSubmissions,
      createdAt: Date.now(),
    });
    const tmpFile = NETWORK_FILE + ".tmp";
    fs.writeFileSync(tmpFile, data);
    fs.renameSync(tmpFile, NETWORK_FILE);
  }

  /**
   * Bitcoin-style difficulty adjustment.
   */
  recordSubmission(): { adjusted: boolean; oldPrefix?: string; newPrefix?: string } {
    this.epochSubmissions++;
    this.totalSubmissions++;

    if (this.epochSubmissions < ADJUSTMENT_INTERVAL) {
      this.persist();
      return { adjusted: false };
    }

    const actualTimeMs = Date.now() - this.epochStartTime;
    const expectedTimeMs = ADJUSTMENT_INTERVAL * TARGET_BLOCK_TIME_MS;

    let factor = actualTimeMs / expectedTimeMs;
    factor = Math.max(1 / MAX_ADJUSTMENT_FACTOR, Math.min(MAX_ADJUSTMENT_FACTOR, factor));

    const oldPrefix = this.getDifficultyPrefix();

    const currentBig = BigInt("0x" + this.difficultyTarget);
    let newBig = (currentBig * BigInt(Math.round(factor * 10000))) / 10000n;

    const maxTarget = BigInt("0x" + "f".repeat(64));
    const minTarget = 1n;
    if (newBig < minTarget) newBig = minTarget;
    if (newBig > maxTarget) newBig = maxTarget;

    this.difficultyTarget = newBig.toString(16).padStart(64, "0");
    this.epochStartTime = Date.now();
    this.epochSubmissions = 0;

    const newPrefix = this.getDifficultyPrefix();
    this.persist();

    console.log(
      `Difficulty adjusted: ${oldPrefix} -> ${newPrefix} ` +
      `(factor: ${factor.toFixed(3)}, actual: ${(actualTimeMs / 1000).toFixed(0)}s, expected: ${(expectedTimeMs / 1000).toFixed(0)}s, total: ${this.totalSubmissions})`
    );

    return { adjusted: true, oldPrefix, newPrefix };
  }

  isSerialAlreadySigned(serialHash: string): boolean {
    return this.signedSerialHashes.has(serialHash);
  }

  registerSignedSerial(serialHash: string): void {
    this.signedSerialHashes.add(serialHash);
  }

  getDifficultyTarget(): string {
    return this.difficultyTarget;
  }

  getDifficultyPrefix(): string {
    return targetToPrefix(this.difficultyTarget);
  }

  getTotalSubmissions(): number {
    return this.totalSubmissions;
  }

  incrementSignedCoins(count: number = 1): void {
    this.signedCoinCount += count;
  }

  integrateCoinIntoNetworkDNA(coinGene: string): void {
    this.networkDNA = integrateCoinGene(this.networkDNA, coinGene);
    this.persist();
  }

  integrateCoinsIntoNetworkDNA(coinGenes: string[]): void {
    for (const gene of coinGenes) {
      this.networkDNA = integrateCoinGene(this.networkDNA, gene);
    }
    this.persist();
  }

  getSignedCoinCount(): number {
    return this.signedCoinCount;
  }

  getNetworkPrivateKeyDNA(): string {
    return this.networkPrivateKeyDNA;
  }

  getNetworkGenome(): string {
    return this.networkGenome;
  }

  recordMinerActivity(minerId: string): void {
    this.activeMiners.set(minerId, Date.now());
  }

  getActiveMinerCount(): number {
    const cutoff = Date.now() - this.MINER_WINDOW_MS;
    let count = 0;
    for (const [id, ts] of this.activeMiners) {
      if (ts >= cutoff) {
        count++;
      } else {
        this.activeMiners.delete(id);
      }
    }
    return count;
  }

  getEpochProgress(): { current: number; interval: number } {
    return { current: this.epochSubmissions, interval: ADJUSTMENT_INTERVAL };
  }

  getHalvingEra(): number {
    return Math.floor(this.totalSubmissions / HALVING_INTERVAL);
  }

  getCurrentBlockReward(): number {
    const era = this.getHalvingEra();
    return Math.floor(INITIAL_REWARD / Math.pow(2, era));
  }

  getCoinsUntilHalving(): number {
    return HALVING_INTERVAL - (this.totalSubmissions % HALVING_INTERVAL);
  }

  getHalvingEraName(): string {
    const era = this.getHalvingEra();
    return ERA_NAMES[Math.min(era, ERA_NAMES.length - 1)];
  }

  getTelomereRepeats(): number {
    return this.telomereRepeats;
  }

  getTelomerePercent(): number {
    return Math.round((this.telomereRepeats / TELOMERE_INITIAL_REPEATS) * 10000) / 100;
  }

  getMaxSupply(): number {
    return MAX_SUPPLY;
  }

  getCirculatingSupply(): number {
    return this.totalMinedCoins - this.burnedCoins;
  }

  getBurnedCoins(): number {
    return this.burnedCoins;
  }

  isSupplyExhausted(): boolean {
    return this.totalMinedCoins >= MAX_SUPPLY;
  }

  /**
   * Mint N coins for a single PoW submission (block reward).
   * Returns the number of coins actually minted (may be less if hitting cap).
   */
  consumeTelomere(coinsToMint: number): number {
    const remainingSupply = MAX_SUPPLY - this.totalMinedCoins;
    const actual = Math.min(coinsToMint, remainingSupply, this.telomereRepeats);
    if (actual <= 0) return 0;

    this.telomereRepeats -= actual;
    this.totalMinedCoins += actual;
    return actual;
  }

  incrementBurnedCoins(count: number = 1): void {
    this.burnedCoins += count;
    this.persist();
  }

  setServices(wallet: any, gossip: any, registry: any) {
    this.walletService = wallet;
    this.gossipService = gossip;
    this.registryService = registry;
  }

  mintNetworkFeeCoin(_miningService?: any): void {
    if (this.isSupplyExhausted()) return;
    const feeGene = this.generateFeeCoinGene();
    this.networkWalletDNA = integrateCoinGene(this.networkWalletDNA, feeGene);
    this.networkDNA = integrateCoinGene(this.networkDNA, feeGene);
    this.feeCoinCount++;
    this.totalMinedCoins++;
    this.persist();
    console.log(`Network fee coin minted (#${this.feeCoinCount}, total: ${this.totalMinedCoins})`);
  }

  private generateFeeCoinGene(): string {
    const COIN_HEADER = "ATGGGGTGGTGC";
    const BASES_ARR = ["T", "A", "C", "G"];
    const STOP = new Set(["TAA", "TAG", "TGA"]);
    let body = "";
    const bodyLen = DEFAULT_BODY_LENGTH;
    while (body.length < bodyLen) {
      const c = BASES_ARR[Math.floor(Math.random() * 4)]
        + BASES_ARR[Math.floor(Math.random() * 4)]
        + BASES_ARR[Math.floor(Math.random() * 4)];
      if (!STOP.has(c) && c !== "ATG") body += c;
    }
    const stamp = sha256(this.networkId + "|fee|" + Date.now() + "|" + this.feeCoinCount);
    let nonceCodons = "";
    for (let i = 0; i < 6; i++) {
      const val = parseInt(stamp.slice(i * 2, i * 2 + 2), 16) % 64;
      const b0 = BASES_ARR[(val >> 4) & 3];
      const b1 = BASES_ARR[(val >> 2) & 3];
      const b2 = BASES_ARR[val & 3];
      const cod = b0 + b1 + b2;
      nonceCodons += (STOP.has(cod) || cod === "ATG") ? "GCT" : cod;
    }
    return COIN_HEADER + body + nonceCodons + "TAA";
  }

  getNetworkRFLPFingerprint(): RFLPFingerprint {
    return generateNetworkFingerprint(this.networkDNA);
  }

  getNetworkDNA(): string {
    return this.networkDNA;
  }

  getNetworkId(): string {
    return this.networkId;
  }

  getNetworkInfo() {
    return {
      networkId: this.networkId,
      dnaLength: this.networkDNA.length,
      dnaHash: sha256(this.networkDNA),
      networkGenome: this.networkGenome,
    };
  }

  getDnaAnalysis() {
    const result = ribosome(this.networkDNA);
    const coins: {
      index: number;
      serial: string;
      serialHash: string;
      aminoAcids: string[];
      length: number;
      rflpFragments: number[];
      rflpMarkerCount: number;
      rflpMarkerDNA: string;
    }[] = [];
    const structuralProteins: {
      index: number;
      aminoAcids: string[];
      length: number;
      role: string;
      charge: number;
      polarity: number;
      hydrophobicity: number;
    }[] = [];

    for (const p of result.proteins) {
      if (isCoinProtein(p)) {
        const serial = getCoinSerial(p);
        const serialHash = sha256(serial);
        const rflp = generateCoinRFLP(this.networkPrivateKeyDNA, serialHash);
        coins.push({
          index: p.index,
          serial,
          serialHash,
          aminoAcids: p.aminoAcids,
          length: p.length,
          rflpFragments: rflp.fragments,
          rflpMarkerCount: rflp.markerCount,
          rflpMarkerDNA: rflp.markerDNA,
        });
      } else {
        const analysis = analyzeProtein(p);
        structuralProteins.push({
          index: p.index,
          aminoAcids: p.aminoAcids,
          length: p.length,
          role: analysis.dominantRole,
          charge: analysis.charge,
          polarity: Math.round(analysis.polarity * 100) / 100,
          hydrophobicity: Math.round(analysis.hydrophobicity * 100) / 100,
        });
      }
    }

    return {
      dna: this.networkDNA,
      dnaLength: this.networkDNA.length,
      dnaHash: sha256(this.networkDNA),
      totalProteins: result.proteins.length,
      totalCoins: coins.length,
      totalStructural: structuralProteins.length,
      intergenicRegions: result.intergenicRegions.length,
      publicKeyHash: result.publicKeyHash,
      coins,
      structuralProteins,
    };
  }

  getStats() {
    let nullifiers = 0;
    try {
      const REGISTRY_FILE = path.join(DATA_DIR, "nullifiers.json");
      if (fs.existsSync(REGISTRY_FILE)) {
        const data = JSON.parse(fs.readFileSync(REGISTRY_FILE, "utf-8"));
        nullifiers = data.nullifiers?.length || 0;
      }
    } catch {}

    const epoch = this.getEpochProgress();

    return {
      networkId: this.networkId,
      networkGenome: this.networkGenome,
      dnaLength: this.networkDNA.length,
      dnaHash: sha256(this.networkDNA),
      difficulty: this.getDifficultyPrefix(),
      difficultyTarget: this.difficultyTarget,
      totalWallets: this.getActiveMinerCount(),
      totalCoins: this.totalMinedCoins,
      totalSubmissions: this.totalSubmissions,
      epochProgress: `${epoch.current}/${epoch.interval}`,
      nextAdjustmentIn: epoch.interval - epoch.current,
      peers: this.getActiveMinerCount(),
      nullifiers,
      feeCoinCount: this.feeCoinCount,
      maxSupply: MAX_SUPPLY,
      currentReward: this.getCurrentBlockReward(),
      halvingEra: this.getHalvingEra(),
      halvingEraName: this.getHalvingEraName(),
      coinsUntilHalving: this.getCoinsUntilHalving(),
      telomereLength: this.telomereRepeats,
      telomerePercent: this.getTelomerePercent(),
      circulatingSupply: this.getCirculatingSupply(),
      burnedCoins: this.burnedCoins,
    };
  }
}
