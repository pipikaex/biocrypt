import { Controller, Post, Get, Param, Body, Query } from "@nestjs/common";
import { MarketplaceService } from "./marketplace.service";
import { CreateListingDto, PurchaseListingDto } from "./create-listing.dto";

@Controller("marketplace")
export class MarketplaceController {
  constructor(private readonly marketplace: MarketplaceService) {}

  @Post("listings")
  createListing(@Body() dto: CreateListingDto) {
    return this.marketplace.createListing(dto);
  }

  @Get("listings")
  listListings(@Query("status") status?: string) {
    if (status === "all") return this.marketplace.listAll();
    return this.marketplace.listActive();
  }

  @Get("listings/:id")
  getListing(@Param("id") id: string) {
    return this.marketplace.getListing(id);
  }

  @Post("listings/:id/purchase")
  purchase(@Param("id") id: string, @Body() dto: PurchaseListingDto) {
    return this.marketplace.purchase(id, dto.paymentId, dto.buyerPublicKeyHash);
  }
}
