import { Controller, Get, Query, Res } from "@nestjs/common";

import { Public } from "../../common/auth/public.decorator";
import { OrdersService } from "./orders.service";

type HtmlResponse = {
  type: (contentType: string) => HtmlResponse;
  send: (body: string) => void;
};

@Controller()
export class CourierStripeConnectReturnController {
  constructor(private readonly ordersService: OrdersService) {}

  @Public()
  @Get("courier-stripe-return")
  async stripeReturn(
    @Query("courierId") courierId: string | undefined,
    @Res() response: HtmlResponse
  ) {
    const status = courierId
      ? await this.tryRefreshStatus(courierId)
      : "missing";

    response.type("html").send(this.renderPage({
      title: "Stripe Connect configurado",
      message: status === "ready"
        ? "Tu cuenta ya puede recibir pagos de reparto. Regresa a RapiV y toca Actualizar estado."
        : "Stripe recibio tu informacion. Regresa a RapiV y toca Actualizar estado para confirmar si ya esta lista."
    }));
  }

  @Public()
  @Get("courier-stripe-refresh")
  stripeRefresh(@Res() response: HtmlResponse) {
    response.type("html").send(this.renderPage({
      title: "Continua la configuracion",
      message: "Vuelve a RapiV Repartidor y toca Configurar Stripe para abrir un nuevo enlace seguro."
    }));
  }

  private async tryRefreshStatus(courierId: string): Promise<"ready" | "pending"> {
    try {
      const profile = await this.ordersService.refreshCourierStripeConnectStatusFromReturn(courierId);
      return profile.stripePayoutsEnabled ? "ready" : "pending";
    } catch {
      return "pending";
    }
  }

  private renderPage(input: { title: string; message: string }): string {
    return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${input.title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; padding: 32px; color: #0f172a; }
    main { max-width: 560px; margin: 20vh auto 0; }
    h1 { font-size: 28px; margin-bottom: 12px; }
    p { color: #475569; font-size: 17px; line-height: 1.5; }
  </style>
</head>
<body>
  <main>
    <h1>${input.title}</h1>
    <p>${input.message}</p>
  </main>
</body>
</html>`;
  }
}
