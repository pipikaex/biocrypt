import { IsString, IsNumber, IsNotEmpty, Min, IsOptional, IsUrl } from "class-validator";

export class CreateListingDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsNumber()
  @Min(1)
  price: number;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsString()
  @IsNotEmpty()
  sellerPublicKeyHash: string;
}

export class PurchaseListingDto {
  @IsString()
  @IsNotEmpty()
  paymentId: string;

  @IsString()
  @IsNotEmpty()
  buyerPublicKeyHash: string;
}
