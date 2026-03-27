import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEY_LEN = 64;

export function hashPassword(plainText: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(plainText, salt, KEY_LEN).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(plainText: string, stored: string): boolean {
  const [salt, hashed] = stored.split(":");
  if (!salt || !hashed) return false;

  const input = scryptSync(plainText, salt, KEY_LEN);
  const target = Buffer.from(hashed, "hex");
  if (input.length !== target.length) return false;

  return timingSafeEqual(input, target);
}
