import { getPrismaClient } from "@/lib/prisma";

export type ScopedPrisma = {
  organizationId: string;
  prisma: ReturnType<typeof getPrismaClient>;
};

export function getScopedPrisma(organizationId: string): ScopedPrisma {
  const orgId = organizationId.trim();
  if (!orgId) {
    throw new Error("organizationId is required.");
  }

  return {
    organizationId: orgId,
    prisma: getPrismaClient(),
  };
}
