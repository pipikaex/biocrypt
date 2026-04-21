import { Module } from "@nestjs/common";
import { BettingController } from "./betting.controller";
import { BettingService } from "./betting.service";
import { BettingGateway } from "./betting.gateway";
import { WalletModule } from "../wallet/wallet.module";
import { RegistryModule } from "../registry/registry.module";

@Module({
  imports: [WalletModule, RegistryModule],
  controllers: [BettingController],
  providers: [BettingService, BettingGateway],
})
export class BettingModule {}
