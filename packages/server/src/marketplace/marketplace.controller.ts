import { Controller, Post, Get, Param, Body, Query, Res, UseInterceptors, UploadedFile, BadRequestException } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Response } from "express";
import { MarketplaceService } from "./marketplace.service";
import { PurchaseListingDto } from "./create-listing.dto";

@Controller("marketplace")
export class MarketplaceController {
  constructor(private readonly marketplace: MarketplaceService) {}

  @Post("listings")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 100 * 1024 * 1024 } }))
  createListing(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { title?: string; description?: string; price?: string; sellerPublicKeyHash?: string },
  ) {
    if (!body.title || !body.description || !body.price || !body.sellerPublicKeyHash) {
      throw new BadRequestException("Missing required fields: title, description, price, sellerPublicKeyHash");
    }
    const price = parseInt(body.price, 10);
    if (isNaN(price) || price < 1) throw new BadRequestException("Price must be a positive integer");
    if (body.title.length > 200) throw new BadRequestException("Title too long");
    if (body.description.length > 5000) throw new BadRequestException("Description too long");

    const listing = this.marketplace.createListing(
      { title: body.title, description: body.description, price, sellerPublicKeyHash: body.sellerPublicKeyHash },
      file,
    );

    return {
      id: listing.id,
      title: listing.title,
      description: listing.description,
      price: listing.price,
      sellerPublicKeyHash: listing.sellerPublicKeyHash,
      status: listing.status,
      fileName: listing.fileName,
      fileSize: listing.fileSize,
      fileHash: listing.fileHash,
      createdAt: listing.createdAt,
    };
  }

  @Get("listings")
  listListings(@Query("status") status?: string) {
    const listings = status === "all" ? this.marketplace.listAll() : this.marketplace.listActive();
    return listings.map((l) => ({
      id: l.id,
      title: l.title,
      description: l.description,
      price: l.price,
      sellerPublicKeyHash: l.sellerPublicKeyHash,
      status: l.status,
      fileName: l.fileName,
      fileSize: l.fileSize,
      fileHash: l.fileHash,
      createdAt: l.createdAt,
      soldAt: l.soldAt,
      downloads: l.downloads,
    }));
  }

  @Get("listings/:id")
  getListing(@Param("id") id: string) {
    const l = this.marketplace.getListing(id);
    return {
      id: l.id,
      title: l.title,
      description: l.description,
      price: l.price,
      sellerPublicKeyHash: l.sellerPublicKeyHash,
      status: l.status,
      buyerPublicKeyHash: l.buyerPublicKeyHash,
      fileName: l.fileName,
      fileSize: l.fileSize,
      fileMime: l.fileMime,
      fileHash: l.fileHash,
      createdAt: l.createdAt,
      soldAt: l.soldAt,
      downloads: l.downloads,
    };
  }

  @Post("listings/:id/purchase")
  purchase(@Param("id") id: string, @Body() dto: PurchaseListingDto) {
    return this.marketplace.purchase(id, dto.paymentId, dto.buyerPublicKeyHash);
  }

  @Post("listings/:id/download")
  download(
    @Param("id") id: string,
    @Body() body: { buyerPublicKeyHash: string },
    @Res() res: Response,
  ) {
    if (!body.buyerPublicKeyHash) throw new BadRequestException("buyerPublicKeyHash required");

    const { stream, fileName, mime, size } = this.marketplace.getFileStream(id, body.buyerPublicKeyHash);

    res.set({
      "Content-Type": mime,
      "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
      "Content-Length": size.toString(),
    });

    stream.pipe(res);
  }

  @Post("listings/:id/mrnas")
  getSellerMrnas(
    @Param("id") id: string,
    @Body() body: { sellerPublicKeyHash: string },
  ) {
    if (!body.sellerPublicKeyHash) throw new BadRequestException("sellerPublicKeyHash required");
    const mrnas = this.marketplace.getSellerMrnas(id, body.sellerPublicKeyHash);
    return { mrnas };
  }
}
