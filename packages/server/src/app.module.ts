import { Module } from "@nestjs/common";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import { WalletModule } from "./wallet/wallet.module";
import { BettingModule } from "./betting/betting.module";
import { RegistryModule } from "./registry/registry.module";
import { GatewayModule } from "./gateway/gateway.module";
import { MarketplaceModule } from "./marketplace/marketplace.module";

/**
 * v1 (post genesis-anchor rollout): the Nest server only hosts the ancillary
 * services that still make sense in a decentralized world — wallet helpers,
 * payment gateway, marketplace listings, nullifier registry and the betting
 * PoC. Mining, proof-of-work registry, transfer relay, gossip and the central
 * network DNA now live in the @biocrypt/tracker WebSocket service. Every
 * mint, spend and envelope flows through that tracker mesh instead.
 */
@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]),
    RegistryModule,
    WalletModule,
    BettingModule,
    GatewayModule,
    MarketplaceModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
