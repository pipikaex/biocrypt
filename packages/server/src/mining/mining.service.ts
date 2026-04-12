import { Injectable, BadRequestException } from "@nestjs/common";
import {
  mineCoin, signCoinWithNetwork, integrateCoinIntoWallet,
  verifyMiningProofWithTarget, ribosome, sha256,
  DEFAULT_BODY_LENGTH,
  type MiningResult, type SignedCoin, type RFLPFingerprint,
} from "@zcoin/core";
import { NetworkService } from "../network/network.service";
import { WalletService } from "../wallet/wallet.service";

@Injectable()
export class MiningService {
  private feeRate = parseFloat(process.env.NETWORK_FEE_RATE || "0.1");

  constructor(
    private network: NetworkService,
    private walletService: WalletService,
  ) {}

  mine(): MiningResult {
    return mineCoin(this.network.getDifficultyPrefix(), DEFAULT_BODY_LENGTH);
  }

  signCoin(miningResult: MiningResult): SignedCoin {
    return signCoinWithNetwork(
      miningResult,
      this.network.getNetworkPrivateKeyDNA(),
      this.network.getNetworkId(),
      this.network.getNetworkGenome(),
    );
  }

  mineAndSign(): SignedCoin {
    const mined = this.mine();
    return this.signCoin(mined);
  }

  submitBrowserMinedCoin(submission: {
    coinGene: string;
    nonce: number;
    hash: string;
    difficulty: string;
  }): {
    coin: {
      serial: string;
      serialHash: string;
      networkId: string;
      networkSignature: string;
      networkGenome: string;
      rflpFingerprint?: RFLPFingerprint;
      miningProof: { nonce: number; hash: string; difficulty: string };
    };
    blockReward: number;
    bonusCoins: Array<{
      coinGene: string;
      serial: string;
      serialHash: string;
      aminoAcids: string[];
      nonce: number;
      hash: string;
      difficulty: string;
      networkId: string;
      networkSignature: string;
      networkGenome: string;
      rflpFingerprint?: RFLPFingerprint;
    }>;
    feeCoinMinted: boolean;
    difficultyAdjusted: boolean;
    currentDifficulty: string;
    currentTarget: string;
    halvingEra: number;
    halvingEraName: string;
    telomerePercent: number;
  } {
    if (this.network.isSupplyExhausted()) {
      throw new BadRequestException(
        "Supply exhausted: all 21,000,000 zcoin have been mined. The network telomeres have reached zero length (Hayflick limit).",
      );
    }

    if (!submission.coinGene || submission.coinGene.length > 2000) {
      throw new BadRequestException("Invalid coin gene length");
    }

    const target = this.network.getDifficultyTarget();

    if (!verifyMiningProofWithTarget(submission.coinGene, submission.nonce, target)) {
      throw new BadRequestException(
        `Invalid proof-of-work. Network target: ${target.slice(0, 12)}... (prefix "${this.network.getDifficultyPrefix()}"), your hash: ${submission.hash}`,
      );
    }

    const result = ribosome(submission.coinGene);
    const protein = result.proteins[0];
    if (!protein) {
      throw new BadRequestException("Invalid coin gene: no protein could be translated");
    }
    const serial = protein.aminoAcids.slice(4).join("-");
    const serialHash = sha256(serial);

    if (this.network.isSerialAlreadySigned(serialHash)) {
      throw new BadRequestException("Duplicate coin: this coin has already been signed by the network");
    }

    const blockReward = this.network.getCurrentBlockReward();
    const actualReward = this.network.consumeTelomere(blockReward);

    if (actualReward <= 0) {
      throw new BadRequestException("Supply exhausted: telomeres depleted.");
    }

    const miningResult: MiningResult = {
      coinGene: submission.coinGene,
      protein,
      serial,
      serialHash,
      nonce: submission.nonce,
      hash: submission.hash,
      difficulty: submission.difficulty,
      minedAt: Date.now(),
    };

    const signed = this.signCoin(miningResult);
    this.network.registerSignedSerial(serialHash);
    this.network.incrementSignedCoins();
    this.network.integrateCoinIntoNetworkDNA(submission.coinGene);

    const bonusCoins: Array<{
      coinGene: string;
      serial: string;
      serialHash: string;
      aminoAcids: string[];
      nonce: number;
      hash: string;
      difficulty: string;
      networkId: string;
      networkSignature: string;
      networkGenome: string;
      rflpFingerprint?: RFLPFingerprint;
    }> = [];

    for (let i = 1; i < actualReward; i++) {
      try {
        const bonusGene = this.generateBonusCoinGene(serialHash, i);
        const bonusResult = ribosome(bonusGene);
        const bonusProtein = bonusResult.proteins[0];
        if (!bonusProtein) continue;
        const bonusSerial = bonusProtein.aminoAcids.slice(4).join("-");
        const bonusSerialHash = sha256(bonusSerial);
        if (this.network.isSerialAlreadySigned(bonusSerialHash)) continue;

        const bonusMR: MiningResult = {
          coinGene: bonusGene,
          protein: bonusProtein,
          serial: bonusSerial,
          serialHash: bonusSerialHash,
          nonce: submission.nonce,
          hash: sha256(bonusGene + "|" + submission.nonce),
          difficulty: submission.difficulty,
          minedAt: Date.now(),
        };
        const bonusSigned = this.signCoin(bonusMR);
        this.network.registerSignedSerial(bonusSerialHash);
        this.network.incrementSignedCoins();
        this.network.integrateCoinIntoNetworkDNA(bonusGene);
        bonusCoins.push({
          coinGene: bonusGene,
          serial: bonusSigned.serial,
          serialHash: bonusSigned.serialHash,
          aminoAcids: bonusProtein.aminoAcids,
          nonce: submission.nonce,
          hash: sha256(bonusGene + "|" + submission.nonce),
          difficulty: submission.difficulty,
          networkId: bonusSigned.networkId,
          networkSignature: bonusSigned.networkSignature,
          networkGenome: bonusSigned.networkGenome,
          rflpFingerprint: bonusSigned.rflpFingerprint,
        });
      } catch {
        // bonus coin generation is best-effort
      }
    }

    const adjustment = this.network.recordSubmission();

    let feeCoinMinted = false;
    if (this.feeRate > 0 && Math.random() < this.feeRate) {
      try {
        this.network.mintNetworkFeeCoin(this);
        feeCoinMinted = true;
      } catch {}
    }

    return {
      coin: {
        serial: signed.serial,
        serialHash: signed.serialHash,
        networkId: signed.networkId,
        networkSignature: signed.networkSignature,
        networkGenome: signed.networkGenome,
        rflpFingerprint: signed.rflpFingerprint,
        miningProof: signed.miningProof,
      },
      blockReward: actualReward,
      bonusCoins,
      feeCoinMinted,
      difficultyAdjusted: adjustment.adjusted,
      currentDifficulty: this.network.getDifficultyPrefix(),
      currentTarget: this.network.getDifficultyTarget(),
      halvingEra: this.network.getHalvingEra(),
      halvingEraName: this.network.getHalvingEraName(),
      telomerePercent: this.network.getTelomerePercent(),
    };
  }

