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

export interface Listing {
  id: string;
  title: string;
  description: string;
  price: number;
  imageUrl: string;
  sellerPublicKeyHash: string;
  status: "active" | "sold" | "cancelled";
  buyerPublicKeyHash: string | null;
  paymentId: string | null;
  createdAt: number;
  soldAt: number | null;
}

export const api = {
  getListings: (status?: string) =>
    request<Listing[]>(`/marketplace/listings${status ? `?status=${status}` : ""}`),

  getListing: (id: string) =>
    request<Listing>(`/marketplace/listings/${id}`),

  createListing: (data: {
    title: string;
    description: string;
    price: number;
    imageUrl?: string;
    sellerPublicKeyHash: string;
  }) =>
    request<Listing>("/marketplace/listings", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  purchaseListing: (id: string, paymentId: string, buyerPublicKeyHash: string) =>
    request<Listing>(`/marketplace/listings/${id}/purchase`, {
      method: "POST",
      body: JSON.stringify({ paymentId, buyerPublicKeyHash }),
    }),

  createPayment: (data: {
    amount: number;
    recipientPublicKeyHash: string;
    description: string;
  }) =>
    request<{ paymentId: string; status: string; paymentUrl: string }>(
      "/gateway/payments",
      { method: "POST", body: JSON.stringify(data) },
    ),
};
