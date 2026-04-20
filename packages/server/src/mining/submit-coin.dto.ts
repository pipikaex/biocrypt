import { IsString, IsNumber, IsNotEmpty, Matches, Min, IsOptional, IsArray, ValidateNested, MaxLength, IsInt, ArrayMaxSize } from "class-validator";
import { Type } from "class-transformer";

export class MerkleProofStepDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  @Matches(/^[a-f0-9]+$/, { message: "hash must be a hex string" })
  hash: string;

  @IsString()
  @Matches(/^(left|right)$/)
  position: "left" | "right";
}

export class BonusCoinDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  @Matches(/^[TACG]+$/, { message: "coinGene must be a valid DNA string" })
  coinGene: string;

  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => MerkleProofStepDto)
  merkleProof: MerkleProofStepDto[];
}

export class MineDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  walletId?: string;
}

export class SubmitCoinDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  @Matches(/^[TACG]+$/, { message: "coinGene must be a valid DNA string (T, A, C, G only)" })
  coinGene: string;

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

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => BonusCoinDto)
  bonusCoinGenes?: BonusCoinDto[];
}
