import { NextResponse } from "next/server";
import { canAccessAdmin } from "@/lib/auth/rbac";
import { getRequestContext } from "@/lib/auth/request-context";
import type { AuthRole } from "@/lib/auth/session";
import { getScopedPrisma } from "@/lib/core/scoped-prisma";

export async function GET() {
  const context = await getRequestContext();
  if (!context.organizationId) {
    return NextResponse.json({ error: "Unauthorized organization context." }, { status: 401 });
  }
  if (!canAccessAdmin(context.role as AuthRole | undefined)) {
    return NextResponse.json({ error: "Admin role required." }, { status: 403 });
  }

  const { prisma, organizationId } = getScopedPrisma(context.organizationId);

  const [drawingAgg, drawingDemandFallbackAgg, stateAgg] = await Promise.all([
    prisma.drawing.aggregate({
      where: { organizationId },
      _count: { _all: true },
      _sum: { plannedQty: true },
    }),
    prisma.drawing.aggregate({
      where: { organizationId, plannedQty: null },
      _sum: { demandQty: true },
    }),
    prisma.operationState.aggregate({
      where: { organizationId },
      _sum: {
        acceptedGoodQty: true,
        scrapQty: true,
      },
    }),
  ]);

  const totalPlannedQty = (drawingAgg._sum.plannedQty ?? 0) + (drawingDemandFallbackAgg._sum.demandQty ?? 0);
  const totalGoodQty = stateAgg._sum.acceptedGoodQty ?? 0;
  const totalScrapQty = stateAgg._sum.scrapQty ?? 0;
  const progress = totalPlannedQty > 0 ? Number(((totalGoodQty / totalPlannedQty) * 100).toFixed(2)) : 0;

  return NextResponse.json({
    ok: true,
    stats: {
      drawingCount: drawingAgg._count._all,
      totalPlannedQty,
      totalGoodQty,
      totalScrapQty,
      progressPercent: progress,
    },
  });
}
