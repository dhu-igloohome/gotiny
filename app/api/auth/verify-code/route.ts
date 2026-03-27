import { NextResponse } from "next/server";
import { normalizeTarget, verifyOtp } from "@/lib/auth/otp-store";
import { issueDevSessionToken } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

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

  const sessionToken = issueDevSessionToken(user.id);

  return NextResponse.json(
    {
      ok: true,
      message: "Code verified.",
      method: body.method,
      target,
      user: {
        id: user.id,
        role: user.role,
        phone: user.phone,
        email: user.email,
      },
      session: {
        token: sessionToken,
        tokenType: "Bearer",
      },
    },
    { status: 200 },
  );
}
