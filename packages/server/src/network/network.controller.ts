import { Controller, Get } from "@nestjs/common";
import { NetworkService } from "./network.service";

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
}
