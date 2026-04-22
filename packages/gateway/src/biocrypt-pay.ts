export interface BiocryptPayOptions {
  networkUrl?: string;
}

export interface PaymentRequest {
  amount: number;
  to: string;
  description: string;
  metadata?: Record<string, string>;
}

export interface PaymentResult {
  success: boolean;
  paymentId: string;
  txCount: number;
  error?: string;
}

const DEFAULT_NETWORK_URL = "https://www.biocrypt.net";
const POPUP_WIDTH = 480;
const POPUP_HEIGHT = 680;

export class BiocryptPay {
  private networkUrl: string;
  private expectedOrigin: string;

  constructor(opts: BiocryptPayOptions = {}) {
    this.networkUrl = (opts.networkUrl || DEFAULT_NETWORK_URL).replace(/\/$/, "");
    try {
      this.expectedOrigin = new URL(this.networkUrl).origin;
    } catch {
      this.expectedOrigin = DEFAULT_NETWORK_URL;
    }
  }

  async requestPayment(opts: PaymentRequest): Promise<PaymentResult> {
    let res: Response;
    try {
      res = await fetch(`${this.networkUrl}/api/gateway/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: opts.amount,
          recipientPublicKeyHash: opts.to,
          description: opts.description,
          metadata: opts.metadata || {},
        }),
      });
    } catch (e: any) {
      return { success: false, paymentId: "", txCount: 0, error: e.message || "Network error" };
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({ message: "Failed to create payment" }));
      return { success: false, paymentId: "", txCount: 0, error: body.message };
    }

    const data = await res.json();
    const paymentId: string = data.paymentId;
    const paymentUrl = `${this.networkUrl}/pay/${paymentId}`;
    const expectedOrigin = this.expectedOrigin;

    return new Promise<PaymentResult>((resolve) => {
      const popup = openPopup(paymentUrl);

      if (!popup) {
        resolve({ success: false, paymentId, txCount: 0, error: "Popup blocked by browser" });
        return;
      }

      let settled = false;
      let popupReady = false;
      const openedAt = Date.now();

      const onMessage = (event: MessageEvent) => {
        if (event.origin !== expectedOrigin) return;
        if (event.data?.type === "biocrypt-payment-ready") {
          popupReady = true;
          return;
        }
        if (event.data?.type !== "biocrypt-payment") return;
        if (settled) return;
        settled = true;
        cleanup();
        resolve({
          success: !!event.data.success,
          paymentId: event.data.paymentId || paymentId,
          txCount: event.data.txCount || 0,
          error: event.data.error,
        });
      };

      // Cross-Origin-Opener-Policy can detach the opener's reference to the
      // popup, making `popup.closed` read `true` even though the popup is
      // alive. Only trust `popup.closed` once the popup has handshake'd
      // (`biocrypt-payment-ready`) or after a 15s safety timeout.
      const pollTimer = setInterval(() => {
        if (settled) return;
        const grace = popupReady ? 300 : 15000;
        if (Date.now() - openedAt < grace) return;
        let closed = false;
        try { closed = popup.closed; } catch { closed = false; }
        if (closed) {
          settled = true;
          cleanup();
          resolve({
            success: false, paymentId, txCount: 0,
            error: popupReady ? "Payment popup was closed before completion" : "Popup unreachable",
          });
        }
      }, 500);

      const cleanup = () => {
        window.removeEventListener("message", onMessage);
        clearInterval(pollTimer);
      };

      window.addEventListener("message", onMessage);
    });
  }

  async getPaymentStatus(paymentId: string): Promise<{
    status: string;
    amount: number;
    mrnasReceived: number;
  }> {
    const res = await fetch(`${this.networkUrl}/api/gateway/payments/${paymentId}`);
    if (!res.ok) {
      const body = await res.json().catch(() => ({ message: "Payment not found" }));
      throw new Error(body.message || "Payment not found");
    }
    return res.json();
  }
}

function openPopup(url: string): Window | null {
  const left = Math.max(0, Math.floor((screen.width - POPUP_WIDTH) / 2));
  const top = Math.max(0, Math.floor((screen.height - POPUP_HEIGHT) / 2));
  const features = `width=${POPUP_WIDTH},height=${POPUP_HEIGHT},left=${left},top=${top},scrollbars=yes,resizable=yes`;
  return window.open(url, "biocrypt_pay", features);
}

if (typeof window !== "undefined") {
  (window as any).BiocryptPay = BiocryptPay;
}

export default BiocryptPay;
