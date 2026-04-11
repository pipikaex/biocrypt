import {
  WebSocketGateway, WebSocketServer,
  SubscribeMessage, ConnectedSocket, MessageBody,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { BettingService } from "./betting.service";

@WebSocketGateway({ namespace: "/betting", cors: true })
export class BettingGateway {
  @WebSocketServer()
  server: Server;

  constructor(private bettingService: BettingService) {}

  @SubscribeMessage("list-bets")
  handleListBets() {
    return this.bettingService.listBets();
  }

  @SubscribeMessage("join-bet")
  handleJoinBet(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      betId: string;
      mrna: string;
      option: string;
      walletPublicKeyHash: string;
    },
  ) {
    try {
      const entry = this.bettingService.joinBet(
        data.betId, data.mrna, data.option, data.walletPublicKeyHash,
      );
      this.server.emit("bet-joined", { betId: data.betId, entry });
      return { success: true, entry };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  notifyResolution(betId: string, result: any) {
    this.server.emit("bet-resolved", { betId, result });
  }
}
