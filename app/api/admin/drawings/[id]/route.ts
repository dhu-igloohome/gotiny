import { NextResponse } from "next/server";
import { canAccessAdmin } from "@/lib/auth/rbac";
import { getRequestContext } from "@/lib/auth/request-context";
import type { AuthRole } from "@/lib/auth/session";
import { getScopedPrisma } from "@/lib/core/scoped-prisma";

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, { params }: RouteParams) {
  const context = await getRequestContext();
  if (!context.organizationId) {
    return NextResponse.json({ error: "Unauthorized organization context." }, { status: 401 });
  }
  if (!canAccessAdmin(context.role as AuthRole | undefined)) {
    return NextResponse.json({ error: "Admin role required." }, { status: 403 });
  }

  const { id } = await params;
  const { prisma, organizationId } = getScopedPrisma(context.organizationId);

  const drawing = await prisma.drawing.findFirst({
    where: {
      id,
      organizationId,
    },
    include: {
      operations: {
        include: {
          state: true,
        },
        orderBy: {
          sequence: "asc",
        },
      },
    },
  });

  if (!drawing) {
    return NextResponse.json({ error: "Drawing not found." }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    drawing: {
      id: drawing.id,
      drawingNo: drawing.drawingNo,
      customerName: drawing.customerName,
      demandQty: drawing.demandQty,
      plannedQty: drawing.plannedQty ?? drawing.demandQty,
      status: drawing.status,
      operations: drawing.operations.map((op) => ({
        id: op.id,
        name: op.name,
        sequence: op.sequence,
        code: op.code,
        status: op.status,
        goodQty: op.state?.acceptedGoodQty ?? 0,
        scrapQty: op.state?.scrapQty ?? 0,
      })),
    },
  });
}
