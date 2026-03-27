import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for seed.");
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  const phone = "13800138000";
  const orgName = "Gotiny 演示工厂";
  const drawingNo = "轴承端盖 A2-2026";
  const qrCode = "GOTINY-DEMO-A2-2026";

  const user =
    (await prisma.user.findFirst({ where: { phone } })) ??
    (await prisma.user.create({
      data: {
        phone,
        preferredLocale: "zh",
      },
    }));

  const organization =
    (await prisma.organization.findFirst({ where: { name: orgName } })) ??
    (await prisma.organization.create({
      data: {
        name: orgName,
        industry: "机加工",
        locale: "zh",
      },
    }));

  const member = await prisma.organizationUser.findFirst({
    where: {
      organizationId: organization.id,
      userId: user.id,
    },
  });

  if (!member) {
    await prisma.organizationUser.create({
      data: {
        organizationId: organization.id,
        userId: user.id,
        role: "OWNER",
        isDefault: true,
      },
    });
  }

  const drawing =
    (await prisma.drawing.findFirst({
      where: {
        organizationId: organization.id,
        drawingNo,
      },
    })) ??
    (await prisma.drawing.create({
      data: {
        organizationId: organization.id,
        drawingNo,
        customerName: "演示客户",
        demandQty: 500,
        plannedQty: 500,
        status: "IN_PRODUCTION",
        qrCode,
        createdByUserId: user.id,
      },
    }));

  const operation =
    (await prisma.operation.findFirst({
      where: {
        organizationId: organization.id,
        drawingId: drawing.id,
        sequence: 1,
      },
    })) ??
    (await prisma.operation.create({
      data: {
        organizationId: organization.id,
        drawingId: drawing.id,
        name: "数控精车",
        sequence: 1,
        planQty: 500,
        inspectionMode: "SELF_CHECK",
        isCritical: false,
        status: "READY",
        createdByUserId: user.id,
      },
    }));

  const state = await prisma.operationState.findFirst({
    where: {
      organizationId: organization.id,
      operationId: operation.id,
    },
  });

  if (!state) {
    await prisma.operationState.create({
      data: {
        organizationId: organization.id,
        operationId: operation.id,
        lockVersion: 0,
        inputAvailableQty: 500,
        reportedQty: 0,
        acceptedGoodQty: 0,
        scrapQty: 0,
        downstreamScrapQty: 0,
        effectiveGoodQty: 0,
      },
    });
  }

  console.log(`SEED_ORGANIZATION_ID=${organization.id}`);
  console.log(`SEED_USER_ID=${user.id}`);
  console.log(`SEED_DRAWING_ID=${drawing.id}`);
  console.log(`SEED_OPERATION_ID=${operation.id}`);

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
