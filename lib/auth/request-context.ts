import { headers } from "next/headers";

export type RequestContext = {
  userId?: string;
  organizationId?: string;
  role?: string;
};

export async function getRequestContext(): Promise<RequestContext> {
  const requestHeaders = await headers();

  return {
    userId: requestHeaders.get("x-gotiny-user-id") ?? undefined,
    organizationId: requestHeaders.get("x-gotiny-org-id") ?? undefined,
    role: requestHeaders.get("x-gotiny-role") ?? undefined,
  };
}
