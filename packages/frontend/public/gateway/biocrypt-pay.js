(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
    typeof define === 'function' && define.amd ? define(['exports'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.BiocryptPayModule = {}));
})(this, (function (exports) { 'use strict';

    const DEFAULT_NETWORK_URL = "https://www.biocrypt.net";
    const POPUP_WIDTH = 480;
    const POPUP_HEIGHT = 680;
    class BiocryptPay {
        constructor(opts = {}) {
            this.networkUrl = (opts.networkUrl || DEFAULT_NETWORK_URL).replace(/\/$/, "");
            try {
                this.expectedOrigin = new URL(this.networkUrl).origin;
            }
            catch {
                this.expectedOrigin = DEFAULT_NETWORK_URL;
            }
        }
        async requestPayment(opts) {
            let res;
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
            }
            catch (e) {
                return { success: false, paymentId: "", txCount: 0, error: e.message || "Network error" };
            }
            if (!res.ok) {
                const body = await res.json().catch(() => ({ message: "Failed to create payment" }));
                return { success: false, paymentId: "", txCount: 0, error: body.message };
            }
            const data = await res.json();
            const paymentId = data.paymentId;
            const paymentUrl = `${this.networkUrl}/pay/${paymentId}`;
            const expectedOrigin = this.expectedOrigin;
            return new Promise((resolve) => {
                const popup = openPopup(paymentUrl);
                if (!popup) {
                    resolve({ success: false, paymentId, txCount: 0, error: "Popup blocked by browser" });
                    return;
                }
                const onMessage = (event) => {
                    if (event.origin !== expectedOrigin)
                        return;
                    if (event.data?.type !== "biocrypt-payment")
                        return;
                    cleanup();
                    resolve({
                        success: !!event.data.success,
                        paymentId: event.data.paymentId || paymentId,
                        txCount: event.data.txCount || 0,
                        error: event.data.error,
                    });
                };
                const pollTimer = setInterval(() => {
                    if (popup.closed) {
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
        async getPaymentStatus(paymentId) {
            const res = await fetch(`${this.networkUrl}/api/gateway/payments/${paymentId}`);
            if (!res.ok) {
                const body = await res.json().catch(() => ({ message: "Payment not found" }));
                throw new Error(body.message || "Payment not found");
            }
            return res.json();
        }
    }
    function openPopup(url) {
        const left = Math.max(0, Math.floor((screen.width - POPUP_WIDTH) / 2));
        const top = Math.max(0, Math.floor((screen.height - POPUP_HEIGHT) / 2));
        const features = `width=${POPUP_WIDTH},height=${POPUP_HEIGHT},left=${left},top=${top},scrollbars=yes,resizable=yes`;
        return window.open(url, "biocrypt_pay", features);
    }
    if (typeof window !== "undefined") {
        window.BiocryptPay = BiocryptPay;
    }

    exports.BiocryptPay = BiocryptPay;
    exports.default = BiocryptPay;

    Object.defineProperty(exports, '__esModule', { value: true });

}));
