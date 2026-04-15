import { Controller, Get } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Permissions } from "../auth/permissions.decorator";

@Controller("reports")
export class ReportsController {
  constructor(private readonly prisma: PrismaService) {}

  @Permissions("reports:read")
  @Get("summary")
  async summary() {
    const tenantId = "default-tenant";
    const [leads, opportunities, orders] = await Promise.all([
      this.prisma.crmLead.findMany({ where: { tenantId } }),
      this.prisma.crmOpportunity.findMany({ where: { tenantId } }),
      this.prisma.crmOrder.findMany({ where: { tenantId } })
    ]);

    const pipelineValue = opportunities.reduce((acc, item) => acc + Number(item.valor), 0);
    const amountToInvoice = orders.reduce((acc, item) => acc + Number(item.aFaturar), 0);
    const criticalOrders = orders.filter((o) => o.urgencia === "CRITICO").length;
    const dueFollowups = orders.filter((o) => !!o.proximoFollowup).length;

    return {
      leads: leads.length,
      opportunities: opportunities.length,
      orders: orders.length,
      pipelineValue,
      amountToInvoice,
      criticalOrders,
      dueFollowups
    };
  }
}
