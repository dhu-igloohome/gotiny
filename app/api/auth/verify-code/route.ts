import { NextResponse } from "next/server";
import { normalizeTarget, verifyOtp } from "@/lib/auth/otp-store";
import { getSessionCookieMaxAge, SESSION_COOKIE_NAME, signSessionToken } from "@/lib/auth/session";
import { getPrismaClient } from "@/lib/prisma";

type VerifyCodePayload = {
  method?: "phone" | "email";
  phone?: string;
  email?: string;
  code?: string;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as VerifyCodePayload | null;

  if (!body?.method || (body.method !== "phone" && body.method !== "email")) {
    return NextResponse.json({ error: "Invalid auth method." }, { status: 400 });
  }

  const target = normalizeTarget(body.method, body);
  if (!target || !body.code?.trim()) {
    return NextResponse.json({ error: "Missing target or code." }, { status: 400 });
  }

  const result = verifyOtp(body.method, target, body.code);

  if (result === "expired") {
    return NextResponse.json({ error: "Code expired." }, { status: 400 });
  }

  if (result === "invalid") {
    return NextResponse.json({ error: "Invalid code." }, { status: 400 });
  }

  const prisma = getPrismaClient();

  const user =
    body.method === "phone"
      ? await prisma.user.upsert({
          where: { phone: target },
          create: { phone: target },
          update: {},
        })
      : await prisma.user.upsert({
          where: { email: target },
          create: { email: target },
          update: {},
        });

  const defaultMembership = await prisma.organizationUser.findFirst({
    where: { userId: user.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });

  const sessionToken = await signSessionToken({
    sub: user.id,
    orgId: defaultMembership?.organizationId,
    role: defaultMembership?.role,
    phone: user.phone,
    email: user.email,
    locale: user.preferredLocale,
  });
  const response = NextResponse.json(
    {
      ok: true,
      message: "Code verified.",
      method: body.method,
      target,
      user: {
        id: user.id,
        role: defaultMembership?.role ?? null,
        phone: user.phone,
        email: user.email,
      },
      session: {
        tokenType: "Cookie",
      },
    },
    { status: 200 },
  );

  response.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: getSessionCookieMaxAge(),
  });

  return response;
}
