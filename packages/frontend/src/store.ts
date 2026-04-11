import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface LocalWallet {
  id: string;
  dna: string;
  privateKeyDNA: string;
  publicKeyHash: string;
  ownershipProofHash: string;
  createdAt: number;
}

export interface MinedCoin {
  coinGene: string;
  serial: string;
  serialHash: string;
  nonce: number;
  hash: string;
  difficulty: string;
  minedAt: number;
  signed: boolean;
  networkSignature?: string;
  networkId?: string;
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

interface ZcoinState {
  wallet: LocalWallet | null;
  coins: MinedCoin[];
  mining: MiningState;
  toasts: Toast[];

  setWallet: (w: LocalWallet | null) => void;
  addCoin: (c: MinedCoin) => void;
  updateCoin: (serialHash: string, updates: Partial<MinedCoin>) => void;
  removeCoin: (serialHash: string) => void;
  setMining: (m: Partial<MiningState>) => void;
  addToast: (type: Toast["type"], message: string) => void;
  removeToast: (id: string) => void;
}

export const useStore = create<ZcoinState>()(
  persist(
    (set) => ({
      wallet: null,
      coins: [],
      mining: { active: false, hashrate: 0, totalMined: 0, currentNonce: 0 },
      toasts: [],

      setWallet: (wallet) => set({ wallet }),

      addCoin: (coin) =>
        set((s) => ({
          coins: [...s.coins, coin],
          mining: { ...s.mining, totalMined: s.mining.totalMined + 1 },
        })),

      updateCoin: (serialHash, updates) =>
        set((s) => ({
          coins: s.coins.map((c) =>
            c.serialHash === serialHash ? { ...c, ...updates } : c,
          ),
        })),

      removeCoin: (serialHash) =>
        set((s) => ({ coins: s.coins.filter((c) => c.serialHash !== serialHash) })),

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
      name: "zcoin-wallet",
      partialize: (s) => ({ wallet: s.wallet, coins: s.coins, mining: { ...s.mining, active: false, hashrate: 0 } }),
    },
  ),
);
