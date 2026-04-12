import { Controller, Get } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { NetworkService } from "./network.service";

@SkipThrottle()
@Controller("network")
export class NetworkController {
  constructor(private readonly network: NetworkService) {}

  @Get("stats")
  getStats() {
    return this.network.getStats();
  }

  @Get("info")
  getInfo() {
    return this.network.getNetworkInfo();
  }

  @Get("dna")
  getDnaAnalysis() {
    return this.network.getDnaAnalysis();
  }

  @Get("rflp")
  getRFLPFingerprint() {
    return this.network.getNetworkRFLPFingerprint();
  }
}
