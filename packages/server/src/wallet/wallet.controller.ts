import { Controller, Post, Get, Param, Res } from "@nestjs/common";
import { Response } from "express";
import { WalletService } from "./wallet.service";

@Controller("wallet")
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Post()
  create() {
    const { wallet, privateKeyDNA } = this.walletService.create();
    return {
      id: wallet.id,
      publicKeyHash: wallet.publicKeyHash,
      privateKeyDNA,
      warning: "Store your private key DNA securely. It cannot be recovered.",
    };
  }

  @Get()
  listAll() {
    return this.walletService.listAll().map((w) => ({
      id: w.id,
      publicKeyHash: w.publicKeyHash,
      createdAt: w.createdAt,
    }));
  }

  @Get(":id")
  view(@Param("id") id: string) {
    return this.walletService.view(id);
  }

  @Get(":id/balance")
  balance(@Param("id") id: string) {
    const view = this.walletService.view(id);
    return { id, coins: view.coinCount, proteins: view.proteinCount };
  }

  @Get(":id/public-key")
  publicKey(@Param("id") id: string) {
    const view = this.walletService.view(id);
    return {
      id,
      publicKeyHash: view.publicKeyHash,
      proteinChain: view.ribosomeResult.publicKeyChain.slice(0, 200) + "...",
    };
  }

  @Get(":id/png")
  async getPNG(@Param("id") id: string, @Res() res: Response) {
    const { pixels, side } = this.walletService.getWalletPNG(id);

    try {
      const { createCanvas } = require("canvas");
      const canvas = createCanvas(side, side);
      const ctx = canvas.getContext("2d");
      const imageData = ctx.createImageData(side, side);
      imageData.data.set(pixels);
      ctx.putImageData(imageData, 0, 0);

      const buffer = canvas.toBuffer("image/png");
      res.set({ "Content-Type": "image/png", "Content-Length": buffer.length });
      res.send(buffer);
    } catch {
      res.json({ pixels: Array.from(pixels.slice(0, 100)), side, note: "Install canvas package for PNG output" });
    }
  }
}
