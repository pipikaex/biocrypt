import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  IsNumber,
  IsInt,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

class MiningProofDto {
  @IsNumber()
  @IsInt()
  @Min(0)
  nonce: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  hash: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  difficulty: string;
}

export class TransferDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  senderWalletId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  senderPrivateKeyDNA: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  coinSerialHash: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  recipientPublicKeyHash?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  networkSignature: string;

  @ValidateNested()
  @Type(() => MiningProofDto)
  miningProof: MiningProofDto;
}

export class ReceiveDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  walletId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500000)
  mrna: string;
}

export class ValidateDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500000)
  mrna: string;
}

export class ValidateBundleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000000)
  data: string;
}
