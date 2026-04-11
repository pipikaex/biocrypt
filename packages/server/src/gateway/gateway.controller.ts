import { Controller, Post, Get, Param, Body } from "@nestjs/common";
import { GatewayService } from "./gateway.service";
import { CreatePaymentDto } from "./create-payment.dto";
import { FulfillPaymentDto } from "./fulfill-payment.dto";

@Controller("gateway")
export class GatewayController {
  constructor(private readonly gateway: GatewayService) {}

  @Post("payments")
  createPayment(@Body() dto: CreatePaymentDto) {
    const payment = this.gateway.createPayment(dto);
    return {
      paymentId: payment.id,
      status: payment.status,
      amount: payment.amount,
      description: payment.description,
      recipientPublicKeyHash: payment.recipientPublicKeyHash,
      paymentUrl: `/pay/${payment.id}`,
      expiresAt: payment.expiresAt,
    };
  }

  @Get("payments/:id")
  getPayment(@Param("id") id: string) {
    const p = this.gateway.getPayment(id);
    return {
      paymentId: p.id,
      status: p.status,
      amount: p.amount,
      description: p.description,
      recipientPublicKeyHash: p.recipientPublicKeyHash,
      metadata: p.metadata,
      mrnasReceived: p.mrnas.length,
      createdAt: p.createdAt,
      fulfilledAt: p.fulfilledAt,
      expiresAt: p.expiresAt,
    };
  }

  @Post("payments/:id/fulfill")
  fulfillPayment(@Param("id") id: string, @Body() dto: FulfillPaymentDto) {
    const payment = this.gateway.fulfillPayment(id, dto.mrnas);
    return {
      paymentId: payment.id,
      status: payment.status,
      amount: payment.amount,
      mrnasReceived: payment.mrnas.length,
      fulfilledAt: payment.fulfilledAt,
    };
  }

  @Get("payments/:id/mrnas")
  getPaymentMrnas(@Param("id") id: string) {
    const mrnas = this.gateway.getPaymentMrnas(id);
    return { paymentId: id, mrnas };
  }
}
