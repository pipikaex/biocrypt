# @biocrypt/gateway

Embeddable payment gateway SDK for accepting ZBIO (BioCrypt v1) payments on your site — a drop-in widget plus a small JS client.

## Install

```bash
npm install @biocrypt/gateway
```

Or use the CDN build directly:

```html
<script src="https://www.biocrypt.net/gateway/biocrypt-pay.js"></script>
```

## Quick start

```ts
import { BioCryptPay } from "@biocrypt/gateway";

const pay = new BioCryptPay({ apiBase: "https://www.biocrypt.net/api" });

const { paymentId, paymentUrl } = await pay.createPayment({
  amount: 0.5,
  recipientPublicKeyHash: "<your wallet pubkey hash>",
  description: "Coffee",
});

pay.openCheckout(paymentUrl);
pay.waitForCompletion(paymentId).then((status) => {
  console.log("paid!", status);
});
```

## License

MIT
