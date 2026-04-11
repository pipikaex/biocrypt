import { Injectable, OnModuleInit } from "@nestjs/common";
import {
  createWallet, viewWallet, createMRNA, applyMRNA,
  deserializeMRNA, sha256, createNullifierProof,
} from "@zcoin/core";
import { WalletService } from "../wallet/wallet.service";
import { RegistryService } from "../registry/registry.service";
import { NetworkService } from "../network/network.service";
import * as fs from "fs";
import * as path from "path";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");

export interface Bet {
  id: string;
  title: string;
  options: string[];
  entries: BetEntry[];
  status: "open" | "closed" | "resolved";
  winningOption?: string;
  createdAt: number;
  resolvedAt?: number;
}

export interface BetEntry {
  walletPublicKeyHash: string;
  option: string;
  coinSerialHash: string;
  mrna: string;
  timestamp: number;
}

@Injectable()
export class BettingService implements OnModuleInit {
  private systemWalletId: string;
  private systemPrivateKey: string;
  private bets = new Map<string, Bet>();

  constructor(
    private walletService: WalletService,
    private registry: RegistryService,
    private network: NetworkService,
  ) {}

  onModuleInit() {
    const configFile = path.join(DATA_DIR, "betting-system.json");
    if (fs.existsSync(configFile)) {
      const data = JSON.parse(fs.readFileSync(configFile, "utf-8"));
      this.systemWalletId = data.walletId;
      this.systemPrivateKey = data.privateKey;
    } else {
      const { wallet, privateKeyDNA } = this.walletService.create();
      this.systemWalletId = wallet.id;
      this.systemPrivateKey = privateKeyDNA;
      if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(configFile, JSON.stringify({
        walletId: wallet.id,
        privateKey: privateKeyDNA,
      }));
    }
    console.log(`Betting system wallet: ${this.systemWalletId}`);
  }

  createBet(title: string, options: string[]): Bet {
    const id = sha256(title + Date.now()).slice(0, 12);
    const bet: Bet = { id, title, options, entries: [], status: "open", createdAt: Date.now() };
    this.bets.set(id, bet);
    return bet;
  }

  joinBet(betId: string, mrnaData: string, option: string, walletPublicKeyHash: string): BetEntry {
    const bet = this.bets.get(betId);
    if (!bet) throw new Error("Bet not found");
    if (bet.status !== "open") throw new Error("Bet is not open");
    if (!bet.options.includes(option)) throw new Error("Invalid option");

    const mrna = deserializeMRNA(mrnaData);

    if (this.registry.isCoinSpent(mrna.coinSerialHash)) {
      throw new Error("Coin already spent");
    }

    // Apply mRNA to system wallet (parasitic integration)
    const systemWallet = this.walletService.getById(this.systemWalletId);
    if (!systemWallet) throw new Error("System wallet error");

    const newDNA = applyMRNA(systemWallet.dna, mrna);
    this.walletService.updateDNA(this.systemWalletId, newDNA);

    const entry: BetEntry = {
      walletPublicKeyHash,
      option,
      coinSerialHash: mrna.coinSerialHash,
      mrna: mrnaData,
      timestamp: Date.now(),
    };
    bet.entries.push(entry);

    return entry;
  }

  resolveBet(betId: string, winningOption: string): {
    winners: string[];
    totalPot: number;
    coinsPerWinner: number;
  } {
    const bet = this.bets.get(betId);
    if (!bet) throw new Error("Bet not found");
    if (bet.status !== "open") throw new Error("Bet already resolved");

    bet.winningOption = winningOption;
    bet.status = "resolved";
    bet.resolvedAt = Date.now();

    const winners = bet.entries.filter((e) => e.option === winningOption);
    const losers = bet.entries.filter((e) => e.option !== winningOption);

    return {
      winners: winners.map((w) => w.walletPublicKeyHash),
      totalPot: bet.entries.length,
      coinsPerWinner: winners.length > 0
        ? Math.floor(bet.entries.length / winners.length)
        : 0,
    };
  }

  getBet(betId: string): Bet | undefined {
    return this.bets.get(betId);
  }

  listBets(): Bet[] {
    return Array.from(this.bets.values());
  }

  getSystemBalance(): number {
    const view = this.walletService.view(this.systemWalletId);
    return view.coinCount;
  }
}
