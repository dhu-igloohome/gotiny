import { NextResponse } from "next/server";
import { canAccessAdmin } from "@/lib/auth/rbac";
import { getRequestContext } from "@/lib/auth/request-context";
import type { AuthRole } from "@/lib/auth/session";
import { getScopedPrisma } from "@/lib/core/scoped-prisma";

export async function GET(request: Request) {
  const context = await getRequestContext();
  if (!context.organizationId) {
    return NextResponse.json({ error: "Unauthorized organization context." }, { status: 401 });
  }
  if (!canAccessAdmin(context.role as AuthRole | undefined)) {
    return NextResponse.json({ error: "Admin role required." }, { status: 403 });
  }

  const { prisma, organizationId } = getScopedPrisma(context.organizationId);
  const { searchParams } = new URL(request.url);
  const drawingNoKeyword = searchParams.get("drawingNo")?.trim();
  const customerKeyword = searchParams.get("customer")?.trim();
  const status = searchParams.get("status")?.trim();
  const pageRaw = Number(searchParams.get("page") ?? "1");
  const pageSizeRaw = Number(searchParams.get("pageSize") ?? "10");
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
  const pageSize = Number.isFinite(pageSizeRaw) && pageSizeRaw > 0 ? Math.min(Math.floor(pageSizeRaw), 50) : 10;

  const where = {
    organizationId,
    ...(drawingNoKeyword
      ? {
          drawingNo: {
            contains: drawingNoKeyword,
            mode: "insensitive" as const,
          },
        }
      : {}),
    ...(customerKeyword
      ? {
          customerName: {
            contains: customerKeyword,
            mode: "insensitive" as const,
          },
        }
      : {}),
    ...(status === "IN_PRODUCTION" || status === "COMPLETED" ? { status } : {}),
  };

  const [total, drawings] = await prisma.$transaction([
    prisma.drawing.count({ where }),
    prisma.drawing.findMany({
      where,
      include: {
        operations: {
          include: {
            state: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const list = drawings.map((drawing) => {
    const plannedQty = drawing.plannedQty ?? drawing.demandQty;
    const goodQty = drawing.operations.reduce((sum, op) => sum + (op.state?.acceptedGoodQty ?? 0), 0);
    const scrapQty = drawing.operations.reduce((sum, op) => sum + (op.state?.scrapQty ?? 0), 0);
    const progressPercent = plannedQty > 0 ? Number(((goodQty / plannedQty) * 100).toFixed(2)) : 0;

    return {
      id: drawing.id,
      drawingNo: drawing.drawingNo,
      customerName: drawing.customerName,
      demandQty: drawing.demandQty,
      plannedQty,
      goodQty,
      scrapQty,
      progressPercent,
      status: drawing.status,
      createdAt: drawing.createdAt,
    };
  });

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return NextResponse.json({
    ok: true,
    drawings: list,
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
    },
  });
}
