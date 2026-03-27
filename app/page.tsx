import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/server-auth";
import { canAccessAdmin } from "@/lib/auth/rbac";

export default async function Home() {
  const session = await getServerSession();
  if (!session?.sub) {
    redirect("/zh/login");
  }

  if (canAccessAdmin(session.role)) {
    redirect("/zh/admin");
  }

  redirect("/zh/worker");
}
