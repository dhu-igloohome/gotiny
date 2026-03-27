import { getPrismaClient } from "@/lib/prisma";

let ensured = false;

async function ensureTable() {
  if (ensured) return;
  const prisma = getPrismaClient();
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS operation_authorized_workers (
      organization_id TEXT NOT NULL,
      operation_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (organization_id, operation_id, user_id)
    )`,
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS idx_oaw_org_operation
     ON operation_authorized_workers (organization_id, operation_id)`,
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS idx_oaw_org_user
     ON operation_authorized_workers (organization_id, user_id)`,
  );
  ensured = true;
}

export async function listAuthorizedUserIds(
  organizationId: string,
  operationId: string,
): Promise<string[]> {
  await ensureTable();
  const prisma = getPrismaClient();
  const rows = await prisma.$queryRawUnsafe<Array<{ user_id: string }>>(
    `SELECT user_id FROM operation_authorized_workers
     WHERE organization_id = $1 AND operation_id = $2`,
    organizationId,
    operationId,
  );
  return rows.map((row) => row.user_id);
}

export async function replaceAuthorizedUserIds(
  organizationId: string,
  operationId: string,
  userIds: string[],
) {
  await ensureTable();
  const prisma = getPrismaClient();
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `DELETE FROM operation_authorized_workers
       WHERE organization_id = $1 AND operation_id = $2`,
      organizationId,
      operationId,
    );
    for (const userId of userIds) {
      await tx.$executeRawUnsafe(
        `INSERT INTO operation_authorized_workers (organization_id, operation_id, user_id)
         VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING`,
        organizationId,
        operationId,
        userId,
      );
    }
  });
}
