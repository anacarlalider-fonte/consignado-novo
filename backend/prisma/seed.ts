import { PrismaClient } from "@prisma/client";
import { hash } from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { id: "default-tenant" },
    update: { name: "RealSynk Consignado" },
    create: { id: "default-tenant", name: "RealSynk Consignado" }
  });

  const permissionCodes = [
    "leads:read",
    "leads:create",
    "opportunities:read",
    "opportunities:create",
    "opportunities:update",
    "orders:read",
    "orders:update",
    "reports:read",
    "integrations:write"
  ];

  for (const code of permissionCodes) {
    await prisma.permission.upsert({
      where: { code },
      update: {},
      create: { code, description: code }
    });
  }

  const adminRole = await prisma.role.upsert({
    where: { name: "ADMIN" },
    update: {},
    create: { name: "ADMIN", description: "Acesso completo" }
  });

  for (const code of permissionCodes) {
    const permission = await prisma.permission.findUniqueOrThrow({ where: { code } });
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: adminRole.id, permissionId: permission.id } },
      update: {},
      create: { roleId: adminRole.id, permissionId: permission.id }
    });
  }

  const adminEmail = (process.env.SEED_ADMIN_EMAIL?.trim() || "admin@kato.com").toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "Admin@123";
  const adminName = (process.env.SEED_ADMIN_NAME ?? "Administrador").trim() || "Administrador";
  const passwordHash = await hash(adminPassword, 10);
  const adminUser = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: adminEmail } },
    update: { passwordHash, status: "ACTIVE", deletedAt: null, name: adminName },
    create: {
      tenantId: tenant.id,
      name: adminName,
      email: adminEmail,
      passwordHash,
      status: "ACTIVE"
    }
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: adminUser.id, roleId: adminRole.id } },
    update: {},
    create: { userId: adminUser.id, roleId: adminRole.id }
  });

  await prisma.crmLead.createMany({
    data: [
      { tenantId: "default-tenant", nome: "Construtora Horizonte", origem: "Indicacao", responsavel: "Ana Caroline", score: 88, status: "Qualificado" },
      { tenantId: "default-tenant", nome: "Arq. Julia Moreira", origem: "Instagram", responsavel: "Simone", score: 71, status: "Em contato" }
    ],
    skipDuplicates: true
  });

  await prisma.crmOpportunity.createMany({
    data: [
      { tenantId: "default-tenant", titulo: "Moveis planejados - area gourmet", cliente: "THIAGO HENRIQUE MARTINS", vendedor: "Ana Caroline", valor: 32000, etapa: "Proposta" },
      { tenantId: "default-tenant", titulo: "Reforma sala comercial", cliente: "NEBRASKA MONTEIRO", vendedor: "Tatiane Souza", valor: 12900, etapa: "Negociacao" }
    ],
    skipDuplicates: true
  });

  await prisma.crmOrder.createMany({
    data: [
      { tenantId: "default-tenant", pedido: 897, cliente: "THIAGO HENRIQUE MARTINS", vendedor: "Ana Caroline", aFaturar: 16000, diasAberto: 1064, urgencia: "CRITICO", etapaCRM: "Negociacao", proximoFollowup: "10/04/2026" },
      { tenantId: "default-tenant", pedido: 1685, cliente: "0 CLIMA LTDA", vendedor: "Simone", aFaturar: 20960, diasAberto: 179, urgencia: "ATENCAO", etapaCRM: "Contato iniciado", proximoFollowup: "09/04/2026" }
    ],
    skipDuplicates: true
  });

  console.log("Seed concluido. Login: admin@kato.com / Admin@123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
