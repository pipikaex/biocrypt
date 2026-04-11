import { Module } from "@nestjs/common";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import { WalletModule } from "./wallet/wallet.module";
import { MiningModule } from "./mining/mining.module";
import { TransferModule } from "./transfer/transfer.module";
import { BettingModule } from "./betting/betting.module";
import { GossipModule } from "./gossip/gossip.module";
import { NetworkModule } from "./network/network.module";
import { RegistryModule } from "./registry/registry.module";
import { GatewayModule } from "./gateway/gateway.module";
import { MarketplaceModule } from "./marketplace/marketplace.module";

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]),
    NetworkModule,
    RegistryModule,
    WalletModule,
    MiningModule,
    TransferModule,
    BettingModule,
    GossipModule,
    GatewayModule,
    MarketplaceModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
