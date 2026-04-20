import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "public", "narration");

const OPENAI_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_KEY) {
  console.error("Set OPENAI_API_KEY environment variable first.\n");
  console.error("  export OPENAI_API_KEY=sk-...");
  console.error("  node generate-narration.mjs\n");
  process.exit(1);
}

const VOICE = process.env.TTS_VOICE || "onyx";
const MODEL = "tts-1-hd";

const SCENES = [
  { file: "s0.mp3",  text: "What if cryptocurrency was alive?" },
  { file: "s1.mp3",  text: "What if your wallet had DNA. Your coins were proteins. And every coin carried a biological fingerprint?" },
  { file: "s2.mp3",  text: "Introducing biocrypt.net. 21 million coins. DNA encoded. Unforgeable. No blockchain. No KYC. No GPU needed. Works offline. The living cryptocurrency." },
  { file: "s3.mp3",  text: "Blockchain changed the world. But every node stores every transaction, forever. The chain grows heavier with every block." },
  { file: "s4.mp3",  text: "Traditional crypto demands your passport, your selfie, days of waiting. Exchange fees eat your profits. You need a three thousand dollar GPU just to mine. You can't send coins offline. And if the server goes down, your coins are frozen. What if we could keep the security, but lose everything that holds you back?" },
  { file: "s5.mp3",  text: "Meet Bio-Crypt. A cryptocurrency built on biology, not bureaucracy. Six thousand DNA bases per wallet. 180 bases per coin gene. 504 bits of combined security. 21 million maximum supply. And zero KYC required." },
  { file: "s6.mp3",  text: "Mining is as simple as opening a browser tab and clicking Start Mining. That's it. Your browser does the rest. SHA-256 proof of work, the same algorithm as Bitcoin, running on any device. No GPU. No downloads. No signup. No KYC." },
  { file: "s7.mp3",  text: "Each successful mine earns a block reward of 50 coins in the Genesis era. Every 210,000 submissions, the reward halves, identical to Bitcoin. 25 in the Growth era. 12 in Expansion. 6 in Maturity. And then, the Hayflick limit." },
  { file: "s8.mp3",  text: "The network's DNA has telomeres — TTAGGG repeats at the ends of its chromosomes. Every coin mined shortens them. When they reach zero, mining stops forever. 21 million coins. Not a setting you can change. A death sentence written into the DNA itself." },
  { file: "s9.mp3",  text: "Every coin carries a biological paternity test. Five restriction enzymes cut the coin's marker DNA. The resulting band pattern is a unique fingerprint. A genuine coin matches the network. A forged coin? The bands don't line up. This works completely offline." },
  { file: "s10.mp3", text: "Four independent layers of defense. Layer one: SHA-256 proof of work, same algorithm as Bitcoin. Layer two: Ed25519 digital signatures, same cryptography as Solana and Signal. Layer three: RFLP biological fingerprinting, a DNA paternity test no forger can fake. Layer four: cryptographic nullifiers that prevent any coin from being spent twice. Combined, that's 504 bits of security." },
  { file: "s11.mp3", text: "Transfers work like biology. The coin gene, its signature, its fingerprint, and its proof — everything packed into one self-contained mRNA payload. Send it by email. USB drive. QR code. Bluetooth. It's verified offline. No server needed. No waiting. No KYC." },
  { file: "s12.mp3", text: "No passport. No selfie. No bank account. No waiting. Create a wallet in one click and start using it instantly. No identity required. No email. No phone number. No address. Your wallet is a DNA strand. Your identity is your private key. That's all you need. Anywhere in the world." },
  { file: "s13.mp3", text: "Accept Bio-Crypt payments on any website. Like PayPal, Stripe, or Revolut — but powered by DNA. Customer clicks Pay with Bio-Crypt. A wallet popup opens. They confirm with their private key. The mRNA transfer is sent. And it's verified instantly. No credit card processor. No 3 percent fee. No chargebacks. Just biology." },
  { file: "s14.mp3", text: "Integration takes five lines of code. Import the Bio-Crypt gateway SDK. Create a new pay instance pointed at biocrypt.net. Call checkout with an amount and label. That's it. Works on React, Vue, Svelte, WordPress, Shopify — anything. One script tag. One function call. The wallet popup handles the rest. Instant settlement." },
  { file: "s15.mp3", text: "Don't want to mine? Buy coins directly from miners on the Bio-Crypt marketplace. Sell digital art. Sell game credits. Sell premium access. Peer to peer. No middleman takes a cut." },
  { file: "s16.mp3", text: "Who is Bio-Crypt for? Miners: open a browser tab and earn coins with zero hardware investment. Merchants: accept DNA payments with five lines of code and zero fees. Developers: build on our SDK — games, marketplaces, tipping, anything with value. And everyone else: no bank needed, no ID needed. Send value to anyone, anywhere, anytime." },
  { file: "s17.mp3", text: "The Bio-Crypt economy. Earn by mining while your browser tab runs in the background. Own your keys — your private key never leaves your device. Instant and free: no gas fees, no confirmation wait. Biologically unique: every coin has DNA proving its origin. Works offline. And it's fully open source." },
  { file: "s18.mp3", text: "Right now, in the Genesis era, the difficulty is low and the rewards are high. 50 coins per block. Later, the reward drops to 25. Then halves again, and again, until the telomeres are exhausted and mining stops forever. The earlier you mine, the more you earn. Bitcoin's early miners became millionaires. This is your Genesis moment." },
  { file: "s19.mp3", text: "Join the organism. 21 million hard cap. Four security layers. Zero blockchain. Zero KYC. Infinite coin validity. No ICO. No pre-mine. No venture capital. Open source. Live right now. Start mining at biocrypt.net." },
  { file: "s20.mp3", text: "Bitcoin reimagined the economy. Bio-Crypt reimagines it through the lens of life itself. No blockchain. No KYC. No middleman. No fees. No limits. 21 million coins. Four layers of defense. Telomere-enforced scarcity. Mine for free — in your browser. biocrypt.net." },
];

if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

async function generate(scene, idx) {
  const outPath = join(outDir, scene.file);
  if (existsSync(outPath)) {
    console.log(`[${idx + 1}/${SCENES.length}] ${scene.file} — already exists, skipping`);
    return;
  }

  console.log(`[${idx + 1}/${SCENES.length}] Generating ${scene.file}...`);

  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      voice: VOICE,
      input: scene.text,
      response_format: "mp3",
      speed: 1.0,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`  FAILED (${res.status}): ${err}`);
    return;
  }

  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(outPath, buf);
  console.log(`  Saved ${scene.file} (${(buf.length / 1024).toFixed(0)} KB)`);
}

console.log(`\nGenerating narration with voice "${VOICE}" using model "${MODEL}"\n`);
console.log(`Output: ${outDir}\n`);

for (let i = 0; i < SCENES.length; i++) {
  await generate(SCENES[i], i);
  if (i < SCENES.length - 1) await new Promise(r => setTimeout(r, 300));
}

console.log("\nDone! Now rebuild the frontend:\n  npm run build -w packages/frontend\n");
