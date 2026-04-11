import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import helmet from "helmet";
import { join } from "path";
import * as express from "express";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix("api");
  app.enableCors();
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  const distPath = join(__dirname, "..", "..", "frontend", "dist");
  const indexHtml = join(distPath, "index.html");

  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.use(express.static(distPath));
  expressApp.use((req: any, res: any, next: any) => {
    if (
      req.method !== "GET" ||
      req.path.startsWith("/api/") ||
      req.path.startsWith("/socket.io/") ||
      req.path.includes(".")
    ) {
      return next();
    }
    res.sendFile(indexHtml);
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Zcoin server running on http://localhost:${port}`);
}
bootstrap();
