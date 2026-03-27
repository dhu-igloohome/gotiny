import { getScopedPrisma } from "@/lib/core/scoped-prisma";

export abstract class BaseService {
  protected readonly organizationId: string;
  protected readonly scoped;

  protected constructor(organizationId: string) {
    if (!organizationId?.trim()) {
      throw new Error("organizationId is required.");
    }
    this.organizationId = organizationId.trim();
    this.scoped = getScopedPrisma(this.organizationId);
  }
}
