const BASE = "/api";

async function request<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(body.message || res.statusText);
  }
  return res.json();
}

export interface NetworkStats {
  networkId: string;
  dnaLength: number;
  dnaHash: string;
  difficulty: string;
  difficultyTarget: string;
  totalWallets: number;
  totalCoins: number;
  totalSubmissions: number;
  epochProgress: string;
  nextAdjustmentIn: number;
  peers: number;
  nullifiers: number;
}

export interface SignedCoinResponse {
  coin: {
    serial: string;
    serialHash: string;
    networkId: string;
    networkSignature: string;
    miningProof: { nonce: number; hash: string; difficulty: string };
  };
  feeCoinMinted: boolean;
  difficultyAdjusted: boolean;
  currentDifficulty: string;
  currentTarget: string;
}

export interface WalletResponse {
  id: string;
  publicKeyHash: string;
  privateKeyDNA?: string;
  warning?: string;
}

export interface WalletViewResponse {
  id: string;
  publicKeyHash: string;
  proteinCount: number;
  coinCount: number;
}

export const api = {
  getNetworkStats: () => request<NetworkStats>("/network/stats"),

  getDifficulty: () =>
    request<{
      difficulty: string;
      target: string;
      networkId: string;
      totalSubmissions: number;
      epochProgress: string;
      nextAdjustmentIn: number;
    }>("/mine/difficulty"),

  submitCoin: (miningResult: {
    coinGene: string;
    serial: string;
    serialHash: string;
    nonce: number;
    hash: string;
    difficulty: string;
  }) =>
    request<SignedCoinResponse>("/mine/submit", {
      method: "POST",
      body: JSON.stringify(miningResult),
    }),

  createWallet: () =>
    request<WalletResponse>("/wallet", { method: "POST" }),

  getWallet: (id: string) => request<WalletViewResponse>(`/wallet/${id}`),

  listWallets: () => request<WalletResponse[]>("/wallet"),

  getBalance: (id: string) =>
    request<{ id: string; coins: number; proteins: number }>(`/wallet/${id}/balance`),

  transfer: (data: {
    senderWalletId: string;
    senderPrivateKeyDNA: string;
    coinSerialHash: string;
    recipientPublicKeyHash?: string;
    networkSignature: string;
    miningProof: { nonce: number; hash: string; difficulty: string };
  }) =>
    request<{ mrna: string; nullifier: string }>("/transfer", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  receiveTransfer: (data: { walletId: string; mrna: string }) =>
    request<{ coinSerialHash: string; newBalance: number }>("/transfer/receive", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  validateTransfer: (mrna: string) =>
    request<{ valid: boolean; spent: boolean; details: unknown }>("/transfer/validate", {
      method: "POST",
      body: JSON.stringify({ mrna }),
    }),
};
