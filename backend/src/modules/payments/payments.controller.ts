import { Body, Controller, Get, Header, Headers, Param, Post, Query, Req } from "@nestjs/common";

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
  @Get("stripe-return")
  @Header("Content-Type", "text/html; charset=utf-8")
  async stripeReturn(@Query("session_id") sessionId: string | undefined) {
    if (!sessionId) {
      return this.renderStripeReturnPage(
        "No pudimos confirmar el pago",
        "Stripe no regreso el identificador de la sesion. Vuelve a RapiV y actualiza el pedido."
      );
    }

    try {
      const payment = await this.paymentsService.syncPaymentByCheckoutSession(sessionId);
      const isPaid = payment.status === "SUCCEEDED";

      return this.renderStripeReturnPage(
        isPaid ? "Pago confirmado" : "Pago pendiente",
        isPaid
          ? "Tu pedido ya fue pagado. Regresa a RapiV para continuar."
          : "Stripe aun esta procesando el pago. Regresa a RapiV y actualiza el pedido en unos segundos."
      );
    } catch {
      return this.renderStripeReturnPage(
        "No pudimos confirmar el pago",
        "Regresa a RapiV y actualiza el pedido. Si el cargo aparece en Stripe, el soporte puede sincronizarlo."
      );
    }
  }

  @Public()
  @Get("stripe-cancelled")
  @Header("Content-Type", "text/html; charset=utf-8")
  stripeCancelled() {
    return this.renderStripeReturnPage(
      "Pago cancelado",
      "No se completo el cargo. Puedes regresar a RapiV e intentarlo de nuevo."
    );
  }

  @Public()
  @Post("webhooks/provider")
  receiveWebhook(
    @Headers("x-payment-signature") signature: string | undefined,
    @Headers("stripe-signature") stripeSignature: string | undefined,
    @Req() request: RawBodyRequest,
    @Body() dto: PaymentWebhookDto
  ) {
    return this.paymentsService.receiveWebhook(
      signature ?? stripeSignature,
      request.rawBody,
      dto
    );
  }

  private renderStripeReturnPage(title: string, message: string): string {
    return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 0; padding: 32px; color: #111827; background: #f8fafc; }
      main { max-width: 520px; margin: 15vh auto 0; background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px; }
      h1 { font-size: 24px; margin: 0 0 12px; }
      p { font-size: 16px; line-height: 1.5; margin: 0; color: #4b5563; }
    </style>
  </head>
  <body>
    <main>
      <h1>${title}</h1>
      <p>${message}</p>
    </main>
  </body>
</html>`;
  }
}
