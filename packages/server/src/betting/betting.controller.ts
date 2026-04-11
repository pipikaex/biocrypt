import { Controller, Post, Get, Param, Body } from "@nestjs/common";
import { BettingService } from "./betting.service";

@Controller("betting")
export class BettingController {
  constructor(private readonly bettingService: BettingService) {}

  @Post("create")
  create(@Body() body: { title: string; options: string[] }) {
    return this.bettingService.createBet(body.title, body.options);
  }

  @Post("join")
  join(@Body() body: {
    betId: string;
    mrna: string;
    option: string;
    walletPublicKeyHash: string;
  }) {
    return this.bettingService.joinBet(body.betId, body.mrna, body.option, body.walletPublicKeyHash);
  }

  @Post("resolve")
  resolve(@Body() body: { betId: string; winningOption: string }) {
    return this.bettingService.resolveBet(body.betId, body.winningOption);
  }

  @Get()
  list() {
    return this.bettingService.listBets();
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.bettingService.getBet(id);
  }

  @Get("system/balance")
  systemBalance() {
    return { balance: this.bettingService.getSystemBalance() };
  }
}
