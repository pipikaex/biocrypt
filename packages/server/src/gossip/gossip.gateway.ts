import {
  WebSocketGateway, WebSocketServer,
  SubscribeMessage, OnGatewayConnection, OnGatewayDisconnect,
  MessageBody, ConnectedSocket,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { GossipService } from "./gossip.service";
import { NullifierProof } from "@biocrypt/core";

@WebSocketGateway({ namespace: "/gossip", cors: true })
export class GossipGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private gossipService: GossipService) {}

  handleConnection(client: Socket) {
    const peerId = client.id;
    this.gossipService.registerPeer(peerId);
    console.log(`Peer connected: ${peerId}`);

    // Send current nullifiers to new peer
    const nullifiers = this.gossipService.getNullifiersForSync();
    client.emit("sync", { nullifiers, total: nullifiers.length });
  }

  handleDisconnect(client: Socket) {
    this.gossipService.removePeer(client.id);
    console.log(`Peer disconnected: ${client.id}`);
  }

  @SubscribeMessage("nullifier")
  handleNullifier(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { proof: NullifierProof },
  ) {
    const result = this.gossipService.receiveNullifiers([data.proof], client.id);

    if (result.newCount > 0) {
      // Propagate to all other peers
      client.broadcast.emit("nullifier", { proof: data.proof });
    }

    return { accepted: result.newCount > 0, total: result.total };
  }

  @SubscribeMessage("sync-request")
  handleSyncRequest(@ConnectedSocket() client: Socket) {
    const nullifiers = this.gossipService.getNullifiersForSync();
    return { nullifiers, total: nullifiers.length };
  }

  @SubscribeMessage("check-coin")
  handleCheckCoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { coinSerialHash: string },
  ) {
    return { spent: this.gossipService.checkCoinSpent(data.coinSerialHash) };
  }

  @SubscribeMessage("status")
  handleStatus() {
    return this.gossipService.getStatus();
  }

  broadcastNullifier(proof: NullifierProof) {
    this.server.emit("nullifier", { proof });
  }
}
