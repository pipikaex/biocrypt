import { Injectable } from "@nestjs/common";
import {
  createWallet, viewWallet, proveOwnership, verifyOwnership,
  encodeWalletToPixels, decodeWalletFromPixels,
  sha256, type Wallet, type WalletView, type WalletPNGPayload,
} from "@zcoin/core";
import * as fs from "fs";
import * as path from "path";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const WALLETS_DIR = path.join(DATA_DIR, "wallets");

interface StoredWallet {
  id: string;
  dna: string;
  publicKeyHash: string;
  ownershipProofHash: string;
  createdAt: number;
}

@Injectable()
export class WalletService {
  constructor() {
    if (!fs.existsSync(WALLETS_DIR)) {
      fs.mkdirSync(WALLETS_DIR, { recursive: true });
    }
  }

  create(): { wallet: StoredWallet; privateKeyDNA: string } {
    const w = createWallet(6000);
    const id = sha256(w.publicKeyHash).slice(0, 16);

    const stored: StoredWallet = {
      id,
      dna: w.dna,
      publicKeyHash: w.publicKeyHash,
      ownershipProofHash: w.ownershipProofHash,
      createdAt: w.createdAt,
    };

    fs.writeFileSync(
      path.join(WALLETS_DIR, `${id}.json`),
      JSON.stringify(stored),
    );

    return { wallet: stored, privateKeyDNA: w.privateKeyDNA };
  }

  getById(id: string): StoredWallet | null {
    const file = path.join(WALLETS_DIR, `${id}.json`);
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  }

  updateDNA(id: string, newDNA: string): void {
    const wallet = this.getById(id);
    if (!wallet) throw new Error("Wallet not found");
    wallet.dna = newDNA;
    fs.writeFileSync(
      path.join(WALLETS_DIR, `${id}.json`),
      JSON.stringify(wallet),
    );
  }

  view(id: string): WalletView & { id: string } {
    const wallet = this.getById(id);
    if (!wallet) throw new Error("Wallet not found");
    const v = viewWallet(wallet.dna);
    return { id, ...v };
  }

  getWalletPNG(id: string): { pixels: Uint8Array; side: number } {
    const wallet = this.getById(id);
    if (!wallet) throw new Error("Wallet not found");
    const v = viewWallet(wallet.dna);

    const payload: WalletPNGPayload = {
      version: 1,
      walletDNA: wallet.dna,
      publicKeyHash: v.publicKeyHash,
      ownershipProofHash: wallet.ownershipProofHash,
      coinCount: v.coinCount,
      createdAt: wallet.createdAt,
    };

    return encodeWalletToPixels(payload);
  }

  importFromPNG(pixels: Uint8Array): StoredWallet {
    const payload = decodeWalletFromPixels(pixels);
    const id = sha256(payload.publicKeyHash).slice(0, 16);

    const stored: StoredWallet = {
      id,
      dna: payload.walletDNA,
      publicKeyHash: payload.publicKeyHash,
      ownershipProofHash: payload.ownershipProofHash,
      createdAt: payload.createdAt,
    };

    fs.writeFileSync(
      path.join(WALLETS_DIR, `${id}.json`),
      JSON.stringify(stored),
    );

    return stored;
  }

  listAll(): StoredWallet[] {
    if (!fs.existsSync(WALLETS_DIR)) return [];
    return fs.readdirSync(WALLETS_DIR)
      .filter((f) => f.endsWith(".json"))
      .map((f) => JSON.parse(fs.readFileSync(path.join(WALLETS_DIR, f), "utf-8")));
  }
}
