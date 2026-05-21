import { Injectable, NestMiddleware } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { RequestContextService } from "./request-context.service";

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  constructor(private readonly requestContext: RequestContextService) {}

  use(req: any, res: any, next: () => void): void {
    const incoming = req.headers["x-correlation-id"];
    const correlationId =
      typeof incoming === "string" && incoming.trim()
        ? incoming.trim()
        : randomUUID();

    res.setHeader("x-correlation-id", correlationId);

    this.requestContext.run(
      {
        correlationId,
        method: req.method,
        path: req.originalUrl ?? req.url
      },
      next
    );
  }
}
