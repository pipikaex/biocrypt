import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";
import helmet from "helmet";
import { join } from "path";
import * as fs from "fs";
import * as express from "express";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix("api");

  const prodOrigins = [
    "https://biocrypt.net",
    "https://www.biocrypt.net",
    "https://file.biocrypt.net",
  ];

  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (process.env.NODE_ENV !== "production") {
        return callback(null, true);
      }
      if (!origin) return callback(null, true);
      if (prodOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  });

  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.use("/api/gateway", (_req: any, res: any, next: any) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    next();
  });
  expressApp.use("/api/marketplace", (_req: any, res: any, next: any) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    next();
  });

  expressApp.use(express.json({ limit: "1mb" }));

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

  app.use((req: any, _res: any, next: any) => {
    const host = (req.hostname || req.headers.host || "").replace(/:\d+$/, "");
    req._isDemo = host === "file.biocrypt.net";
    next();
  });

  if (hasDemoApp) {
    app.use((req: any, res: any, next: any) => {
      if (req._isDemo) {
        express.static(demoDist, { index: false })(req, res, () => {
          if (req.method === "GET" && !req.path.startsWith("/api/") && !req.path.includes(".")) {
            return res.sendFile(demoIndex);
          }
          next();
        });
      } else {
        next();
      }
    });
  }

  app.use(express.static(frontendDist, { index: false }));

  app.use((req: any, res: any, next: any) => {
    if (req._isDemo) return next();
    if (req.path.startsWith("/api/") || req.path.startsWith("/socket.io/")) return next();
    if (req.method === "GET" && !req.path.includes(".")) {
      if (fs.existsSync(frontendIndex)) {
        return res.sendFile(frontendIndex);
      }
    }
    next();
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Biocrypt server running on http://localhost:${port}`);
  if (hasDemoApp) console.log(`File marketplace available for file.biocrypt.net`);
}
bootstrap();
