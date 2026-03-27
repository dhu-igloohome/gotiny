import { NextResponse } from "next/server";
import { canAccessWorker } from "@/lib/auth/rbac";
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
  if (!canAccessWorker(context.role as AuthRole | undefined)) {
    return NextResponse.json({ error: "Worker role required." }, { status: 403 });
  }

  const { id } = await params;
  const { prisma, organizationId } = getScopedPrisma(context.organizationId);

  const drawing = await prisma.drawing.findFirst({
    where: { id, organizationId },
    include: {
      operations: {
        include: { state: true },
        orderBy: { sequence: "asc" },
      },
    },
  });

  if (!drawing) {
    return NextResponse.json({ error: "Drawing not found." }, { status: 404 });
  }

  const currentOperation =
    drawing.operations.find((op) => op.status !== "COMPLETED") ??
    drawing.operations[drawing.operations.length - 1] ??
    null;

  const payload = {
    id: drawing.id,
    drawingNo: drawing.drawingNo,
    demandQty: drawing.demandQty,
    plannedQty: drawing.plannedQty ?? drawing.demandQty,
    status: drawing.status,
    currentOperation: currentOperation
      ? {
          id: currentOperation.id,
          name: currentOperation.name,
          sequence: currentOperation.sequence,
          status: currentOperation.status,
          planQty: currentOperation.planQty ?? drawing.demandQty,
          lockVersion: currentOperation.state?.lockVersion ?? 0,
          reportedQty: currentOperation.state?.reportedQty ?? 0,
          goodQty: currentOperation.state?.acceptedGoodQty ?? 0,
          scrapQty: currentOperation.state?.scrapQty ?? 0,
          maxGoodCanReport: Math.max(
            0,
            (currentOperation.planQty ?? drawing.demandQty) - (currentOperation.state?.acceptedGoodQty ?? 0),
          ),
        }
      : null,
    operations: drawing.operations.map((op) => ({
      id: op.id,
      sequence: op.sequence,
      name: op.name,
      status: op.status,
      goodQty: op.state?.acceptedGoodQty ?? 0,
      scrapQty: op.state?.scrapQty ?? 0,
    })),
  };

  return NextResponse.json({ ok: true, drawing: payload });
}
