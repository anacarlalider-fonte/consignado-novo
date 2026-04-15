import { Controller, Get } from "@nestjs/common";
import { Public } from "../auth/public.decorator";

/**
 * Resposta na raiz da URL da API (evita 404 quando alguém abre só o domínio .onrender.com).
 * O site do CRM continua na Vercel.
 */
@Controller()
export class RootController {
  @Public()
  @Get()
  home() {
    return {
      name: "RealSynk Consignado — API",
      status: "ok",
      health: "/api/health",
      hint: "O painel do CRM abre no endereço do site na Vercel (não nesta URL)."
    };
  }
}
