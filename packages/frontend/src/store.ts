import { create } from "zustand";
import { persist } from "zustand/middleware";
import { integrateCoinGene } from "@biocrypt/core";

export interface LocalWallet {
  id: string;
  dna: string;
  privateKeyDNA: string | null;
  publicKeyHash: string;
  ownershipProofHash: string;
  networkGenome: string;
  networkId: string;
  createdAt: number;
}

export interface RFLPFingerprint {
  fragments: number[];
  enzymesUsed: string[];
  markerCount: number;
  markerDNA: string;
}

export interface MinedCoin {
  coinGene: string;
  serial: string;
  serialHash: string;
  aminoAcids?: string[];
  nonce: number;
  hash: string;
  difficulty: string;
  minedAt: number;
  signed: boolean;
  networkSignature?: string;
  networkId?: string;
  networkGenome?: string;
  rflpFingerprint?: RFLPFingerprint;
}

interface MiningState {
  active: boolean;
  hashrate: number;
  totalMined: number;
  currentNonce: number;
}

export interface Toast {
  id: string;
  type: "success" | "error" | "info";
  message: string;
}

interface BiocryptState {
  wallet: LocalWallet | null;
  coins: MinedCoin[];
  spentHashes: string[];
  mining: MiningState;
  toasts: Toast[];

  setWallet: (w: LocalWallet | null) => void;
  addCoin: (c: MinedCoin) => void;
  updateCoin: (serialHash: string, updates: Partial<MinedCoin>) => void;
  removeCoin: (serialHash: string) => void;
  integrateCoinIntoWalletDNA: (coinGene: string) => void;
  setMining: (m: Partial<MiningState>) => void;
  addToast: (type: Toast["type"], message: string) => void;
  removeToast: (id: string) => void;
}

export const useStore = create<BiocryptState>()(
  persist(
    (set) => ({
      wallet: null,
      coins: [],
      spentHashes: [],
      mining: { active: false, hashrate: 0, totalMined: 0, currentNonce: 0 },
      toasts: [],

      setWallet: (wallet) =>
        set((s) => {
          if (!wallet) return { wallet: null, coins: [], spentHashes: [], mining: { active: false, hashrate: 0, totalMined: 0, currentNonce: 0 } };
          const isSame = s.wallet && s.wallet.publicKeyHash === wallet.publicKeyHash;
          if (isSame) return { wallet };
          return { wallet, coins: [], spentHashes: [], mining: { active: false, hashrate: 0, totalMined: 0, currentNonce: 0 } };
        }),

      addCoin: (coin) =>
        set((s) => {
          if (s.coins.some((c) => c.serialHash === coin.serialHash)) return s;
          return {
            coins: [...s.coins, coin],
            mining: { ...s.mining, totalMined: s.mining.totalMined + 1 },
          };
        }),

      updateCoin: (serialHash, updates) =>
        set((s) => ({
          coins: s.coins.map((c) =>
            c.serialHash === serialHash ? { ...c, ...updates } : c,
          ),
        })),

      removeCoin: (serialHash) =>
        set((s) => ({
          coins: s.coins.filter((c) => c.serialHash !== serialHash),
          spentHashes: s.spentHashes.includes(serialHash) ? s.spentHashes : [...s.spentHashes, serialHash],
        })),

      integrateCoinIntoWalletDNA: (coinGene) =>
        set((s) => {
          if (!s.wallet) return s;
          const newDNA = integrateCoinGene(s.wallet.dna, coinGene);
          return { wallet: { ...s.wallet, dna: newDNA } };
        }),

      setMining: (m) => set((s) => ({ mining: { ...s.mining, ...m } })),

      addToast: (type, message) => {
        const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
        set((s) => ({ toasts: [...s.toasts, { id, type, message }] }));
        setTimeout(() => {
          set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
        }, 4000);
      },

      removeToast: (id) =>
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
    }),
    {
      name: "biocrypt-wallet",
      partialize: (s) => ({ wallet: s.wallet, coins: s.coins, spentHashes: s.spentHashes, mining: { ...s.mining, active: false, hashrate: 0 } }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;

        let coinsFixed = 0;
        const repairedCoins = state.coins.map((coin) => {
          if (!coin.signed && coin.networkSignature) {
            coinsFixed++;
            return { ...coin, signed: true };
          }
          return coin;
        });
        if (coinsFixed > 0) {
          useStore.setState({ coins: repairedCoins });
        }

        if (!state.wallet) return;
        const coins = coinsFixed > 0 ? repairedCoins : state.coins;
        let dna = state.wallet.dna;
        let dnaRepaired = 0;
        for (const coin of coins) {
          if (!coin.signed || !coin.coinGene) continue;
          if (!dna.includes(coin.coinGene.slice(0, 30))) {
            try {
              dna = integrateCoinGene(dna, coin.coinGene);
              dnaRepaired++;
            } catch { /* skip broken genes */ }
          }
        }
        if (dnaRepaired > 0) {
          useStore.setState({ wallet: { ...state.wallet, dna } });
        }
      },
    },
  ),
);
