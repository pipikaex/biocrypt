import { Injectable } from "@nestjs/common";
import {
  createWallet, viewWallet, proveOwnership, verifyOwnership,
  encodeWalletToPixels, decodeWalletFromPixels,
  sha256, type Wallet, type WalletView, type WalletPNGPayload,
} from "@biocrypt/core";
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

function atomicWrite(filePath: string, data: string): void {
  const tmp = filePath + ".tmp";
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, filePath);
}

function safeReadJSON<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch (e) {
    console.error(`Failed to parse ${filePath}:`, e);
    return null;
  }
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

    atomicWrite(
      path.join(WALLETS_DIR, `${id}.json`),
      JSON.stringify(stored),
    );

    return { wallet: stored, privateKeyDNA: w.privateKeyDNA };
  }

  getById(id: string): StoredWallet | null {
    const file = path.join(WALLETS_DIR, `${id}.json`);
    return safeReadJSON<StoredWallet>(file);
  }

  updateDNA(id: string, newDNA: string): void {
    const wallet = this.getById(id);
    if (!wallet) throw new Error("Wallet not found");
    wallet.dna = newDNA;
    atomicWrite(
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

    atomicWrite(
      path.join(WALLETS_DIR, `${id}.json`),
      JSON.stringify(stored),
    );

    return stored;
  }

  listAll(): StoredWallet[] {
    if (!fs.existsSync(WALLETS_DIR)) return [];
    return fs.readdirSync(WALLETS_DIR)
      .filter((f) => f.endsWith(".json"))
      .map((f) => safeReadJSON<StoredWallet>(path.join(WALLETS_DIR, f)))
      .filter((w): w is StoredWallet => w !== null);
  }
}
