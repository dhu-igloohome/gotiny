import type { AuthRole } from "@/lib/auth/session";

const adminRoles: AuthRole[] = ["OWNER", "ADMIN"];
const workerRoles: AuthRole[] = ["OWNER", "ADMIN", "WORKER", "QC"];

export function canAccessAdmin(role?: AuthRole): boolean {
  return !!role && adminRoles.includes(role);
}

export function canAccessWorker(role?: AuthRole): boolean {
  return !!role && workerRoles.includes(role);
}
