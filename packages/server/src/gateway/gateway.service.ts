import { Injectable, OnModuleInit, BadRequestException, NotFoundException } from "@nestjs/common";
import { validateMRNA, deserializeMRNA, type mRNAPayload } from "@biocrypt/core";
import { RegistryService } from "../registry/registry.service";
import { NetworkService } from "../network/network.service";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const PAYMENTS_DIR = path.join(DATA_DIR, "payments");

export type PaymentStatus = "pending" | "fulfilled" | "expired";

export interface Payment {
  id: string;
  amount: number;
  recipientPublicKeyHash: string;
  description: string;
  metadata: Record<string, string>;
  status: PaymentStatus;
  mrnas: string[];
  createdAt: number;
  fulfilledAt: number | null;
  expiresAt: number;
}

@Injectable()
export class GatewayService implements OnModuleInit {
  constructor(
    private registry: RegistryService,
    private network: NetworkService,
  ) {}

  onModuleInit() {
    if (!fs.existsSync(PAYMENTS_DIR)) {
      fs.mkdirSync(PAYMENTS_DIR, { recursive: true });
    }
  }

  createPayment(data: {
    amount: number;
    recipientPublicKeyHash: string;
    description: string;
    metadata?: Record<string, string>;
  }): Payment {
    const id = crypto.randomBytes(16).toString("hex");
    const now = Date.now();
    const payment: Payment = {
      id,
      amount: data.amount,
      recipientPublicKeyHash: data.recipientPublicKeyHash,
      description: data.description,
      metadata: data.metadata || {},
      status: "pending",
      mrnas: [],
      createdAt: now,
      fulfilledAt: null,
      expiresAt: now + 30 * 60 * 1000,
    };
    this.persist(payment);
    return payment;
  }

  getPayment(id: string): Payment {
    const payment = this.load(id);
    if (!payment) throw new NotFoundException("Payment not found");
    if (payment.status === "pending" && Date.now() > payment.expiresAt) {
      payment.status = "expired";
      this.persist(payment);
    }
    return payment;
  }

  fulfillPayment(id: string, serializedMrnas: string[]): Payment {
    const payment = this.getPayment(id);

    if (payment.status === "fulfilled") {
      throw new BadRequestException("Payment already fulfilled");
    }
    if (payment.status === "expired") {
      throw new BadRequestException("Payment has expired");
    }

    const validatedMrnas: mRNAPayload[] = [];
    const networkGenome = this.network.getNetworkGenome();

    for (const raw of serializedMrnas) {
      let mrna: mRNAPayload;
      try {
        mrna = deserializeMRNA(raw);
      } catch {
        throw new BadRequestException("Invalid mRNA payload format");
      }

      try {
        validateMRNA(mrna, networkGenome);
      } catch (e: any) {
        throw new BadRequestException(`mRNA validation failed: ${e.message}`);
      }

      if (this.registry.isCoinSpent(mrna.coinSerialHash)) {
        throw new BadRequestException(
          `Coin ${mrna.coinSerialHash.slice(0, 12)}... already spent (double-spend)`,
        );
      }

      validatedMrnas.push(mrna);
    }

    if (validatedMrnas.length < payment.amount) {
      throw new BadRequestException(
        `Need ${payment.amount} coins but only ${validatedMrnas.length} valid mRNAs provided`,
      );
    }

    const accepted = validatedMrnas.slice(0, payment.amount);
    for (const mrna of accepted) {
      this.registry.markCoinSpent(mrna.coinSerialHash, "gateway");
    }

    payment.mrnas = serializedMrnas.slice(0, payment.amount);
    payment.status = "fulfilled";
    payment.fulfilledAt = Date.now();
    this.persist(payment);

    return payment;
  }

  getPaymentMrnas(id: string): string[] {
    const payment = this.getPayment(id);
    if (payment.status !== "fulfilled") {
      throw new BadRequestException("Payment not yet fulfilled");
    }
    return payment.mrnas;
  }

  private persist(payment: Payment) {
    const filePath = path.join(PAYMENTS_DIR, `${payment.id}.json`);
    const tmp = filePath + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(payment));
    fs.renameSync(tmp, filePath);
  }

  private load(id: string): Payment | null {
    const filePath = path.join(PAYMENTS_DIR, `${id}.json`);
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  }
}
