import { Injectable } from "@nestjs/common";
import {
  mineCoin, signCoinWithNetwork, integrateCoinIntoWallet,
  verifyMiningProofWithTarget, type MiningResult, type SignedCoin,
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
    return mineCoin(this.network.getDifficultyPrefix());
  }

  signCoin(miningResult: MiningResult): SignedCoin {
    return signCoinWithNetwork(
      miningResult,
      this.network.getNetworkDNA(),
      this.network.getNetworkId(),
    );
  }

  mineAndSign(): SignedCoin {
    const mined = this.mine();
    return this.signCoin(mined);
  }

  submitBrowserMinedCoin(submission: {
    coinGene: string;
    serial: string;
    serialHash: string;
    nonce: number;
    hash: string;
    difficulty: string;
  }): {
    coin: { serial: string; serialHash: string; networkId: string; networkSignature: string; miningProof: { nonce: number; hash: string; difficulty: string } };
    feeCoinMinted: boolean;
    difficultyAdjusted: boolean;
    currentDifficulty: string;
    currentTarget: string;
  } {
    const target = this.network.getDifficultyTarget();

    if (!verifyMiningProofWithTarget(submission.coinGene, submission.nonce, target)) {
      throw new Error(
        `Invalid proof-of-work. Network target: ${target.slice(0, 12)}... (prefix "${this.network.getDifficultyPrefix()}"), your hash: ${submission.hash}`,
      );
    }

    const miningResult: MiningResult = {
      coinGene: submission.coinGene,
      protein: null as any,
      serial: submission.serial,
      serialHash: submission.serialHash,
      nonce: submission.nonce,
      hash: submission.hash,
      difficulty: submission.difficulty,
      minedAt: Date.now(),
    };

    const signed = this.signCoin(miningResult);
    this.network.incrementSignedCoins();

    const adjustment = this.network.recordSubmission();

    let feeCoinMinted = false;
    if (this.feeRate > 0 && Math.random() < this.feeRate) {
      try {
        this.network.mintNetworkFeeCoin(this);
        feeCoinMinted = true;
      } catch {
        // Fee minting is best-effort
      }
    }

    return {
      coin: {
        serial: signed.serial,
        serialHash: signed.serialHash,
        networkId: signed.networkId,
        networkSignature: signed.networkSignature,
        miningProof: signed.miningProof,
      },
      feeCoinMinted,
      difficultyAdjusted: adjustment.adjusted,
      currentDifficulty: this.network.getDifficultyPrefix(),
      currentTarget: this.network.getDifficultyTarget(),
    };
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
