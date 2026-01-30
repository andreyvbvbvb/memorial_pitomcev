import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import * as express from "express";
import { existsSync } from "fs";
import { join } from "path";
import { config } from "dotenv";
import { AppModule } from "./app.module";

const envPathCandidates = [
  join(process.cwd(), "apps", "api", ".env"),
  join(process.cwd(), ".env")
];
const envPath = envPathCandidates.find((candidate) => existsSync(candidate));
if (envPath) {
  config({ path: envPath });
} else {
  config();
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());
  if (!process.env.S3_PUBLIC_BASE_URL) {
    app.use("/uploads", express.static(join(process.cwd(), "uploads")));
  }
  app.enableCors({
    origin: true,
    credentials: true
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true
    })
  );
  app.enableShutdownHooks();

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
}

bootstrap();
