import { Module } from "@nestjs/common";
import { BettingController } from "./betting.controller";
import { BettingService } from "./betting.service";
import { BettingGateway } from "./betting.gateway";
import { WalletModule } from "../wallet/wallet.module";
import { TransferModule } from "../transfer/transfer.module";

@Module({
  imports: [WalletModule, TransferModule],
  controllers: [BettingController],
  providers: [BettingService, BettingGateway],
})
export class BettingModule {}
