import { BaseRepository } from "@/lib/core/base-repository";
import type { ScopedPrisma } from "@/lib/core/scoped-prisma";

export class WorkerReportRepository extends BaseRepository {
  constructor(scoped: ScopedPrisma) {
    super(scoped);
  }

  async findOperationWithState(operationId: string) {
    return this.prisma.operation.findFirst({
      where: {
        id: operationId,
        organizationId: this.organizationId,
      },
      include: {
        drawing: true,
        state: true,
      },
    });
  }
}
