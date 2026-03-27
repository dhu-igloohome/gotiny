"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { BarChart3, Factory, FileSpreadsheet, LogOut } from "lucide-react";

type AdminShellProps = {
  children: React.ReactNode;
};

const navItems = [
  { key: "dashboard", icon: BarChart3, href: "/admin" },
  { key: "drawings", icon: FileSpreadsheet, href: "/admin/drawings" },
];

export function AdminShell({ children }: AdminShellProps) {
  const t = useTranslations("adminShell");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function onLogout() {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    router.replace(`/${locale}/login`);
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-zinc-100">
      <div className="mx-auto flex max-w-[1400px] gap-4 p-4">
        <aside className="sticky top-4 h-[calc(100vh-2rem)] w-64 rounded-2xl border border-zinc-200 bg-zinc-900 p-4 text-zinc-100 shadow-sm">
          <div className="mb-6 flex items-center gap-2">
            <div className="rounded-lg bg-zinc-100/10 p-2">
              <Factory className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold">GoTiny</p>
              <p className="text-xs text-zinc-400">{t("brandSubtitle")}</p>
            </div>
          </div>

          <nav className="space-y-2">
            {navItems.map((item) => {
              const href = `/${locale}${item.href}`;
              const active = pathname === href || pathname.startsWith(`${href}/`);
              const Icon = item.icon;

              return (
                <Link
                  key={item.key}
                  href={href}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
                    active ? "bg-zinc-100 text-zinc-900" : "text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.key === "dashboard" ? t("nav.dashboard") : t("nav.drawings")}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto pt-6">
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
              onClick={onLogout}
              disabled={isLoggingOut}
            >
              <LogOut className="h-4 w-4" />
              <span>{isLoggingOut ? t("actions.loggingOut") : t("actions.logout")}</span>
            </button>
          </div>
        </aside>

        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
