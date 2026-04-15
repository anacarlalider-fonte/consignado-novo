import { Controller, Post } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Permissions } from "../auth/permissions.decorator";

@Controller("automation")
export class AutomationController {
  constructor(private readonly prisma: PrismaService) {}

  @Permissions("orders:update")
  @Post("followups/run")
  async runFollowupSweep() {
    const tenantId = "default-tenant";
    const today = new Date();
    const orders = await this.prisma.crmOrder.findMany({ where: { tenantId } });

    let flagged = 0;
    for (const order of orders) {
      if (!order.proximoFollowup) continue;
      const [dd, mm, yyyy] = order.proximoFollowup.split("/");
      if (!dd || !mm || !yyyy) continue;
      const due = new Date(`${yyyy}-${mm}-${dd}T00:00:00`);
      if (Number.isNaN(due.getTime())) continue;

      if (due <= today && order.etapaCRM !== "Concluido") {
        await this.prisma.crmOrder.update({
          where: { id: order.id },
          data: { etapaCRM: "Contato iniciado" }
        });
        flagged += 1;
      }
    }

    return { processed: orders.length, flagged };
  }
}
