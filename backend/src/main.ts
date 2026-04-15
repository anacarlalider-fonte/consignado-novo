import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { RequestMethod, ValidationPipe } from "@nestjs/common";
import { AppModule } from "./modules/app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("api", {
    exclude: [{ path: "/", method: RequestMethod.GET }]
  });
  const corsOrigins = (process.env.CORS_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  app.enableCors({
    origin: corsOrigins.length ? corsOrigins : true,
    credentials: true
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const port = Number(process.env.PORT ?? 3001);
  const host = process.env.HOST ?? "0.0.0.0";
  await app.listen(port, host);
  console.log(`RealSynk Consignado API → http://localhost:${port}/api (rede: use o IP deste PC na porta ${port})`);
}

bootstrap().catch((err) => {
  console.error("Falha ao subir a API:", err);
  process.exit(1);
});
