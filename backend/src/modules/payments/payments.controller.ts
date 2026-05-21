import { Body, Controller, Get, Headers, Param, Post, Req } from "@nestjs/common";

import { CurrentUser } from "../../common/auth/current-user.decorator";
import type { AuthenticatedUser } from "../../common/auth/jwt-auth.guard";
import { Public } from "../../common/auth/public.decorator";
import { CreatePaymentDto } from "./dto/create-payment.dto";
import { PaymentWebhookDto } from "./dto/payment-webhook.dto";
import { PaymentsService } from "./payments.service";

type RawBodyRequest = {
  rawBody?: Buffer;
};

@Controller("payments")
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  createPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body() dto: CreatePaymentDto
  ) {
    return this.paymentsService.createPayment(user.sub, idempotencyKey, dto);
  }

  @Get("orders/:orderGroupId")
  findMine(
    @CurrentUser() user: AuthenticatedUser,
    @Param("orderGroupId") orderGroupId: string
  ) {
    return this.paymentsService.findMine(user.sub, orderGroupId);
  }

  @Post(":paymentId/sync")
  syncPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param("paymentId") paymentId: string
  ) {
    return this.paymentsService.syncPayment(user.sub, paymentId);
  }

  @Public()
  @Post("webhooks/provider")
  receiveWebhook(
    @Headers("x-payment-signature") signature: string | undefined,
    @Headers("x-signature") mercadoPagoSignature: string | undefined,
    @Headers("x-request-id") mercadoPagoRequestId: string | undefined,
    @Req() request: RawBodyRequest,
    @Body() dto: PaymentWebhookDto
  ) {
    return this.paymentsService.receiveWebhook(
      signature ?? mercadoPagoSignature,
      request.rawBody,
      dto,
      mercadoPagoRequestId
    );
  }
}
