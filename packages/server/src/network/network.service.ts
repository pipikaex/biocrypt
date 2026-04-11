import { Injectable, OnModuleInit, Inject, forwardRef } from "@nestjs/common";
import {
  generateDNA, sha256, integrateCoinIntoWallet,
  leadingZerosToTarget, targetToPrefix,
} from "@zcoin/core";
import * as fs from "fs";
import * as path from "path";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const NETWORK_FILE = path.join(DATA_DIR, "network.json");

const INITIAL_LEADING_ZEROS = parseInt(process.env.INITIAL_DIFFICULTY_ZEROS || "5", 10);
const ADJUSTMENT_INTERVAL = parseInt(process.env.DIFFICULTY_ADJUSTMENT_INTERVAL || "10", 10);
const TARGET_BLOCK_TIME_MS = parseInt(process.env.TARGET_BLOCK_TIME_MS || "60000", 10);
const MAX_ADJUSTMENT_FACTOR = 4;

@Injectable()
export class NetworkService implements OnModuleInit {
  private networkDNA: string;
  private networkId: string;
  private networkWalletDNA: string;
  private feeCoinCount = 0;
  private signedCoinCount = 0;

  private difficultyTarget: string;
  private epochStartTime: number;
  private epochSubmissions: number;
  private totalSubmissions: number;

  private walletService: any;
  private gossipService: any;
  private registryService: any;

  onModuleInit() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(NETWORK_FILE)) {
      const data = JSON.parse(fs.readFileSync(NETWORK_FILE, "utf-8"));
      this.networkDNA = data.networkDNA;
      this.networkId = data.networkId;
      this.networkWalletDNA = data.networkWalletDNA || data.networkDNA;
      this.feeCoinCount = data.feeCoinCount || 0;
      this.signedCoinCount = data.signedCoinCount || 0;
      this.difficultyTarget = data.difficultyTarget || leadingZerosToTarget(INITIAL_LEADING_ZEROS);
      this.epochStartTime = data.epochStartTime || Date.now();
      this.epochSubmissions = data.epochSubmissions || 0;
      this.totalSubmissions = data.totalSubmissions || 0;
      console.log(`Network loaded: ${this.networkId} (difficulty: ${this.getDifficultyPrefix()}, submissions: ${this.totalSubmissions})`);
    } else {
      this.networkDNA = generateDNA(6000);
      this.networkId = "zcoin-" + sha256(this.networkDNA).slice(0, 12);
      this.networkWalletDNA = generateDNA(6000);
      this.signedCoinCount = 0;
      this.difficultyTarget = leadingZerosToTarget(INITIAL_LEADING_ZEROS);
      this.epochStartTime = Date.now();
      this.epochSubmissions = 0;
      this.totalSubmissions = 0;
      this.persist();
      console.log(`Network created: ${this.networkId} (difficulty: ${this.getDifficultyPrefix()})`);
    }
  }

  private persist() {
    const data = JSON.stringify({
      networkDNA: this.networkDNA,
      networkId: this.networkId,
      networkWalletDNA: this.networkWalletDNA,
      feeCoinCount: this.feeCoinCount,
      signedCoinCount: this.signedCoinCount,
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
   * Every ADJUSTMENT_INTERVAL submissions, compare actual elapsed time
   * against expected time and adjust the target proportionally, capped at 4x.
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

  getDifficultyTarget(): string {
    return this.difficultyTarget;
  }

  getDifficultyPrefix(): string {
    return targetToPrefix(this.difficultyTarget);
  }

  getTotalSubmissions(): number {
    return this.totalSubmissions;
  }

  incrementSignedCoins(): void {
    this.signedCoinCount++;
  }

  getSignedCoinCount(): number {
    return this.signedCoinCount;
  }

  getEpochProgress(): { current: number; interval: number } {
    return { current: this.epochSubmissions, interval: ADJUSTMENT_INTERVAL };
  }

  setServices(wallet: any, gossip: any, registry: any) {
    this.walletService = wallet;
    this.gossipService = gossip;
    this.registryService = registry;
  }

  mintNetworkFeeCoin(miningService: any): void {
    const coin = miningService.mineAndSign();
    this.networkWalletDNA = integrateCoinIntoWallet(this.networkWalletDNA, coin);
    this.feeCoinCount++;
    this.persist();
    console.log(`Network fee coin minted (#${this.feeCoinCount})`);
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
    };
  }

  getStats() {
    const WALLETS_DIR = path.join(DATA_DIR, "wallets");
    let totalWallets = 0;
    let totalCoins = 0;

    if (fs.existsSync(WALLETS_DIR)) {
      const files = fs.readdirSync(WALLETS_DIR).filter((f) => f.endsWith(".json"));
      totalWallets = files.length;
      for (const file of files) {
        try {
          const w = JSON.parse(fs.readFileSync(path.join(WALLETS_DIR, file), "utf-8"));
          const matches = (w.dna as string).match(/ATGGGGTGGTGC/g);
          if (matches) totalCoins += matches.length;
        } catch {}
      }
    }

    totalCoins += this.feeCoinCount + this.signedCoinCount;

    let peers = 0;
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
      dnaLength: this.networkDNA.length,
      dnaHash: sha256(this.networkDNA),
      difficulty: this.getDifficultyPrefix(),
      difficultyTarget: this.difficultyTarget,
      totalWallets,
      totalCoins,
      totalSubmissions: this.totalSubmissions,
      epochProgress: `${epoch.current}/${epoch.interval}`,
      nextAdjustmentIn: epoch.interval - epoch.current,
      peers,
      nullifiers,
      feeCoinCount: this.feeCoinCount,
    };
  }
}
