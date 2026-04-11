import { Module } from "@nestjs/common";
import { TransferController } from "./transfer.controller";
import { TransferService } from "./transfer.service";
import { WalletModule } from "../wallet/wallet.module";

@Module({
  imports: [WalletModule],
  controllers: [TransferController],
  providers: [TransferService],
  exports: [TransferService],
})
export class TransferModule {}
