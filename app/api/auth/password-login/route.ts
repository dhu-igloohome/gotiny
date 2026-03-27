import { NextResponse } from "next/server";
import { verifyPassword } from "@/lib/auth/password";
import { getSessionCookieMaxAge, SESSION_COOKIE_NAME, signSessionToken } from "@/lib/auth/session";
import { getPrismaClient } from "@/lib/prisma";

type PasswordLoginPayload = {
  account?: string;
  password?: string;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as PasswordLoginPayload | null;
  const account = body?.account?.trim();
  const password = body?.password?.trim();

  if (!account || !password) {
    return NextResponse.json({ error: "Account and password are required." }, { status: 400 });
  }

  try {
    const prisma = getPrismaClient();
    const user =
      (await prisma.user.findFirst({ where: { email: account.toLowerCase() } })) ??
      (await prisma.user.findFirst({ where: { phone: account } }));

    if (!user?.passwordHash || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ error: "Invalid account or password." }, { status: 401 });
    }

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

    const response = NextResponse.json({
      ok: true,
      message: "Login success.",
      user: {
        id: user.id,
        role: defaultMembership?.role ?? null,
      },
    });

    response.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: getSessionCookieMaxAge(),
    });

    return response;
  } catch {
    return NextResponse.json({ error: "Login service unavailable." }, { status: 503 });
  }
}
