import { Controller, Post, Body } from "@nestjs/common";
import { TransferService } from "./transfer.service";
import { TransferDto, ReceiveDto, ValidateDto, ValidateBundleDto } from "./transfer.dto";

@Controller("transfer")
export class TransferController {
  constructor(private readonly transferService: TransferService) {}

  @Post()
  transfer(@Body() body: TransferDto) {
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
  receive(@Body() body: ReceiveDto) {
    return this.transferService.receive(body.walletId, body.mrna);
  }

  @Post("validate")
  validate(@Body() body: ValidateDto) {
    return this.transferService.validateOffline(body.mrna);
  }

  @Post("validate-bundle")
  validateBundle(@Body() body: ValidateBundleDto) {
    return this.transferService.validateBundle(body.data);
  }
}
