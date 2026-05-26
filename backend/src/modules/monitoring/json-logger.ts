import type { LoggerService } from "@nestjs/common";

export class JsonLogger implements LoggerService {
  log(message: unknown, context?: string): void {
    this.write("info", message, context);
  }

  error(message: unknown, trace?: string, context?: string): void {
    this.write("error", message, context, trace);
  }

  warn(message: unknown, context?: string): void {
    this.write("warn", message, context);
  }

  debug(message: unknown, context?: string): void {
    if (process.env.LOG_LEVEL === "debug") {
      this.write("debug", message, context);
    }
  }

  verbose(message: unknown, context?: string): void {
    if (process.env.LOG_LEVEL === "debug") {
      this.write("verbose", message, context);
    }
  }

  private write(level: string, message: unknown, context?: string, trace?: string): void {
    const error = message instanceof Error ? message : undefined;
    const payload = {
      timestamp: new Date().toISOString(),
      level,
      context,
      message: error
        ? error.message
        : typeof message === "string"
          ? message
          : JSON.stringify(message),
      trace: trace ?? error?.stack
    };

    const line = JSON.stringify(payload);

    if (level === "error") {
      console.error(line);
      return;
    }

    console.log(line);
  }
}
