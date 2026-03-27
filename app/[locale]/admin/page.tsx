"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type DashboardStats = {
  totalPlannedQty: number;
  goodRatePercent: number;
  scrapRatePercent: number;
  inProgressDrawingCount: number;
};

export default function AdminHomePage() {
  const t = useTranslations("admin");
  const locale = useLocale();
  const [stats, setStats] = useState<DashboardStats>({
    totalPlannedQty: 0,
    goodRatePercent: 0,
    scrapRatePercent: 0,
    inProgressDrawingCount: 0,
  });

  useEffect(() => {
    void (async () => {
      const response = await fetch("/api/admin/dashboard/stats", { cache: "no-store" }).catch(() => null);
      if (!response || !response.ok) {
        return;
      }
      const data = (await response.json()) as { stats?: DashboardStats };
      if (data.stats) {
        setStats(data.stats);
      }
    })();
  }, []);

  const cards = [
    { label: t("cards.totalPlannedQty"), value: `${stats.totalPlannedQty}` },
    { label: t("cards.goodRate"), value: `${stats.goodRatePercent}%` },
    { label: t("cards.scrapRate"), value: `${stats.scrapRatePercent}%` },
    { label: t("cards.inProgressDrawingCount"), value: `${stats.inProgressDrawingCount}` },
  ];

  return (
    <main className="min-h-screen bg-zinc-50 p-6">
      <section className="mx-auto w-full max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900">{t("title")}</h1>
            <p className="mt-1 text-sm text-zinc-600">{t("subtitle")}</p>
          </div>
          <Link href={`/${locale}/admin/drawings`}>
            <Button>{t("actions.viewDrawings")}</Button>
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((card) => (
            <Card key={card.label}>
              <CardHeader>
                <CardTitle className="text-sm text-zinc-500">{card.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold text-zinc-900">{card.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </main>
  );
}
