import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { CrmService } from "./crm.service";
import { IsIn, IsInt, IsNumber, IsOptional, IsString, Max, Min } from "class-validator";
import { Permissions } from "../auth/permissions.decorator";

class CreateLeadDto {
  @IsString()
  nome!: string;
  @IsString()
  origem!: string;
  @IsString()
  responsavel!: string;
  @IsInt()
  @Min(0)
  @Max(100)
  score!: number;
  @IsIn(["Novo", "Em contato", "Qualificado", "Perdido"])
  status!: "Novo" | "Em contato" | "Qualificado" | "Perdido";
}

class CreateOpportunityDto {
  @IsString()
  titulo!: string;
  @IsString()
  cliente!: string;
  @IsString()
  vendedor!: string;
  @IsNumber()
  valor!: number;
  @IsIn(["Prospeccao", "Diagnostico", "Proposta", "Negociacao", "Fechado"])
  etapa!: "Prospeccao" | "Diagnostico" | "Proposta" | "Negociacao" | "Fechado";
}

class UpdateOpportunityStageDto {
  @IsIn(["Prospeccao", "Diagnostico", "Proposta", "Negociacao", "Fechado"])
  etapa!: "Prospeccao" | "Diagnostico" | "Proposta" | "Negociacao" | "Fechado";
}

class UpdateOrderDto {
  @IsOptional()
  @IsIn(["Novo", "Contato iniciado", "Negociacao", "Aguardando pagamento", "Concluido"])
  etapaCRM?: "Novo" | "Contato iniciado" | "Negociacao" | "Aguardando pagamento" | "Concluido";

  @IsOptional()
  @IsString()
  proximoFollowup?: string;
}

@Controller("crm")
export class CrmController {
  constructor(private readonly crmService: CrmService) {}

  @Permissions("leads:read")
  @Get("leads")
  async getLeads() {
    return this.crmService.getLeads();
  }

  @Permissions("leads:create")
  @Post("leads")
  async createLead(@Body() dto: CreateLeadDto) {
    return this.crmService.createLead(dto);
  }

  @Permissions("opportunities:read")
  @Get("opportunities")
  async getOpportunities() {
    return this.crmService.getOpportunities();
  }

  @Permissions("opportunities:create")
  @Post("opportunities")
  async createOpportunity(@Body() dto: CreateOpportunityDto) {
    return this.crmService.createOpportunity(dto);
  }

  @Permissions("opportunities:update")
  @Patch("opportunities/:id/stage")
  async updateOpportunityStage(@Param("id") id: string, @Body() dto: UpdateOpportunityStageDto) {
    return this.crmService.updateOpportunityStage(id, dto.etapa);
  }

  @Permissions("orders:read")
  @Get("orders")
  async getOrders() {
    return this.crmService.getOrders();
  }

  @Permissions("orders:update")
  @Patch("orders/:pedido")
  async updateOrder(@Param("pedido") pedido: string, @Body() dto: UpdateOrderDto) {
    return this.crmService.updateOrder(Number(pedido), dto);
  }
}
