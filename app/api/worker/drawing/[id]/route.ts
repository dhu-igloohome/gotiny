import { NextResponse } from "next/server";
import { canAccessWorker } from "@/lib/auth/rbac";
import { getRequestContext } from "@/lib/auth/request-context";
import type { AuthRole } from "@/lib/auth/session";
import { getScopedPrisma } from "@/lib/core/scoped-prisma";
import { listAuthorizedUserIds } from "@/lib/worker/operation-authorizations";

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, { params }: RouteParams) {
  const context = await getRequestContext();
  if (!context.organizationId) {
    return NextResponse.json({ error: "Unauthorized organization context." }, { status: 401 });
  }
  const role = context.role as AuthRole | undefined;
  if (!canAccessWorker(role)) {
    return NextResponse.json({ error: "Worker role required." }, { status: 403 });
  }

  const rawId = (await params).id.trim();
  const { prisma, organizationId } = getScopedPrisma(context.organizationId);

  const drawing = await prisma.drawing.findFirst({
    where: {
      organizationId,
      OR: [{ id: rawId }, { drawingNo: rawId }, { qrCode: rawId }],
    },
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
  const authorizedUserIds = currentOperation
    ? await listAuthorizedUserIds(organizationId, currentOperation.id)
    : [];
  const hasOperationAuthorization = !!context.userId && authorizedUserIds.includes(context.userId);
  const canReportCurrentOperation =
    !!currentOperation &&
    (role === "OWNER" || role === "ADMIN" ? true : hasOperationAuthorization);

  const payload = {
    id: drawing.id,
    qrCode: drawing.qrCode,
    drawingNo: drawing.drawingNo,
    demandQty: drawing.demandQty,
    plannedQty: drawing.plannedQty ?? drawing.demandQty,
    status: drawing.status,
    canReportCurrentOperation,
    authorizedWorkerCount: authorizedUserIds.length,
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
          inspectionMode: currentOperation.inspectionMode,
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
