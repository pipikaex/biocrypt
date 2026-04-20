import { IsArray, IsString, ArrayMinSize, ArrayMaxSize } from "class-validator";

export class FulfillPaymentDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(10000)
  mrnas: string[];
}
