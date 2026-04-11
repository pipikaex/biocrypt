(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
    typeof define === 'function' && define.amd ? define(['exports'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.ZcoinPayModule = {}));
})(this, (function (exports) { 'use strict';

    const DEFAULT_NETWORK_URL = "https://zcoin.bio";
    const POPUP_WIDTH = 480;
    const POPUP_HEIGHT = 680;
    class ZcoinPay {
        constructor(opts = {}) {
            this.networkUrl = (opts.networkUrl || DEFAULT_NETWORK_URL).replace(/\/$/, "");
        }
        async requestPayment(opts) {
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
            const paymentId = data.paymentId;
            const paymentUrl = `${this.networkUrl}/pay/${paymentId}`;
            return new Promise((resolve) => {
                const popup = openPopup(paymentUrl);
                const onMessage = (event) => {
                    if (event.data?.type !== "zcoin-payment")
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
        async getPaymentStatus(paymentId) {
            const res = await fetch(`${this.networkUrl}/api/gateway/payments/${paymentId}`);
            if (!res.ok)
                throw new Error("Payment not found");
            return res.json();
        }
    }
    function openPopup(url) {
        const left = Math.max(0, Math.floor((screen.width - POPUP_WIDTH) / 2));
        const top = Math.max(0, Math.floor((screen.height - POPUP_HEIGHT) / 2));
        const features = `width=${POPUP_WIDTH},height=${POPUP_HEIGHT},left=${left},top=${top},scrollbars=yes,resizable=yes`;
        return window.open(url, "zcoin_pay", features);
    }
    if (typeof window !== "undefined") {
        window.ZcoinPay = ZcoinPay;
    }

    exports.ZcoinPay = ZcoinPay;
    exports.default = ZcoinPay;

    Object.defineProperty(exports, '__esModule', { value: true });

}));
