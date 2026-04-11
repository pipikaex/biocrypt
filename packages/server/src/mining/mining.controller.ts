import { Controller, Post, Body, Get } from "@nestjs/common";
import { MiningService } from "./mining.service";
import { NetworkService } from "../network/network.service";
import { SubmitCoinDto } from "./submit-coin.dto";

@Controller("mine")
export class MiningController {
  constructor(
    private readonly miningService: MiningService,
    private readonly network: NetworkService,
  ) {}

  @Get("difficulty")
  getDifficulty() {
    const epoch = this.network.getEpochProgress();
    return {
      difficulty: this.miningService.getDifficulty(),
      target: this.miningService.getDifficultyTarget(),
      networkId: this.network.getNetworkId(),
      totalSubmissions: this.miningService.getSubmissionCount(),
      epochProgress: `${epoch.current}/${epoch.interval}`,
      nextAdjustmentIn: epoch.interval - epoch.current,
    };
  }

  @Post()
  mine(@Body() body: { walletId?: string }) {
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
        miningProof: coin.miningProof,
      },
      integratedInto: body.walletId || null,
    };
  }

  @Post("submit")
  submit(@Body() body: SubmitCoinDto) {
    const result = this.miningService.submitBrowserMinedCoin(body);
    return result;
  }

  @Get("network")
  networkInfo() {
    return this.network.getNetworkInfo();
  }
}
