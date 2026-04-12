import { Injectable } from "@nestjs/common";
import {
  createMRNA, applyMRNA, validateMRNA, serializeMRNA, deserializeMRNA,
  parseMRNAData,
  computeNullifier, createNullifierProof, viewWallet,
  type mRNAPayload, type TransferResult,
} from "@zcoin/core";
import { WalletService } from "../wallet/wallet.service";
import { RegistryService } from "../registry/registry.service";
import { NetworkService } from "../network/network.service";

const TRANSFER_BURN_RATE = parseFloat(process.env.TRANSFER_BURN_RATE || "0.01");

@Injectable()
export class TransferService {
  constructor(
    private walletService: WalletService,
    private registry: RegistryService,
    private network: NetworkService,
  ) {}

  transfer(
    senderWalletId: string,
    senderPrivateKeyDNA: string,
    coinSerialHash: string,
    recipientPublicKeyHash: string | null,
    networkSignature: string,
    miningProof: { nonce: number; hash: string; difficulty: string },
  ): { mrna: string; nullifier: string } {
    const sender = this.walletService.getById(senderWalletId);
    if (!sender) throw new Error("Sender wallet not found");

    if (this.registry.isCoinSpent(coinSerialHash)) {
      throw new Error("Coin already spent (double-spend detected)");
    }

    const result = createMRNA(
      sender.dna,
      senderPrivateKeyDNA,
      coinSerialHash,
      recipientPublicKeyHash,
      networkSignature,
      this.network.getNetworkId(),
      this.network.getNetworkGenome(),
      miningProof,
    );

    this.walletService.updateDNA(senderWalletId, result.modifiedSenderDNA);

    const proof = createNullifierProof(coinSerialHash, senderPrivateKeyDNA);
    this.registry.registerNullifier(proof, "server");

    if (TRANSFER_BURN_RATE > 0 && Math.random() < TRANSFER_BURN_RATE) {
      this.network.incrementBurnedCoins(1);
      console.log(`Transfer burn: 1 coin burned (deflationary pressure). Total burned: ${this.network.getBurnedCoins()}`);
    }

    return {
      mrna: serializeMRNA(result.mrna),
      nullifier: result.nullifier,
    };
  }

  receive(recipientWalletId: string, mrnaData: string): { coinSerialHash: string; newBalance: number } {
    const recipient = this.walletService.getById(recipientWalletId);
    if (!recipient) throw new Error("Recipient wallet not found");

    const mrna = deserializeMRNA(mrnaData);

    if (this.registry.isCoinSpent(mrna.coinSerialHash)) {
      throw new Error("Coin already spent (double-spend detected)");
    }

    validateMRNA(mrna, this.network.getNetworkGenome());

    const newDNA = applyMRNA(recipient.dna, mrna, this.network.getNetworkGenome());
    this.walletService.updateDNA(recipientWalletId, newDNA);

    const view = viewWallet(newDNA);
    return { coinSerialHash: mrna.coinSerialHash, newBalance: view.coinCount };
  }

  validateOffline(mrnaData: string): { valid: boolean; spent: boolean; details: any } {
    const mrna = deserializeMRNA(mrnaData);
    const spent = this.registry.isCoinSpent(mrna.coinSerialHash);

    try {
      validateMRNA(mrna, this.network.getNetworkGenome());
      return { valid: true, spent, details: { coinSerialHash: mrna.coinSerialHash, lineage: mrna.lineage } };
    } catch (e: any) {
      return { valid: false, spent, details: { error: e.message } };
    }
  }

  validateBundle(rawData: string): { results: { valid: boolean; spent: boolean; coinSerialHash?: string; error?: string }[] } {
    const mrnas = parseMRNAData(rawData);
    const results = mrnas.map((mrna) => {
      const spent = this.registry.isCoinSpent(mrna.coinSerialHash);
      try {
        validateMRNA(mrna, this.network.getNetworkGenome());
        return { valid: true, spent, coinSerialHash: mrna.coinSerialHash };
      } catch (e: any) {
        return { valid: false, spent, coinSerialHash: mrna.coinSerialHash, error: e.message };
      }
    });
    return { results };
  }
}
