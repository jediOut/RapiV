import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module";
import { JsonLogger } from "./modules/monitoring/json-logger";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
    logger: new JsonLogger()
  });

  app.enableCors();
  app.setGlobalPrefix("api");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true
    })
  );

  await app.listen(3000, '0.0.0.0');
}

void bootstrap();
