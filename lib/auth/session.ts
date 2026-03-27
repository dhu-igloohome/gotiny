import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE_NAME = "gotiny_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const DEV_JWT_SECRET = "gotiny_dev_secret_change_me";

export type AuthRole = "OWNER" | "ADMIN" | "WORKER" | "OBSERVER" | "QC" | "OUTSOURCE";

export type SessionPayload = {
  sub: string;
  orgId?: string;
  role?: AuthRole;
  phone?: string | null;
  email?: string | null;
  locale?: string;
};

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET ?? DEV_JWT_SECRET;
  return new TextEncoder().encode(secret);
}

export async function signSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({
    orgId: payload.orgId,
    role: payload.role,
    phone: payload.phone ?? null,
    email: payload.email ?? null,
    locale: payload.locale ?? "zh",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getJwtSecret());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());

    return {
      sub: payload.sub ?? "",
      orgId: typeof payload.orgId === "string" ? payload.orgId : undefined,
      role: typeof payload.role === "string" ? (payload.role as AuthRole) : undefined,
      phone: typeof payload.phone === "string" ? payload.phone : null,
      email: typeof payload.email === "string" ? payload.email : null,
      locale: typeof payload.locale === "string" ? payload.locale : "zh",
    };
  } catch {
    return null;
  }
}

export function getSessionCookieMaxAge(): number {
  return SESSION_MAX_AGE_SECONDS;
}
