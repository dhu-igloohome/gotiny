import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/server-auth";

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      id: session.sub,
      organizationId: session.orgId ?? null,
      role: session.role ?? null,
      phone: session.phone ?? null,
      email: session.email ?? null,
      locale: session.locale ?? "zh",
    },
  });
}
