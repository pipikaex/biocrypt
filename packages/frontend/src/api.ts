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
      body: JSON.stringify({
        coinGene: miningResult.coinGene,
        nonce: miningResult.nonce,
        hash: miningResult.hash,
        difficulty: miningResult.difficulty,
      }),
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

  createPayment: (data: {
    amount: number;
    recipientPublicKeyHash: string;
    description: string;
    metadata?: Record<string, string>;
  }) =>
    request<{
      paymentId: string;
      status: string;
      amount: number;
      paymentUrl: string;
      expiresAt: number;
    }>("/gateway/payments", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getPayment: (id: string) =>
    request<{
      paymentId: string;
      status: string;
      amount: number;
      description: string;
      recipientPublicKeyHash: string;
      metadata: Record<string, string>;
      mrnasReceived: number;
      fulfilledAt: number | null;
      expiresAt: number;
    }>(`/gateway/payments/${id}`),
};
