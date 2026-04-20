const BASE = "/api";

async function request<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: opts?.body instanceof FormData ? {} : { "Content-Type": "application/json" },
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
  sellerPublicKeyHash: string;
  status: "active" | "sold" | "cancelled";
  buyerPublicKeyHash: string | null;
  fileName: string;
  fileSize: number;
  fileHash: string;
  fileMime?: string;
  createdAt: number;
  soldAt: number | null;
  downloads: number;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + " GB";
}

export { formatFileSize };

export const api = {
  getListings: (status?: string) =>
    request<Listing[]>(`/marketplace/listings${status ? `?status=${status}` : ""}`),

  getListing: (id: string) =>
    request<Listing>(`/marketplace/listings/${id}`),

  createListing: (data: FormData) =>
    request<Listing>("/marketplace/listings", {
      method: "POST",
      body: data,
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

  downloadFile: async (id: string, buyerPublicKeyHash: string): Promise<void> => {
    const res = await fetch(`${BASE}/marketplace/listings/${id}/download`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ buyerPublicKeyHash }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ message: "Download failed" }));
      throw new Error(body.message || "Download failed");
    }
    const disposition = res.headers.get("Content-Disposition") || "";
    const match = disposition.match(/filename="?(.+?)"?$/);
    const fileName = match ? decodeURIComponent(match[1]) : "download";
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  getSellerMrnas: (id: string, sellerPublicKeyHash: string) =>
    request<{ mrnas: string[] }>(`/marketplace/listings/${id}/mrnas`, {
      method: "POST",
      body: JSON.stringify({ sellerPublicKeyHash }),
    }),
};
