import { NextResponse } from "next/server";
import { canAccessWorker } from "@/lib/auth/rbac";
import { getRequestContext } from "@/lib/auth/request-context";
import type { AuthRole } from "@/lib/auth/session";
import { getScopedPrisma } from "@/lib/core/scoped-prisma";

type ResolvePayload = {
  code?: string;
};

function parseCandidate(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  const candidates = new Set<string>([trimmed]);

  try {
    const url = new URL(trimmed);
    const woId = url.searchParams.get("woId")?.trim();
    const drawingId = url.searchParams.get("drawingId")?.trim();
    const id = url.searchParams.get("id")?.trim();
    if (woId) candidates.add(woId);
    if (drawingId) candidates.add(drawingId);
    if (id) candidates.add(id);
  } catch {
    // Not a URL, keep the raw text candidate only.
  }

  return [...candidates];
}

export async function POST(request: Request) {
  const context = await getRequestContext();
  if (!context.organizationId) {
    return NextResponse.json({ error: "Unauthorized organization context." }, { status: 401 });
  }
  if (!canAccessWorker(context.role as AuthRole | undefined)) {
    return NextResponse.json({ error: "Worker role required." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as ResolvePayload | null;
  const code = body?.code?.trim() ?? "";
  if (!code) {
    return NextResponse.json({ error: "code is required." }, { status: 400 });
  }

  const candidates = parseCandidate(code);
  const { prisma, organizationId } = getScopedPrisma(context.organizationId);
  const drawing = await prisma.drawing.findFirst({
    where: {
      organizationId,
      OR: candidates.flatMap((item) => [{ id: item }, { drawingNo: item }, { qrCode: item }]),
    },
    select: {
      id: true,
      drawingNo: true,
      qrCode: true,
      status: true,
    },
  });

  if (!drawing) {
    return NextResponse.json({ error: "Work order not found." }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    workOrder: drawing,
  });
}
