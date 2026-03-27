import { randomUUID } from "node:crypto";

export function issueDevSessionToken(userId: string): string {
  return `dev_${userId}_${randomUUID().replaceAll("-", "")}`;
}
