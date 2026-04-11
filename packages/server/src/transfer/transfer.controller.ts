import { Controller, Post, Body } from "@nestjs/common";
import { TransferService } from "./transfer.service";

@Controller("transfer")
export class TransferController {
  constructor(private readonly transferService: TransferService) {}

  @Post()
  transfer(@Body() body: {
    senderWalletId: string;
    senderPrivateKeyDNA: string;
    coinSerialHash: string;
    recipientPublicKeyHash?: string;
    networkSignature: string;
    miningProof: { nonce: number; hash: string; difficulty: string };
  }) {
    return this.transferService.transfer(
      body.senderWalletId,
      body.senderPrivateKeyDNA,
      body.coinSerialHash,
      body.recipientPublicKeyHash || null,
      body.networkSignature,
      body.miningProof,
    );
  }

  @Post("receive")
  receive(@Body() body: { walletId: string; mrna: string }) {
    return this.transferService.receive(body.walletId, body.mrna);
  }

  @Post("validate")
  validate(@Body() body: { mrna: string }) {
    return this.transferService.validateOffline(body.mrna);
  }
}
