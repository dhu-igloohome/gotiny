import { NextResponse } from "next/server";
import { getRequestContext } from "@/lib/auth/request-context";
import { WorkerReportService } from "@/lib/worker/report/report-service";
import { ConflictError, ValidationError } from "@/lib/worker/report/types";
import { listAuthorizedUserIds } from "@/lib/worker/operation-authorizations";

type ReportPayload = {
  operationId?: string;
  goodQty?: number;
  scrapQty?: number;
  idempotencyKey?: string;
  photoUrls?: string[];
  expectedLockVersion?: number;
};

export async function POST(request: Request) {
  const context = await getRequestContext();
  if (!context.organizationId || !context.userId) {
    return NextResponse.json({ error: "Unauthorized organization context." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as ReportPayload | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }
  const operationId = body.operationId?.trim();
  if (!operationId) {
    return NextResponse.json({ error: "operationId is required." }, { status: 400 });
  }
  const authorizedUserIds = await listAuthorizedUserIds(context.organizationId, operationId);
  const isPrivileged = context.role === "OWNER" || context.role === "ADMIN";
  if (!isPrivileged && !authorizedUserIds.includes(context.userId)) {
    return NextResponse.json({ error: "You are not authorized for this operation." }, { status: 403 });
  }

  const service = new WorkerReportService(context.organizationId);

  try {
    const result = await service.submitReport({
      operationId,
      goodQty: body.goodQty ?? 0,
      scrapQty: body.scrapQty ?? 0,
      idempotencyKey: body.idempotencyKey ?? "",
      photoUrls: body.photoUrls ?? [],
      expectedLockVersion: body.expectedLockVersion,
      actorUserId: context.userId,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (error instanceof ConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    return NextResponse.json({ error: "Failed to submit report." }, { status: 500 });
  }
}
