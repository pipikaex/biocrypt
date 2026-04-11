import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";
import helmet from "helmet";
import { join } from "path";
import * as express from "express";
import * as fs from "fs";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix("api");

  const prodOrigins = [
    "https://zcoin.bio",
    "https://www.zcoin.bio",
    "https://demo.zcoin.bio",
  ];

  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (process.env.NODE_ENV !== "production") {
        return callback(null, true);
      }
      if (!origin) return callback(null, true);
      if (prodOrigins.includes(origin)) return callback(null, true);
      // Gateway and marketplace APIs are open to any origin (merchant sites)
      callback(null, true);
    },
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  const frontendDist = join(__dirname, "..", "..", "frontend", "dist");
  const frontendIndex = join(frontendDist, "index.html");
  const demoDist = join(__dirname, "..", "..", "demo", "dist");
  const demoIndex = join(demoDist, "index.html");
  const hasDemoApp = fs.existsSync(demoIndex);

  const expressApp = app.getHttpAdapter().getInstance();

  expressApp.use((req: any, _res: any, next: any) => {
    const host = (req.hostname || req.headers.host || "").replace(/:\d+$/, "");
    req._isDemo = host === "demo.zcoin.bio";
    next();
  });

  expressApp.use((req: any, res: any, next: any) => {
    if (req.path.startsWith("/api/") || req.path.startsWith("/socket.io/")) return next();
    const dist = req._isDemo && hasDemoApp ? demoDist : frontendDist;
    const filePath = join(dist, req.path);
    if (req.path.includes(".") && fs.existsSync(filePath)) {
      return res.sendFile(filePath);
    }
    next();
  });

  expressApp.use(express.static(frontendDist));

  expressApp.use((req: any, res: any, next: any) => {
    if (
      req.method !== "GET" ||
      req.path.startsWith("/api/") ||
      req.path.startsWith("/socket.io/") ||
      req.path.includes(".")
    ) {
      return next();
    }
    const index = req._isDemo && hasDemoApp ? demoIndex : frontendIndex;
    res.sendFile(index);
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Zcoin server running on http://localhost:${port}`);
  if (hasDemoApp) console.log(`Demo marketplace available for demo.zcoin.bio`);
}
bootstrap();
