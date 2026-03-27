import { NextResponse } from "next/server";
import { canAccessAdmin } from "@/lib/auth/rbac";
import { getRequestContext } from "@/lib/auth/request-context";
import { AdminDrawingService, type ImportDrawingInput } from "@/lib/admin/drawing-service";
import type { AuthRole } from "@/lib/auth/session";
import { ValidationError } from "@/lib/worker/report/types";

type ImportPayload = {
  drawings?: ImportDrawingInput[];
};

export async function POST(request: Request) {
  const context = await getRequestContext();
  if (!context.organizationId || !context.userId) {
    return NextResponse.json({ error: "Unauthorized organization context." }, { status: 401 });
  }
  if (!canAccessAdmin(context.role as AuthRole | undefined)) {
    return NextResponse.json({ error: "Admin role required." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as ImportPayload | ImportDrawingInput[] | null;
  const drawings = Array.isArray(body) ? body : body?.drawings;
  if (!drawings) {
    return NextResponse.json({ error: "drawings payload is required." }, { status: 400 });
  }

  const service = new AdminDrawingService(context.organizationId);

  const results: Array<
    | { ok: true; drawingNo: string; drawingId: string; operationIds: string[] }
    | { ok: false; drawingNo: string; reason: string }
  > = [];

  for (const drawing of drawings) {
    const drawingNo = drawing?.drawingNo ?? "UNKNOWN";
    try {
      const created = await service.importOneDrawing(drawing, context.userId);
      results.push({
        ok: true,
        drawingNo: created.drawingNo,
        drawingId: created.drawingId,
        operationIds: created.operationIds,
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        results.push({
          ok: false,
          drawingNo,
          reason: error.message,
        });
      } else {
        results.push({
          ok: false,
          drawingNo,
          reason: "Unexpected import error.",
        });
      }
    }
  }

  const successCount = results.filter((item) => item.ok).length;
  const failCount = results.length - successCount;

  return NextResponse.json({
    ok: failCount === 0,
    importedCount: successCount,
    failedCount: failCount,
    results,
  });
}
