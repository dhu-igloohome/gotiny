import type { ScopedPrisma } from "@/lib/core/scoped-prisma";

export abstract class BaseRepository {
  protected readonly scoped: ScopedPrisma;
  protected readonly organizationId: string;
  protected readonly prisma: ScopedPrisma["prisma"];

  protected constructor(scoped: ScopedPrisma) {
    this.scoped = scoped;
    this.organizationId = scoped.organizationId;
    this.prisma = scoped.prisma;
  }
}
