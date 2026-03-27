export type SubmitWorkerReportInput = {
  operationId: string;
  goodQty: number;
  scrapQty: number;
  idempotencyKey: string;
  actorUserId?: string;
  expectedLockVersion?: number;
};

export class ConflictError extends Error {}
export class ValidationError extends Error {}
