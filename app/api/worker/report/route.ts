import { NextResponse } from "next/server";
import { getRequestContext } from "@/lib/auth/request-context";
import { WorkerReportService } from "@/lib/worker/report/report-service";
import { ConflictError, ValidationError } from "@/lib/worker/report/types";

type ReportPayload = {
  operationId?: string;
  goodQty?: number;
  scrapQty?: number;
  idempotencyKey?: string;
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

  const service = new WorkerReportService(context.organizationId);

  try {
    const result = await service.submitReport({
      operationId: body.operationId ?? "",
      goodQty: body.goodQty ?? 0,
      scrapQty: body.scrapQty ?? 0,
      idempotencyKey: body.idempotencyKey ?? "",
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
