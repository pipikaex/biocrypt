/**
 * Residual REST helpers for the decentralized v1 server.
 *
 * After the 2026 genesis-anchor rollout, the Nest.js server only hosts
 * wallet helpers, the payment gateway, the marketplace and the betting
 * PoC. All mint/transfer/tracker/network endpoints are gone — use
 * the @biocrypt/tracker WebSocket service via `trackerClient.ts` instead.
 */
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
  createWallet: () =>
    request<WalletResponse>("/wallet", { method: "POST" }),

  getWallet: (id: string) => request<WalletViewResponse>(`/wallet/${id}`),

  listWallets: () => request<WalletResponse[]>("/wallet"),

  getBalance: (id: string) =>
    request<{ id: string; coins: number; proteins: number }>(`/wallet/${id}/balance`),

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
