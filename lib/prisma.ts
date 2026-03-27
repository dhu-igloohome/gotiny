import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/generated/prisma/client";

declare global {
  var prisma: PrismaClient | undefined;
}

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL?.trim();

  if (!connectionString) {
    throw new Error("DATABASE_URL is required for Prisma client.");
  }

  const adapter = new PrismaPg({ connectionString });

  return new PrismaClient({
    adapter,
  });
}

export function getPrismaClient(): PrismaClient {
  if (globalThis.prisma) {
    return globalThis.prisma;
  }

  const client = createPrismaClient();

  if (process.env.NODE_ENV !== "production") {
    globalThis.prisma = client;
  }

  return client;
}
