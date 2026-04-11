import { Injectable, OnModuleInit, NotFoundException, BadRequestException } from "@nestjs/common";
import { GatewayService } from "../gateway/gateway.service";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const MARKETPLACE_DIR = path.join(DATA_DIR, "marketplace");

export type ListingStatus = "active" | "sold" | "cancelled";

export interface Listing {
  id: string;
  title: string;
  description: string;
  price: number;
  imageUrl: string;
  sellerPublicKeyHash: string;
  status: ListingStatus;
  buyerPublicKeyHash: string | null;
  paymentId: string | null;
  createdAt: number;
  soldAt: number | null;
}

@Injectable()
export class MarketplaceService implements OnModuleInit {
  constructor(private gateway: GatewayService) {}

  onModuleInit() {
    if (!fs.existsSync(MARKETPLACE_DIR)) {
      fs.mkdirSync(MARKETPLACE_DIR, { recursive: true });
    }
  }

  createListing(data: {
    title: string;
    description: string;
    price: number;
    imageUrl?: string;
    sellerPublicKeyHash: string;
  }): Listing {
    const id = crypto.randomBytes(12).toString("hex");
    const listing: Listing = {
      id,
      title: data.title,
      description: data.description,
      price: data.price,
      imageUrl: data.imageUrl || "",
      sellerPublicKeyHash: data.sellerPublicKeyHash,
      status: "active",
      buyerPublicKeyHash: null,
      paymentId: null,
      createdAt: Date.now(),
      soldAt: null,
    };
    this.persist(listing);
    return listing;
  }

  getListing(id: string): Listing {
    const listing = this.load(id);
    if (!listing) throw new NotFoundException("Listing not found");
    return listing;
  }

  listAll(): Listing[] {
    if (!fs.existsSync(MARKETPLACE_DIR)) return [];
    const files = fs.readdirSync(MARKETPLACE_DIR).filter((f) => f.endsWith(".json"));
    const listings: Listing[] = [];
    for (const file of files) {
      try {
        const data = JSON.parse(
          fs.readFileSync(path.join(MARKETPLACE_DIR, file), "utf-8"),
        );
        listings.push(data);
      } catch {}
    }
    return listings.sort((a, b) => b.createdAt - a.createdAt);
  }

  listActive(): Listing[] {
    return this.listAll().filter((l) => l.status === "active");
  }

  purchase(listingId: string, paymentId: string, buyerPublicKeyHash: string): Listing {
    const listing = this.getListing(listingId);

    if (listing.status !== "active") {
      throw new BadRequestException("Listing is no longer available");
    }

    const payment = this.gateway.getPayment(paymentId);

    if (payment.status !== "fulfilled") {
      throw new BadRequestException("Payment has not been fulfilled yet");
    }

    if (payment.amount < listing.price) {
      throw new BadRequestException(
        `Payment amount (${payment.amount}) is less than listing price (${listing.price})`,
      );
    }

    if (payment.recipientPublicKeyHash !== listing.sellerPublicKeyHash) {
      throw new BadRequestException("Payment recipient does not match seller");
    }

    listing.status = "sold";
    listing.buyerPublicKeyHash = buyerPublicKeyHash;
    listing.paymentId = paymentId;
    listing.soldAt = Date.now();
    this.persist(listing);

    return listing;
  }

  private persist(listing: Listing) {
    const filePath = path.join(MARKETPLACE_DIR, `${listing.id}.json`);
    const tmp = filePath + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(listing));
    fs.renameSync(tmp, filePath);
  }

  private load(id: string): Listing | null {
    const filePath = path.join(MARKETPLACE_DIR, `${id}.json`);
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  }
}
