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

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const [drawingAgg, drawingDemandFallbackAgg, stateAgg, recentEvents] = await Promise.all([
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
    prisma.reportEvent.findMany({
      where: {
        organizationId,
        occurredAt: { gte: sevenDaysAgo },
      },
      select: {
        occurredAt: true,
        acceptedGoodQty: true,
        acceptedScrapQty: true,
      },
      orderBy: {
        occurredAt: "asc",
      },
    }),
  ]);

  const inProgressDrawingCount = await prisma.drawing.count({
    where: {
      organizationId,
      status: {
        in: ["IN_PRODUCTION", "OUTSOURCING"],
      },
    },
  });

  const totalPlannedQty = (drawingAgg._sum.plannedQty ?? 0) + (drawingDemandFallbackAgg._sum.demandQty ?? 0);
  const totalGoodQty = stateAgg._sum.acceptedGoodQty ?? 0;
  const totalScrapQty = stateAgg._sum.scrapQty ?? 0;
  const progress = totalPlannedQty > 0 ? Number(((totalGoodQty / totalPlannedQty) * 100).toFixed(2)) : 0;
  const goodRate = totalPlannedQty > 0 ? Number(((totalGoodQty / totalPlannedQty) * 100).toFixed(2)) : 0;
  const scrapRate = totalPlannedQty > 0 ? Number(((totalScrapQty / totalPlannedQty) * 100).toFixed(2)) : 0;

  const trendMap = new Map<string, { date: string; goodQty: number; scrapQty: number }>();
  for (let i = 0; i < 7; i += 1) {
    const day = new Date(sevenDaysAgo);
    day.setDate(day.getDate() + i);
    const date = day.toISOString().slice(0, 10);
    trendMap.set(date, { date, goodQty: 0, scrapQty: 0 });
  }
  for (const event of recentEvents) {
    const date = event.occurredAt.toISOString().slice(0, 10);
    const bucket = trendMap.get(date);
    if (!bucket) continue;
    bucket.goodQty += event.acceptedGoodQty;
    bucket.scrapQty += event.acceptedScrapQty;
  }
  const productionTrend = Array.from(trendMap.values());

  return NextResponse.json({
    ok: true,
    stats: {
      drawingCount: drawingAgg._count._all,
      inProgressDrawingCount,
      totalPlannedQty,
      totalGoodQty,
      totalScrapQty,
      progressPercent: progress,
      goodRatePercent: goodRate,
      scrapRatePercent: scrapRate,
      productionTrend,
    },
  });
}
