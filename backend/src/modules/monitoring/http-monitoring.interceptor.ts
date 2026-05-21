import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor
} from "@nestjs/common";
import { Observable, tap } from "rxjs";
import { MonitoringService } from "./monitoring.service";

@Injectable()
export class HttpMonitoringInterceptor implements NestInterceptor {
  constructor(private readonly monitoring: MonitoringService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== "http") {
      return next.handle();
    }

    const startedAt = Date.now();
    const http = context.switchToHttp();
    const request = http.getRequest();
    const response = http.getResponse();

    return next.handle().pipe(
      tap({
        next: () => {
          this.monitoring.recordHttp({
            method: request.method,
            path: request.originalUrl ?? request.url,
            statusCode: response.statusCode,
            durationMs: Date.now() - startedAt
          });
        },
        error: (error) => {
          this.monitoring.recordHttp({
            method: request.method,
            path: request.originalUrl ?? request.url,
            statusCode: error?.status ?? response.statusCode ?? 500,
            durationMs: Date.now() - startedAt
          });
        }
      })
    );
  }
}
