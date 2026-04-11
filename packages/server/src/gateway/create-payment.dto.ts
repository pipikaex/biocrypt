import { IsString, IsNumber, IsNotEmpty, Min, IsOptional, IsObject } from "class-validator";

export class CreatePaymentDto {
  @IsNumber()
  @Min(1)
  amount: number;

  @IsString()
  @IsNotEmpty()
  recipientPublicKeyHash: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, string>;
}
