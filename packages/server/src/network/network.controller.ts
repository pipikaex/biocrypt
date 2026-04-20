import { Controller, Get } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { NetworkService } from "./network.service";

@Controller("network")
export class NetworkController {
  constructor(private readonly network: NetworkService) {}

  @SkipThrottle()
  @Get("stats")
  getStats() {
    return this.network.getStats();
  }

  @SkipThrottle()
  @Get("info")
  getInfo() {
    return this.network.getNetworkInfo();
  }

  @Get("dna")
  getDnaAnalysis() {
    return this.network.getDnaAnalysis();
  }

  @SkipThrottle()
  @Get("rflp")
  getRFLPFingerprint() {
    return this.network.getNetworkRFLPFingerprint();
  }
}
