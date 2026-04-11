import { Module } from "@nestjs/common";
import { GossipGateway } from "./gossip.gateway";
import { GossipService } from "./gossip.service";

@Module({
  providers: [GossipGateway, GossipService],
  exports: [GossipService],
})
export class GossipModule {}
