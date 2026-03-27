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

  const body = (await request.json().catch(() => null)) as ImportPayload | null;
  if (!body?.drawings) {
    return NextResponse.json({ error: "drawings payload is required." }, { status: 400 });
  }

  const service = new AdminDrawingService(context.organizationId);

  try {
    const created = await service.importDrawings(body.drawings, context.userId);
    return NextResponse.json({
      ok: true,
      importedCount: created.length,
      created,
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: "Import failed." }, { status: 500 });
  }
}
