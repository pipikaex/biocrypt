import { IsString, IsNumber, IsNotEmpty, IsInt, Min, Max, MaxLength } from "class-validator";

export class CreateListingDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  description: string;

  @IsNumber()
  @IsInt()
  @Min(1)
  @Max(1000000)
  price: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  sellerPublicKeyHash: string;
}

export class PurchaseListingDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  paymentId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  buyerPublicKeyHash: string;
}
