import { NextResponse } from "next/server";
import { issueOtp, normalizeTarget } from "@/lib/auth/otp-store";

type SendCodePayload = {
  method?: "phone" | "email";
  phone?: string;
  email?: string;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as SendCodePayload | null;

  if (!body?.method || (body.method !== "phone" && body.method !== "email")) {
    return NextResponse.json({ error: "Invalid auth method." }, { status: 400 });
  }

  const target = normalizeTarget(body.method, body);
  if (!target) {
    return NextResponse.json({ error: "Missing phone or email." }, { status: 400 });
  }

  const code = issueOtp(body.method, target);

  return NextResponse.json(
    {
      ok: true,
      message: "Verification code issued.",
      method: body.method,
      target,
      expiresInSeconds: 300,
      devOnlyCode: code,
    },
    { status: 200 },
  );
}
