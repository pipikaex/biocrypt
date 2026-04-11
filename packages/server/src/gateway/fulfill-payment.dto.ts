import { IsArray, IsString, ArrayMinSize } from "class-validator";

export class FulfillPaymentDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  mrnas: string[];
}
