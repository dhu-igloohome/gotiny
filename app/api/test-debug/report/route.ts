import { NextResponse } from "next/server";
import { getPrismaClient } from "@/lib/prisma";
import { WorkerReportService } from "@/lib/worker/report/report-service";
import { ConflictError, ValidationError } from "@/lib/worker/report/types";

const DEBUG_ORGANIZATION_ID = "cmn8f7tkg0001kktpxe9gmffy";
const DEBUG_USER_ID = "cmn8f7thk0000kktpbudsdmnx";
const DEBUG_OPERATION_ID = "cmn8f7tsq0004kktp3nofycqj";

type DebugReportPayload = {
  operationId?: string;
  goodQty?: number;
  scrapQty?: number;
  idempotencyKey?: string;
  expectedLockVersion?: number;
};

export async function GET() {
  const prisma = getPrismaClient();
  const state = await prisma.operationState.findFirst({
    where: {
      organizationId: DEBUG_ORGANIZATION_ID,
      operationId: DEBUG_OPERATION_ID,
    },
    select: {
      lockVersion: true,
      reportedQty: true,
      acceptedGoodQty: true,
      scrapQty: true,
      effectiveGoodQty: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({
    ok: true,
    fixedContext: {
      organizationId: DEBUG_ORGANIZATION_ID,
      userId: DEBUG_USER_ID,
      defaultOperationId: DEBUG_OPERATION_ID,
    },
    state,
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as DebugReportPayload | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const service = new WorkerReportService(DEBUG_ORGANIZATION_ID);

  try {
    const result = await service.submitReport({
      operationId: body.operationId ?? DEBUG_OPERATION_ID,
      goodQty: body.goodQty ?? 0,
      scrapQty: body.scrapQty ?? 0,
      idempotencyKey: body.idempotencyKey ?? "",
      expectedLockVersion: body.expectedLockVersion,
      actorUserId: DEBUG_USER_ID,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (error instanceof ConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    return NextResponse.json({ error: "Debug report failed." }, { status: 500 });
  }
}
