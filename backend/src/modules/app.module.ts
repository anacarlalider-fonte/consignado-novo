import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthController } from "./auth/auth.controller";
import { HealthController } from "./health/health.controller";
import { CrmController } from "./crm/crm.controller";
import { CrmService } from "./crm/crm.service";
import { AuthService } from "./auth/auth.service";
import { PrismaService } from "./prisma/prisma.service";
import { JwtAuthGuard } from "./auth/jwt-auth.guard";
import { PermissionsGuard } from "./auth/permissions.guard";
import { APP_GUARD } from "@nestjs/core";
import { ReportsController } from "./reports/reports.controller";
import { IntegrationsController } from "./integrations/integrations.controller";
import { AutomationController } from "./automation/automation.controller";
import { RootController } from "./root/root.controller";

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [RootController, HealthController, AuthController, CrmController, ReportsController, IntegrationsController, AutomationController],
  providers: [
    PrismaService,
    CrmService,
    AuthService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard }
  ]
})
export class AppModule {}