  private generateBonusCoinGene(parentSerialHash: string, index: number): string {
    const COIN_HEADER = "ATGGGGTGGTGC";
    const BASES_ARR = ["T", "A", "C", "G"];
    const STOP = new Set(["TAA", "TAG", "TGA"]);
    let body = "";
    const seed = sha256(parentSerialHash + "|bonus|" + index + "|" + Date.now());
    let seedIdx = 0;
    while (body.length < DEFAULT_BODY_LENGTH) {
      if (seedIdx + 6 > seed.length) {
        seedIdx = 0;
      }
      const v = parseInt(seed.slice(seedIdx, seedIdx + 2), 16);
      seedIdx += 2;
      const c = BASES_ARR[(v >> 4) & 3] + BASES_ARR[(v >> 2) & 3] + BASES_ARR[v & 3];
      if (!STOP.has(c) && c !== "ATG") body += c;
    }
    const stamp = sha256(seed + "|stamp");
    let nonceCodons = "";
    for (let i = 0; i < 6; i++) {
      const val = parseInt(stamp.slice(i * 2, i * 2 + 2), 16) % 64;
      const b0 = BASES_ARR[(val >> 4) & 3];
      const b1 = BASES_ARR[(val >> 2) & 3];
      const b2 = BASES_ARR[val & 3];
      const cod = b0 + b1 + b2;
      nonceCodons += (STOP.has(cod) || cod === "ATG") ? "GCT" : cod;
    }
    return COIN_HEADER + body + nonceCodons + "TAA";
  }

  integrateIntoWallet(walletId: string, coin: SignedCoin): void {
    const wallet = this.walletService.getById(walletId);
    if (!wallet) throw new Error("Wallet not found");
    const newDNA = integrateCoinIntoWallet(wallet.dna, coin);
    this.walletService.updateDNA(walletId, newDNA);
  }

  verifyProof(coinGene: string, nonce: number): boolean {
    return verifyMiningProofWithTarget(coinGene, nonce, this.network.getDifficultyTarget());
  }

  getDifficulty(): string {
    return this.network.getDifficultyPrefix();
  }

  getDifficultyTarget(): string {
    return this.network.getDifficultyTarget();
  }

  getSubmissionCount(): number {
    return this.network.getTotalSubmissions();
  }
}
