import { BaseService } from "@/lib/core/base-service";
import { ConflictError, ValidationError, type SubmitWorkerReportInput } from "@/lib/worker/report/types";

export class WorkerReportService extends BaseService {
  constructor(organizationId: string) {
    super(organizationId);
  }

  async submitReport(input: SubmitWorkerReportInput) {
    const operationId = input.operationId.trim();
    const idempotencyKey = input.idempotencyKey.trim();
    const goodQty = Number(input.goodQty);
    const scrapQty = Number(input.scrapQty);
    const expectedLockVersion =
      input.expectedLockVersion === undefined ? undefined : Number(input.expectedLockVersion);

    if (!operationId || !idempotencyKey) {
      throw new ValidationError("operationId and idempotencyKey are required.");
    }
    if (!Number.isInteger(goodQty) || !Number.isInteger(scrapQty) || goodQty < 0 || scrapQty < 0) {
      throw new ValidationError("goodQty and scrapQty must be non-negative integers.");
    }
    if (goodQty === 0 && scrapQty === 0) {
      throw new ValidationError("At least one of goodQty or scrapQty must be greater than 0.");
    }
    if (
      expectedLockVersion !== undefined &&
      (!Number.isInteger(expectedLockVersion) || expectedLockVersion < 0)
    ) {
      throw new ValidationError("expectedLockVersion must be a non-negative integer.");
    }

    return this.scoped.prisma.$transaction(async (tx) => {
      const existingEvent = await tx.reportEvent.findFirst({
        where: {
          organizationId: this.organizationId,
          idempotencyKey,
        },
      });

      if (existingEvent) {
        return {
          idempotent: true,
          eventId: existingEvent.id,
          operationId: existingEvent.operationId,
          postLockVersion: existingEvent.postLockVersion,
          acceptedGoodQty: existingEvent.acceptedGoodQty,
          acceptedScrapQty: existingEvent.acceptedScrapQty,
        };
      }

      const operation = await tx.operation.findFirst({
        where: {
          id: operationId,
          organizationId: this.organizationId,
        },
        include: {
          drawing: true,
          state: true,
        },
      });

      if (!operation) {
        throw new ValidationError("Operation not found in current organization.");
      }

      const state =
        operation.state ??
        (await tx.operationState.create({
          data: {
            organizationId: this.organizationId,
            operationId: operation.id,
            inputAvailableQty: operation.planQty ?? operation.drawing.demandQty,
            reportedQty: 0,
            acceptedGoodQty: 0,
            scrapQty: 0,
            downstreamScrapQty: 0,
            effectiveGoodQty: 0,
            lockVersion: 0,
          },
        }));

      const currentVersion = state.lockVersion;
      const casVersion = expectedLockVersion ?? currentVersion;
      const planQty = operation.planQty ?? operation.drawing.demandQty;
      const pendingQty = operation.status === "WAITING_QC" ? state.reportedQty - state.acceptedGoodQty : 0;
      const nextGoodTotal = state.acceptedGoodQty + goodQty + pendingQty;

      if (nextGoodTotal > planQty) {
        throw new ValidationError(`Reported quantity exceeds planQty (${planQty}).`);
      }

      const nextReportedQty = state.reportedQty + goodQty;
      const nextAcceptedGood = operation.inspectionMode === "SELF_CHECK" ? state.acceptedGoodQty + goodQty : state.acceptedGoodQty;
      const nextScrapQty = state.scrapQty + scrapQty;
      const nextEffective = Math.max(0, nextAcceptedGood - nextScrapQty - state.downstreamScrapQty);

      const casResult = await tx.operationState.updateMany({
        where: {
          id: state.id,
          organizationId: this.organizationId,
          lockVersion: casVersion,
        },
        data: {
          reportedQty: nextReportedQty,
          acceptedGoodQty: nextAcceptedGood,
          scrapQty: nextScrapQty,
          effectiveGoodQty: nextEffective,
          lockVersion: { increment: 1 },
        },
      });

      if (casResult.count === 0) {
        throw new ConflictError("Operation state version conflict, please retry.");
      }

      const nextStatus =
        operation.inspectionMode === "DEDICATED_QC" && operation.isCritical
          ? "WAITING_QC"
          : nextEffective >= planQty
            ? "COMPLETED"
            : "IN_PROGRESS";

      await tx.operation.update({
        where: { id: operation.id },
        data: { status: nextStatus },
      });

      const createdEvent = await tx.reportEvent.create({
        data: {
          organizationId: this.organizationId,
          drawingId: operation.drawingId,
          operationId: operation.id,
          eventType: "REPORT_SUBMITTED",
          source: "WEB",
          actorUserId: input.actorUserId,
          idempotencyKey,
          requestedQty: goodQty + scrapQty,
          requestedGoodQty: goodQty,
          requestedScrapQty: scrapQty,
          acceptedGoodQty: goodQty,
          acceptedScrapQty: scrapQty,
          preLockVersion: casVersion,
          postLockVersion: casVersion + 1,
          operationEffectiveGood: nextEffective,
          operationScrapTotal: nextScrapQty,
          metadata: {
            planQty,
            inspectionMode: operation.inspectionMode,
            operationStatus: nextStatus,
          },
        },
      });

      return {
        idempotent: false,
        eventId: createdEvent.id,
        operationId: operation.id,
        postLockVersion: casVersion + 1,
        acceptedGoodQty: goodQty,
        acceptedScrapQty: scrapQty,
        operationStatus: nextStatus,
      };
    });
  }
}
