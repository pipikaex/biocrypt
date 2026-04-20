import { Controller, Post, Body, Get, Req } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { Request } from "express";
import { MiningService } from "./mining.service";
import { NetworkService } from "../network/network.service";
import { SubmitCoinDto, MineDto } from "./submit-coin.dto";

@Controller("mine")
export class MiningController {
  constructor(
    private readonly miningService: MiningService,
    private readonly network: NetworkService,
  ) {}

  @SkipThrottle()
  @Get("difficulty")
  getDifficulty(@Req() req: Request) {
    const ip = req.ip || req.socket?.remoteAddress || "unknown";
    this.network.recordMinerActivity(ip);

    const epoch = this.network.getEpochProgress();
    return {
      difficulty: this.miningService.getDifficulty(),
      target: this.miningService.getDifficultyTarget(),
      networkId: this.network.getNetworkId(),
      networkGenome: this.network.getNetworkGenome(),
      totalSubmissions: this.miningService.getSubmissionCount(),
      epochProgress: `${epoch.current}/${epoch.interval}`,
      nextAdjustmentIn: epoch.interval - epoch.current,
      activeMiners: this.network.getActiveMinerCount(),
      currentReward: this.network.getCurrentBlockReward(),
      halvingEra: this.network.getHalvingEra(),
      halvingEraName: this.network.getHalvingEraName(),
      supplyExhausted: this.network.isSupplyExhausted(),
    };
  }

  @Post()
  mine(@Req() req: Request, @Body() body: MineDto) {
    const ip = req.ip || req.socket?.remoteAddress || "unknown";
    this.network.recordMinerActivity(ip);

    const coin = this.miningService.mineAndSign();

    if (body.walletId) {
      this.miningService.integrateIntoWallet(body.walletId, coin);
    }

    return {
      coin: {
        serial: coin.serial,
        serialHash: coin.serialHash,
        networkId: coin.networkId,
        networkSignature: coin.networkSignature,
        networkGenome: coin.networkGenome,
        rflpFingerprint: coin.rflpFingerprint,
        miningProof: coin.miningProof,
      },
      integratedInto: body.walletId || null,
    };
  }

  @Post("submit")
  submit(@Req() req: Request, @Body() body: SubmitCoinDto) {
    const ip = req.ip || req.socket?.remoteAddress || "unknown";
    this.network.recordMinerActivity(ip);

    const result = this.miningService.submitBrowserMinedCoin(body);
    return result;
  }

  @SkipThrottle()
  @Get("network")
  networkInfo() {
    return this.network.getNetworkInfo();
  }
}
