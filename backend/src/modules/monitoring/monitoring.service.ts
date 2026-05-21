import { Injectable } from "@nestjs/common";
import { RequestContextService } from "./request-context.service";

type CounterMap = Record<string, number>;

type HttpMetric = {
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
};

type WorkerMetric = {
  queue: string;
  jobName: string;
  status: "completed" | "failed";
  durationMs: number;
};

@Injectable()
export class MonitoringService {
  private readonly startedAt = new Date();
  private readonly counters: CounterMap = {};
  private readonly httpDurationsMs: number[] = [];
  private readonly workerDurationsMs: Record<string, number[]> = {};
  private readonly recentEvents: Array<Record<string, unknown>> = [];
  private readonly maxRecentEvents = 250;

  constructor(private readonly requestContext: RequestContextService) {}

  recordHttp(metric: HttpMetric): void {
    const family = `${metric.method} ${this.normalizePath(metric.path)}`;
    this.increment("http.requests.total");
    this.increment(`http.requests.status.${metric.statusCode}`);
    this.increment(`http.requests.route.${this.metricKey(family)}`);
    this.httpDurationsMs.push(metric.durationMs);
    this.trimDurations(this.httpDurationsMs);

    this.logEvent("http_request", {
      ...metric,
      route: family
    });
  }

  recordWorkerJob(metric: WorkerMetric): void {
    this.increment(`worker.jobs.${metric.status}`);
    this.increment(`worker.jobs.queue.${this.metricKey(metric.queue)}.${metric.status}`);

    const durations = this.workerDurationsMs[metric.queue] ?? [];
    durations.push(metric.durationMs);
    this.trimDurations(durations);
    this.workerDurationsMs[metric.queue] = durations;

    this.logEvent("worker_job", metric);
  }

  recordOrderEvent(event: string, details: Record<string, unknown>): void {
    this.increment(`orders.events.${event}`);
    this.logEvent(`order_${event}`, details);
  }

  recordPaymentEvent(event: string, details: Record<string, unknown>): void {
    this.increment(`payments.events.${event}`);
    this.logEvent(`payment_${event}`, details);
  }

  recordNotificationEvent(event: string, details: Record<string, unknown>): void {
    this.increment(`notifications.events.${event}`);
    this.logEvent(`notification_${event}`, details);
  }

  snapshot() {
    return {
      service: "rapiv-backend",
      startedAt: this.startedAt.toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      counters: this.counters,
      http: {
        requests: this.counters["http.requests.total"] ?? 0,
        durationMs: this.summarize(this.httpDurationsMs)
      },
      workers: Object.fromEntries(
        Object.entries(this.workerDurationsMs).map(([queue, durations]) => [
          queue,
          { durationMs: this.summarize(durations) }
        ])
      ),
      recentEvents: [...this.recentEvents].reverse()
    };
  }

  prometheusMetrics(): string {
    const lines: string[] = [
      "# HELP rapiv_info RapiV backend service info.",
      "# TYPE rapiv_info gauge",
      'rapiv_info{service="rapiv-backend"} 1',
      "# HELP rapiv_uptime_seconds Process uptime in seconds.",
      "# TYPE rapiv_uptime_seconds gauge",
      `rapiv_uptime_seconds ${Math.round(process.uptime())}`,
      "# HELP rapiv_counter_total Internal application counters.",
      "# TYPE rapiv_counter_total counter"
    ];

    for (const [key, value] of Object.entries(this.counters)) {
      lines.push(`rapiv_counter_total{name="${this.escapeLabel(key)}"} ${value}`);
    }

    const http = this.summarize(this.httpDurationsMs);
    lines.push("# HELP rapiv_http_duration_ms HTTP request duration summary.");
    lines.push("# TYPE rapiv_http_duration_ms gauge");
    lines.push(`rapiv_http_duration_ms{quantile="avg"} ${http.avg}`);
    lines.push(`rapiv_http_duration_ms{quantile="p95"} ${http.p95}`);
    lines.push(`rapiv_http_duration_ms{quantile="max"} ${http.max}`);

    lines.push("# HELP rapiv_worker_duration_ms Worker job duration summary by queue.");
    lines.push("# TYPE rapiv_worker_duration_ms gauge");
    for (const [queue, durations] of Object.entries(this.workerDurationsMs)) {
      const summary = this.summarize(durations);
      lines.push(`rapiv_worker_duration_ms{queue="${this.escapeLabel(queue)}",quantile="avg"} ${summary.avg}`);
      lines.push(`rapiv_worker_duration_ms{queue="${this.escapeLabel(queue)}",quantile="p95"} ${summary.p95}`);
      lines.push(`rapiv_worker_duration_ms{queue="${this.escapeLabel(queue)}",quantile="max"} ${summary.max}`);
    }

    return `${lines.join("\n")}\n`;
  }

  private increment(key: string, value = 1): void {
    this.counters[key] = (this.counters[key] ?? 0) + value;
  }

  private logEvent(type: string, details: Record<string, unknown>): void {
    const context = this.requestContext.get();
    const event = {
      timestamp: new Date().toISOString(),
      type,
      correlationId: context?.correlationId,
      userId: context?.userId,
      ...details
    };

    this.recentEvents.push(event);

    if (this.recentEvents.length > this.maxRecentEvents) {
      this.recentEvents.shift();
    }

    console.log(JSON.stringify(event));
  }

  private normalizePath(path: string): string {
    return path.replace(/[0-9a-fA-F]{8}-[0-9a-fA-F-]{27,}/g, ":id");
  }

  private metricKey(value: string): string {
    return value.replace(/[^a-zA-Z0-9_.-]/g, "_");
  }

  private escapeLabel(value: string): string {
    return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }

  private trimDurations(values: number[]): void {
    if (values.length > 1000) {
      values.splice(0, values.length - 1000);
    }
  }

  private summarize(values: number[]) {
    if (!values.length) {
      return { count: 0, avg: 0, p95: 0, max: 0 };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const sum = sorted.reduce((current, value) => current + value, 0);
    const p95Index = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));

    return {
      count: sorted.length,
      avg: Math.round(sum / sorted.length),
      p95: Math.round(sorted[p95Index]),
      max: Math.round(sorted[sorted.length - 1])
    };
  }
}
