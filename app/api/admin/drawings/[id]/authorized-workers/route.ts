import { NextResponse } from "next/server";
import { canAccessAdmin } from "@/lib/auth/rbac";
import { getRequestContext } from "@/lib/auth/request-context";
import type { AuthRole } from "@/lib/auth/session";
import { getScopedPrisma } from "@/lib/core/scoped-prisma";
import { listAuthorizedUserIds, replaceAuthorizedUserIds } from "@/lib/worker/operation-authorizations";

type RouteParams = {
  params: Promise<{ id: string }>;
};

type Assignment = {
  operationId: string;
  userIds: string[];
};

type UpdatePayload = {
  assignments?: Assignment[];
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
    where: { id, organizationId },
    include: {
      operations: {
        orderBy: { sequence: "asc" },
        select: { id: true, sequence: true, name: true, status: true },
      },
    },
  });
  if (!drawing) {
    return NextResponse.json({ error: "Drawing not found." }, { status: 404 });
  }

  const members = await prisma.organizationUser.findMany({
    where: {
      organizationId,
      role: { in: ["WORKER", "QC", "OUTSOURCE", "ADMIN", "OWNER"] },
    },
    include: { user: true },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
  });

  const workerOptions = members.map((member) => ({
    userId: member.userId,
    role: member.role,
    label: member.user.phone ?? member.user.email ?? member.user.id,
  }));

  const operationAssignments = await Promise.all(
    drawing.operations.map(async (operation) => ({
      operationId: operation.id,
      sequence: operation.sequence,
      operationName: operation.name,
      status: operation.status,
      userIds: await listAuthorizedUserIds(organizationId, operation.id),
    })),
  );

  return NextResponse.json({
    ok: true,
    drawing: { id: drawing.id, drawingNo: drawing.drawingNo },
    workers: workerOptions,
    assignments: operationAssignments,
  });
}

export async function PUT(request: Request, { params }: RouteParams) {
  const context = await getRequestContext();
  if (!context.organizationId) {
    return NextResponse.json({ error: "Unauthorized organization context." }, { status: 401 });
  }
  if (!canAccessAdmin(context.role as AuthRole | undefined)) {
    return NextResponse.json({ error: "Admin role required." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as UpdatePayload | null;
  const assignments = body?.assignments;
  if (!Array.isArray(assignments)) {
    return NextResponse.json({ error: "assignments is required." }, { status: 400 });
  }

  const { id } = await params;
  const { prisma, organizationId } = getScopedPrisma(context.organizationId);
  const drawing = await prisma.drawing.findFirst({
    where: { id, organizationId },
    include: { operations: { select: { id: true } } },
  });
  if (!drawing) {
    return NextResponse.json({ error: "Drawing not found." }, { status: 404 });
  }

  const operationIdSet = new Set(drawing.operations.map((item) => item.id));
  const allUserIds = new Set<string>();
  for (const assignment of assignments) {
    if (!assignment?.operationId || !operationIdSet.has(assignment.operationId)) {
      return NextResponse.json({ error: "assignment contains invalid operationId." }, { status: 400 });
    }
    for (const userId of assignment.userIds ?? []) {
      if (typeof userId !== "string" || !userId.trim()) {
        return NextResponse.json({ error: "assignment contains invalid userId." }, { status: 400 });
      }
      allUserIds.add(userId.trim());
    }
  }

  if (allUserIds.size > 0) {
    const validUsers = await prisma.organizationUser.findMany({
      where: {
        organizationId,
        userId: { in: [...allUserIds] },
      },
      select: { userId: true },
    });
    const validSet = new Set(validUsers.map((item) => item.userId));
    for (const userId of allUserIds) {
      if (!validSet.has(userId)) {
        return NextResponse.json({ error: `user ${userId} is not in organization.` }, { status: 400 });
      }
    }
  }

  for (const assignment of assignments) {
    const deduplicated = [...new Set((assignment.userIds ?? []).map((item) => item.trim()).filter(Boolean))];
    await replaceAuthorizedUserIds(organizationId, assignment.operationId, deduplicated);
  }

  return NextResponse.json({ ok: true });
}
