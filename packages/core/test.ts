import {
  createWallet, viewWallet, proveOwnership, verifyOwnership,
  mineCoin, signCoinWithNetwork, integrateCoinIntoWallet,
  createMRNA, applyMRNA, serializeMRNA, deserializeMRNA,
  computeNullifier, NullifierRegistry, createNullifierProof,
  generateDNA,
  encodeWalletToPixels, decodeWalletFromPixels,
  type WalletPNGPayload,
} from "./src";

console.log("═══════════════════════════════════════════════════════════");
console.log("  KRONIXCOIN — Core Engine Smoke Test");
console.log("═══════════════════════════════════════════════════════════\n");

// 1. Create wallets
console.log("1. Creating wallets...");
const alice = createWallet(6000);
const bob = createWallet(6000);
console.log(`   Alice pubkey: ${alice.publicKeyHash.slice(0, 32)}...`);
console.log(`   Bob pubkey:   ${bob.publicKeyHash.slice(0, 32)}...`);

// 2. Verify ownership
console.log("\n2. Ownership verification...");
const aliceProof = proveOwnership(alice.dna, alice.privateKeyDNA);
console.log(`   Alice proves ownership: ${verifyOwnership(alice.dna, aliceProof)}`);
console.log(`   Bob tries Alice's wallet: ${verifyOwnership(alice.dna, proveOwnership(alice.dna, bob.privateKeyDNA))}`);

// 3. View wallet (balance should be 0)
console.log("\n3. Wallet view (empty)...");
const aliceView = viewWallet(alice.dna);
console.log(`   Proteins: ${aliceView.proteinCount}, Coins: ${aliceView.coinCount}`);

// 4. Mine a coin
console.log("\n4. Mining a coin (difficulty: '00')...");
const t0 = Date.now();
const mined = mineCoin("00", 60);
console.log(`   Mined in ${Date.now() - t0}ms`);
console.log(`   Serial: ${mined.serial.slice(0, 40)}...`);
console.log(`   Hash: ${mined.hash}`);
console.log(`   Nonce: ${mined.nonce}`);

// 5. Sign coin with network
console.log("\n5. Signing coin with network DNA...");
const networkDNA = generateDNA(3000);
const networkId = "kronix-testnet-1";
const signed = signCoinWithNetwork(mined, networkDNA, networkId);
console.log(`   Network: ${signed.networkId}`);
console.log(`   Signature: ${signed.networkSignature.slice(0, 32)}...`);

// 6. Integrate coin into Alice's wallet
console.log("\n6. Integrating coin into Alice's wallet...");
alice.dna = integrateCoinIntoWallet(alice.dna, signed);
const aliceViewAfter = viewWallet(alice.dna);
console.log(`   Proteins: ${aliceViewAfter.proteinCount}, Coins: ${aliceViewAfter.coinCount}`);

// 7. Transfer coin from Alice to Bob
console.log("\n7. Transferring coin from Alice to Bob...");
const bobView = viewWallet(bob.dna);
const transfer = createMRNA(
  alice.dna,
  alice.privateKeyDNA,
  signed.serialHash,
  bobView.publicKeyHash,
  signed.networkSignature,
  signed.networkId,
  signed.miningProof,
);
console.log(`   mRNA created, nullifier: ${transfer.nullifier.slice(0, 32)}...`);
alice.dna = transfer.modifiedSenderDNA;
console.log(`   Alice coins after send: ${viewWallet(alice.dna).coinCount}`);

// 8. Serialize/deserialize mRNA (simulating offline file transfer)
console.log("\n8. Simulating offline mRNA file transfer...");
const mrnaFile = serializeMRNA(transfer.mrna);
console.log(`   mRNA file size: ${mrnaFile.length} bytes`);
const receivedMRNA = deserializeMRNA(mrnaFile);

// 9. Bob applies mRNA
console.log("\n9. Bob applies mRNA to his wallet...");
bob.dna = applyMRNA(bob.dna, receivedMRNA);
console.log(`   Bob coins after receive: ${viewWallet(bob.dna).coinCount}`);

// 10. Double-spend prevention
console.log("\n10. Double-spend prevention (nullifier registry)...");
const registry = new NullifierRegistry();
const nullifierProof = createNullifierProof(signed.serialHash, alice.privateKeyDNA);
const registered = registry.register(nullifierProof, "node-alice");
console.log(`   First registration: ${registered}`);
const duplicate = registry.register(nullifierProof, "node-eve");
console.log(`   Duplicate attempt: ${duplicate}`);
console.log(`   Coin spent check: ${registry.isCoinSpent(signed.serialHash)}`);
console.log(`   Registry size: ${registry.size}`);

// 11. PNG steganography
console.log("\n11. PNG steganography...");
const payload: WalletPNGPayload = {
  version: 1,
  walletDNA: alice.dna.slice(0, 2000),
  publicKeyHash: aliceViewAfter.publicKeyHash,
  ownershipProofHash: alice.ownershipProofHash,
  coinCount: viewWallet(alice.dna).coinCount,
  createdAt: alice.createdAt,
};
const { pixels, side } = encodeWalletToPixels(payload);
console.log(`   Encoded to ${side}x${side} image (${pixels.length} bytes)`);
const decoded = decodeWalletFromPixels(pixels);
console.log(`   Decoded DNA length: ${decoded.walletDNA.length}`);
console.log(`   PubKey match: ${decoded.publicKeyHash === payload.publicKeyHash}`);
console.log(`   Proof match: ${decoded.ownershipProofHash === payload.ownershipProofHash}`);

console.log("\n═══════════════════════════════════════════════════════════");
console.log("  ALL TESTS PASSED");
console.log("═══════════════════════════════════════════════════════════\n");
