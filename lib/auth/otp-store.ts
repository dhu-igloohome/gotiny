type AuthMethod = "phone" | "email";

type OtpRecord = {
  code: string;
  expiresAt: number;
};

const OTP_TTL_MS = 5 * 60 * 1000;
const otpStore = new Map<string, OtpRecord>();

function buildStoreKey(method: AuthMethod, target: string): string {
  return `${method}:${target.trim().toLowerCase()}`;
}

export function normalizeTarget(method: AuthMethod, payload: { phone?: string; email?: string }): string {
  if (method === "phone") {
    return (payload.phone ?? "").trim();
  }

  return (payload.email ?? "").trim().toLowerCase();
}

export function issueOtp(method: AuthMethod, target: string): string {
  const code = String(Math.floor(100000 + Math.random() * 900000));

  otpStore.set(buildStoreKey(method, target), {
    code,
    expiresAt: Date.now() + OTP_TTL_MS,
  });

  return code;
}

export function verifyOtp(method: AuthMethod, target: string, code: string): "ok" | "expired" | "invalid" {
  const key = buildStoreKey(method, target);
  const record = otpStore.get(key);

  if (!record) {
    return "invalid";
  }

  if (record.expiresAt < Date.now()) {
    otpStore.delete(key);
    return "expired";
  }

  if (record.code !== code.trim()) {
    return "invalid";
  }

  otpStore.delete(key);
  return "ok";
}
