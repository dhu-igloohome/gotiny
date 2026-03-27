import { NextResponse } from "next/server";
import { canAccessWorker } from "@/lib/auth/rbac";
import { getRequestContext } from "@/lib/auth/request-context";
import type { AuthRole } from "@/lib/auth/session";
import { getScopedPrisma } from "@/lib/core/scoped-prisma";
import { listAuthorizedUserIds } from "@/lib/worker/operation-authorizations";

type RouteParams = {
  params: Promise<{ id: string }>;
};

type OutsourcePayload = {
  action?: "SEND" | "RETURN";
};

export async function POST(request: Request, { params }: RouteParams) {
  const context = await getRequestContext();
  if (!context.organizationId || !context.userId) {
    return NextResponse.json({ error: "Unauthorized organization context." }, { status: 401 });
  }
  if (!canAccessWorker(context.role as AuthRole | undefined)) {
    return NextResponse.json({ error: "Worker role required." }, { status: 403 });
  }

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as OutsourcePayload | null;
  const action = body?.action;
  if (action !== "SEND" && action !== "RETURN") {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }

  const { prisma, organizationId } = getScopedPrisma(context.organizationId);
  const drawing = await prisma.drawing.findFirst({
    where: { id, organizationId },
    include: {
      operations: {
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
  if (!currentOperation) {
    return NextResponse.json({ error: "No operation found for drawing." }, { status: 400 });
  }
  const authorizedUserIds = await listAuthorizedUserIds(organizationId, currentOperation.id);
  const isPrivileged = context.role === "OWNER" || context.role === "ADMIN";
  if (!isPrivileged && !authorizedUserIds.includes(context.userId)) {
    return NextResponse.json({ error: "You are not authorized for this operation." }, { status: 403 });
  }

  if (action === "SEND" && drawing.status === "OUTSOURCING") {
    return NextResponse.json({ error: "Drawing is already outsourcing." }, { status: 409 });
  }
  if (action === "RETURN" && drawing.status !== "OUTSOURCING") {
    return NextResponse.json({ error: "Drawing is not in outsourcing state." }, { status: 409 });
  }

  const nextDrawingStatus = action === "SEND" ? "OUTSOURCING" : "IN_PRODUCTION";
  const nextOperationStatus = action === "SEND" ? "OUTSOURCING" : "IN_PROGRESS";
  const eventType = action === "SEND" ? "OUTSOURCE_SENT" : "OUTSOURCE_RECEIVED";

  await prisma.$transaction(async (tx) => {
    await tx.drawing.update({
      where: { id: drawing.id },
      data: { status: nextDrawingStatus },
    });
    await tx.operation.update({
      where: { id: currentOperation.id },
      data: { status: nextOperationStatus },
    });
    await tx.reportEvent.create({
      data: {
        organizationId,
        drawingId: drawing.id,
        operationId: currentOperation.id,
        eventType,
        source: "WEB",
        actorUserId: context.userId,
        requestedQty: 0,
        requestedGoodQty: 0,
        requestedScrapQty: 0,
        acceptedGoodQty: 0,
        acceptedScrapQty: 0,
        preLockVersion: 0,
        postLockVersion: 0,
        operationEffectiveGood: 0,
        operationScrapTotal: 0,
        metadata: {
          action,
          drawingStatus: nextDrawingStatus,
          operationStatus: nextOperationStatus,
        },
      },
    });
  });

  return NextResponse.json({
    ok: true,
    drawingId: drawing.id,
    action,
    status: nextDrawingStatus,
  });
}
