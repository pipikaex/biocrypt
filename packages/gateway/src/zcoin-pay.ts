export interface ZcoinPayOptions {
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

export interface ConnectResult {
  connected: boolean;
  publicKeyHash?: string;
  error?: string;
}

const DEFAULT_NETWORK_URL = "https://zcoin.bio";
const POPUP_WIDTH = 480;
const POPUP_HEIGHT = 680;

export class ZcoinPay {
  private networkUrl: string;

  constructor(opts: ZcoinPayOptions = {}) {
    this.networkUrl = (opts.networkUrl || DEFAULT_NETWORK_URL).replace(/\/$/, "");
  }

  async requestPayment(opts: PaymentRequest): Promise<PaymentResult> {
    const res = await fetch(`${this.networkUrl}/api/gateway/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: opts.amount,
        recipientPublicKeyHash: opts.to,
        description: opts.description,
        metadata: opts.metadata || {},
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({ message: "Failed to create payment" }));
      return { success: false, paymentId: "", txCount: 0, error: body.message };
    }

    const data = await res.json();
    const paymentId: string = data.paymentId;
    const paymentUrl = `${this.networkUrl}/pay/${paymentId}`;

    return new Promise<PaymentResult>((resolve) => {
      const popup = openPopup(paymentUrl);

      const onMessage = (event: MessageEvent) => {
        if (event.data?.type !== "zcoin-payment") return;
        cleanup();
        resolve({
          success: !!event.data.success,
          paymentId: event.data.paymentId || paymentId,
          txCount: event.data.txCount || 0,
          error: event.data.error,
        });
      };

      const pollTimer = setInterval(() => {
        if (popup && popup.closed) {
          cleanup();
          resolve({ success: false, paymentId, txCount: 0, error: "Popup closed by user" });
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
    if (!res.ok) throw new Error("Payment not found");
    return res.json();
  }
}

function openPopup(url: string): Window | null {
  const left = Math.max(0, Math.floor((screen.width - POPUP_WIDTH) / 2));
  const top = Math.max(0, Math.floor((screen.height - POPUP_HEIGHT) / 2));
  const features = `width=${POPUP_WIDTH},height=${POPUP_HEIGHT},left=${left},top=${top},scrollbars=yes,resizable=yes`;
  return window.open(url, "zcoin_pay", features);
}

if (typeof window !== "undefined") {
  (window as any).ZcoinPay = ZcoinPay;
}

export default ZcoinPay;
