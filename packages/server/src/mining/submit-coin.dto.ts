import { IsString, IsNumber, IsNotEmpty, Matches, Min } from "class-validator";

export class SubmitCoinDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[TACG]+$/, { message: "coinGene must be a valid DNA string (T, A, C, G only)" })
  coinGene: string;

  @IsNumber()
  @Min(0)
  nonce: number;

  @IsString()
  @IsNotEmpty()
  hash: string;

  @IsString()
  @IsNotEmpty()
  difficulty: string;
}
