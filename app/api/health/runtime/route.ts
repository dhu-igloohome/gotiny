import { NextResponse } from "next/server";

function maskConnectionString(value: string | undefined): string {
  if (!value) return "missing";
  if (value.length <= 20) return "***";
  return `${value.slice(0, 12)}...${value.slice(-8)}`;
}

export async function GET() {
  const payload = {
    ok: true,
    checks: {
      hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
      hasJwtSecret: Boolean(process.env.JWT_SECRET),
    },
    runtime: {
      nodeEnv: process.env.NODE_ENV ?? "unknown",
      vercelEnv: process.env.VERCEL_ENV ?? "unknown",
      vercelProjectId: process.env.VERCEL_PROJECT_ID ?? "unknown",
      vercelUrl: process.env.VERCEL_URL ?? "unknown",
      databaseUrlMasked: maskConnectionString(process.env.DATABASE_URL),
    },
  };

  const status = payload.checks.hasDatabaseUrl ? 200 : 500;
  return NextResponse.json(payload, { status });
}
