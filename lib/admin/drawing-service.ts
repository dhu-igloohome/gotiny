import { BaseService } from "@/lib/core/base-service";
import { ValidationError } from "@/lib/worker/report/types";

type ImportOperationInput = {
  name: string;
  isCritical?: boolean;
  planQty?: number;
};

export type ImportDrawingInput = {
  drawingNo: string;
  demandQty: number;
  plannedQty?: number;
  customerName?: string;
  operations: ImportOperationInput[];
};

export type ImportSuccessResult = {
  ok: true;
  drawingId: string;
  drawingNo: string;
  operationIds: string[];
};

export type ImportFailureResult = {
  ok: false;
  drawingNo: string;
  reason: string;
};

export class AdminDrawingService extends BaseService {
  async importOneDrawing(drawing: ImportDrawingInput, actorUserId?: string): Promise<ImportSuccessResult> {
    const [created] = await this.importDrawings([drawing], actorUserId);
    return {
      ok: true,
      drawingId: created.drawingId,
      drawingNo: created.drawingNo,
      operationIds: created.operationIds,
    };
  }

  async importDrawings(drawings: ImportDrawingInput[], actorUserId?: string) {
    if (!Array.isArray(drawings) || drawings.length === 0) {
      throw new ValidationError("drawings must be a non-empty array.");
    }

    return this.scoped.prisma.$transaction(async (tx) => {
      const created: Array<{ drawingId: string; drawingNo: string; operationIds: string[] }> = [];

      for (const item of drawings) {
        if (!item.drawingNo?.trim()) {
          throw new ValidationError("drawingNo is required.");
        }
        if (!Number.isInteger(item.demandQty) || item.demandQty <= 0) {
          throw new ValidationError(`Invalid demandQty for drawing ${item.drawingNo}.`);
        }
        if (!Array.isArray(item.operations) || item.operations.length === 0) {
          throw new ValidationError(`operations is required for drawing ${item.drawingNo}.`);
        }

        const drawing = await tx.drawing.create({
          data: {
            organizationId: this.organizationId,
            drawingNo: item.drawingNo.trim(),
            demandQty: item.demandQty,
            plannedQty: item.plannedQty ?? item.demandQty,
            customerName: item.customerName?.trim() || null,
            status: "IN_PRODUCTION",
            qrCode: `${this.organizationId}-${item.drawingNo.trim()}`,
            createdByUserId: actorUserId,
          },
        });

        const operationIds: string[] = [];
        for (let i = 0; i < item.operations.length; i += 1) {
          const op = item.operations[i];
          if (!op?.name?.trim()) {
            throw new ValidationError(`Operation name is required for drawing ${item.drawingNo}.`);
          }

          const opSeq = i + 1;
          const opQr = `${this.organizationId}-${item.drawingNo.trim()}-${opSeq}`;
          const operation = await tx.operation.create({
            data: {
              organizationId: this.organizationId,
              drawingId: drawing.id,
              name: op.name.trim(),
              sequence: opSeq,
              planQty: op.planQty ?? drawing.plannedQty ?? drawing.demandQty,
              isCritical: Boolean(op.isCritical),
              status: "READY",
              code: opQr,
              createdByUserId: actorUserId,
            },
          });

          await tx.operationState.create({
            data: {
              organizationId: this.organizationId,
              operationId: operation.id,
              lockVersion: 0,
              inputAvailableQty: op.planQty ?? drawing.plannedQty ?? drawing.demandQty,
              reportedQty: 0,
              acceptedGoodQty: 0,
              scrapQty: 0,
              downstreamScrapQty: 0,
              effectiveGoodQty: 0,
            },
          });

          operationIds.push(operation.id);
        }

        created.push({
          drawingId: drawing.id,
          drawingNo: drawing.drawingNo,
          operationIds,
        });
      }

      return created;
    });
  }
}
