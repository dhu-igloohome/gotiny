import { NextResponse } from "next/server";
import { canAccessWorker } from "@/lib/auth/rbac";
import { getRequestContext } from "@/lib/auth/request-context";
import type { AuthRole } from "@/lib/auth/session";
import { getScopedPrisma } from "@/lib/core/scoped-prisma";

type StartPayload = {
  operationId?: string;
};

export async function POST(request: Request) {
  const context = await getRequestContext();
  if (!context.organizationId) {
    return NextResponse.json({ error: "Unauthorized organization context." }, { status: 401 });
  }
  if (!canAccessWorker(context.role as AuthRole | undefined)) {
    return NextResponse.json({ error: "Worker role required." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as StartPayload | null;
  const operationId = body?.operationId?.trim();
  if (!operationId) {
    return NextResponse.json({ error: "operationId is required." }, { status: 400 });
  }

  const { prisma, organizationId } = getScopedPrisma(context.organizationId);
  const operation = await prisma.operation.findFirst({
    where: { id: operationId, organizationId },
    select: { id: true, drawingId: true, status: true },
  });
  if (!operation) {
    return NextResponse.json({ error: "Operation not found." }, { status: 404 });
  }

  if (operation.status === "COMPLETED") {
    return NextResponse.json({ error: "Operation already completed." }, { status: 409 });
  }

  await prisma.$transaction([
    prisma.operation.update({
      where: { id: operation.id },
      data: { status: "IN_PROGRESS" },
    }),
    prisma.drawing.update({
      where: { id: operation.drawingId },
      data: { status: "IN_PRODUCTION" },
    }),
  ]);

  return NextResponse.json({ ok: true, operationId: operation.id, status: "IN_PROGRESS" });
}
