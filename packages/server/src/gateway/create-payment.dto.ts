import { IsString, IsNumber, IsNotEmpty, IsInt, Min, Max, MaxLength, IsOptional, IsObject } from "class-validator";

export class CreatePaymentDto {
  @IsNumber()
  @IsInt()
  @Min(1)
  @Max(10000)
  amount: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  recipientPublicKeyHash: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  description: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, string>;
}
