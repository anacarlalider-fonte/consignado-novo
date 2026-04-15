import { Body, Controller, Post } from "@nestjs/common";
import { IsString, IsUrl } from "class-validator";
import { PrismaService } from "../prisma/prisma.service";
import { Permissions } from "../auth/permissions.decorator";

class ImportSheetsDto {
  @IsUrl()
  csvUrl!: string;

  @IsString()
  sheetName!: string;
}

@Controller("integrations")
export class IntegrationsController {
  constructor(private readonly prisma: PrismaService) {}

  @Permissions("integrations:write")
  @Post("google-sheets/import-orders")
  async importOrders(@Body() dto: ImportSheetsDto) {
    const startedAt = new Date();
    const log = await this.prisma.integrationSyncLog.create({
      data: {
        tenantId: "default-tenant",
        provider: "google_sheets",
        entity: "orders",
        status: "RUNNING",
        startedAt,
        message: `Importando ${dto.sheetName}`
      }
    });

    try {
      const response = await fetch(dto.csvUrl);
      if (!response.ok) throw new Error(`Erro ao baixar CSV: ${response.status}`);
      const csv = await response.text();
      const lines = csv.split(/\r?\n/).filter((line) => line.trim().length > 0);
      const body = lines.slice(1);

      let imported = 0;
      for (const line of body) {
        const cols = line.split(",");
        if (cols.length < 7) continue;
        const pedido = Number(cols[0]?.replace(/\D/g, ""));
        const cliente = cols[2]?.trim();
        const vendedor = cols[3]?.trim();
        const aFaturar = Number(cols[4]?.replace(/[R$\.\s]/g, "").replace(",", ".")) || 0;
        const diasAberto = Number(cols[7]) || 0;
        const urgenciaText = (cols[8] || "").toUpperCase();

        if (!pedido || !cliente) continue;
        const urgencia =
          urgenciaText.includes("CRIT") ? "CRITICO" : urgenciaText.includes("ATEN") ? "ATENCAO" : "RECENTE";

        const existing = await this.prisma.crmOrder.findFirst({ where: { tenantId: "default-tenant", pedido } });
        if (existing) {
          await this.prisma.crmOrder.update({
            where: { id: existing.id },
            data: { cliente, vendedor, aFaturar, diasAberto, urgencia }
          });
        } else {
          await this.prisma.crmOrder.create({
            data: {
              tenantId: "default-tenant",
              pedido,
              cliente,
              vendedor: vendedor || "Nao definido",
              aFaturar,
              diasAberto,
              urgencia,
              etapaCRM: "Novo"
            }
          });
        }
        imported += 1;
      }

      await this.prisma.integrationSyncLog.update({
        where: { id: log.id },
        data: { status: "SUCCESS", finishedAt: new Date(), message: `Importados ${imported} registros` }
      });
      return { imported };
    } catch (e) {
      await this.prisma.integrationSyncLog.update({
        where: { id: log.id },
        data: { status: "ERROR", finishedAt: new Date(), message: e instanceof Error ? e.message : "Erro" }
      });
      throw e;
    }
  }
}
