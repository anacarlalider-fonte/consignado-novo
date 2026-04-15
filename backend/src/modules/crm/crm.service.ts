import { Injectable, NotFoundException } from "@nestjs/common";
import { LeadItem, OpportunityItem, OrderItem, OpportunityStage } from "./crm.types";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class CrmService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly defaultTenantId = "default-tenant";

  async getLeads() {
    const items = await this.prisma.crmLead.findMany({
      where: { tenantId: this.defaultTenantId },
      orderBy: { createdAt: "desc" }
    });
    return items.map((x) => ({
      id: x.id,
      nome: x.nome,
      origem: x.origem,
      responsavel: x.responsavel,
      score: x.score,
      status: x.status as LeadItem["status"]
    }));
  }

  async createLead(input: Omit<LeadItem, "id">) {
    const item = await this.prisma.crmLead.create({
      data: {
        tenantId: this.defaultTenantId,
        nome: input.nome,
        origem: input.origem,
        responsavel: input.responsavel,
        score: input.score,
        status: input.status
      }
    });
    return { id: item.id, ...input };
  }

  async getOpportunities() {
    const items = await this.prisma.crmOpportunity.findMany({
      where: { tenantId: this.defaultTenantId },
      orderBy: { createdAt: "desc" }
    });
    return items.map((x) => ({
      id: x.id,
      titulo: x.titulo,
      cliente: x.cliente,
      vendedor: x.vendedor,
      valor: Number(x.valor),
      etapa: x.etapa as OpportunityItem["etapa"]
    }));
  }

  async createOpportunity(input: Omit<OpportunityItem, "id">) {
    const item = await this.prisma.crmOpportunity.create({
      data: {
        tenantId: this.defaultTenantId,
        titulo: input.titulo,
        cliente: input.cliente,
        vendedor: input.vendedor,
        valor: input.valor,
        etapa: input.etapa
      }
    });
    return { id: item.id, ...input };
  }

  async updateOpportunityStage(id: string, etapa: OpportunityStage) {
    try {
      const item = await this.prisma.crmOpportunity.update({
        where: { id },
        data: { etapa }
      });
      return {
        id: item.id,
        titulo: item.titulo,
        cliente: item.cliente,
        vendedor: item.vendedor,
        valor: Number(item.valor),
        etapa: item.etapa as OpportunityItem["etapa"]
      };
    } catch {
      throw new NotFoundException("Opportunity not found");
    }
  }

  async getOrders() {
    const items = await this.prisma.crmOrder.findMany({
      where: { tenantId: this.defaultTenantId },
      orderBy: { diasAberto: "desc" }
    });
    return items.map((x) => ({
      pedido: x.pedido,
      cliente: x.cliente,
      vendedor: x.vendedor,
      aFaturar: Number(x.aFaturar),
      diasAberto: x.diasAberto,
      urgencia: x.urgencia as OrderItem["urgencia"],
      etapaCRM: x.etapaCRM as OrderItem["etapaCRM"],
      proximoFollowup: x.proximoFollowup ?? undefined
    }));
  }

  async updateOrder(pedido: number, patch: Partial<OrderItem>) {
    const existing = await this.prisma.crmOrder.findFirst({
      where: { tenantId: this.defaultTenantId, pedido }
    });
    if (!existing) throw new NotFoundException("Order not found");

    const item = await this.prisma.crmOrder.update({
      where: { id: existing.id },
      data: {
        etapaCRM: patch.etapaCRM ?? existing.etapaCRM,
        proximoFollowup: patch.proximoFollowup ?? existing.proximoFollowup
      }
    });

    return {
      pedido: item.pedido,
      cliente: item.cliente,
      vendedor: item.vendedor,
      aFaturar: Number(item.aFaturar),
      diasAberto: item.diasAberto,
      urgencia: item.urgencia as OrderItem["urgencia"],
      etapaCRM: item.etapaCRM as OrderItem["etapaCRM"],
      proximoFollowup: item.proximoFollowup ?? undefined
    };
  }
}
