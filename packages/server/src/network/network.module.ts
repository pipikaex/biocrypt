import { Module, Global } from "@nestjs/common";
import { NetworkService } from "./network.service";
import { NetworkController } from "./network.controller";

@Global()
@Module({
  controllers: [NetworkController],
  providers: [NetworkService],
  exports: [NetworkService],
})
export class NetworkModule {}
