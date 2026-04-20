import { Injectable, OnModuleInit, NotFoundException, BadRequestException } from "@nestjs/common";
import { GatewayService } from "../gateway/gateway.service";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const MARKETPLACE_DIR = path.join(DATA_DIR, "marketplace");
const FILES_DIR = path.join(DATA_DIR, "files");

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

export type ListingStatus = "active" | "sold" | "cancelled";

export interface Listing {
  id: string;
  title: string;
  description: string;
  price: number;
  sellerPublicKeyHash: string;
  status: ListingStatus;
  buyerPublicKeyHash: string | null;
  paymentId: string | null;
  createdAt: number;
  soldAt: number | null;
  fileId: string;
  fileName: string;
  fileSize: number;
  fileMime: string;
  fileHash: string;
  downloads: number;
}

@Injectable()
export class MarketplaceService implements OnModuleInit {
  constructor(private gateway: GatewayService) {}

  onModuleInit() {
    for (const dir of [MARKETPLACE_DIR, FILES_DIR]) {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    }
  }

  createListing(data: {
    title: string;
    description: string;
    price: number;
    sellerPublicKeyHash: string;
  }, file: Express.Multer.File): Listing {
    if (!file) throw new BadRequestException("File is required");
    if (file.size > MAX_FILE_SIZE) throw new BadRequestException("File too large (max 100MB)");

    const id = crypto.randomBytes(12).toString("hex");
    const fileId = crypto.randomBytes(16).toString("hex");
    const ext = path.extname(file.originalname) || "";
    const safeFileName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200);
    const storedName = fileId + ext;

    const hashStream = crypto.createHash("sha256");
    hashStream.update(file.buffer);
    const fileHash = hashStream.digest("hex");

    fs.writeFileSync(path.join(FILES_DIR, storedName), file.buffer);

    const listing: Listing = {
      id,
      title: data.title,
      description: data.description,
      price: data.price,
      sellerPublicKeyHash: data.sellerPublicKeyHash,
      status: "active",
      buyerPublicKeyHash: null,
      paymentId: null,
      createdAt: Date.now(),
      soldAt: null,
      fileId,
      fileName: safeFileName,
      fileSize: file.size,
      fileMime: file.mimetype || "application/octet-stream",
      fileHash,
      downloads: 0,
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
        const data = JSON.parse(fs.readFileSync(path.join(MARKETPLACE_DIR, file), "utf-8"));
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

  getFileStream(listingId: string, buyerPublicKeyHash: string): {
    stream: fs.ReadStream;
    fileName: string;
    mime: string;
    size: number;
  } {
    const listing = this.getListing(listingId);

    if (listing.status !== "sold") {
      throw new BadRequestException("File not available — listing not purchased");
    }

    if (listing.buyerPublicKeyHash !== buyerPublicKeyHash &&
        listing.sellerPublicKeyHash !== buyerPublicKeyHash) {
      throw new BadRequestException("Not authorized to download this file");
    }

    const ext = path.extname(listing.fileName) || "";
    const storedName = listing.fileId + ext;
    const filePath = path.join(FILES_DIR, storedName);

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException("File not found on server");
    }

    listing.downloads++;
    this.persist(listing);

    return {
      stream: fs.createReadStream(filePath),
      fileName: listing.fileName,
      mime: listing.fileMime,
      size: listing.fileSize,
    };
  }

  getSellerMrnas(listingId: string, sellerPublicKeyHash: string): string[] {
    const listing = this.getListing(listingId);

    if (listing.sellerPublicKeyHash !== sellerPublicKeyHash) {
      throw new BadRequestException("Not authorized — not the seller");
    }

    if (listing.status !== "sold" || !listing.paymentId) {
      throw new BadRequestException("Listing has not been sold yet");
    }

    return this.gateway.getPaymentMrnas(listing.paymentId);
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
    try {
      return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    } catch {
      return null;
    }
  }
}
