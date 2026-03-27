"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Activity, AlertTriangle, CircleCheckBig, Package } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type DashboardStats = {
  totalPlannedQty: number;
  goodRatePercent: number;
  scrapRatePercent: number;
  inProgressDrawingCount: number;
  productionTrend?: Array<{
    date: string;
    goodQty: number;
    scrapQty: number;
  }>;
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
    { label: t("cards.totalPlannedQty"), value: `${stats.totalPlannedQty}`, icon: Package },
    { label: t("cards.goodRate"), value: `${stats.goodRatePercent}%`, icon: CircleCheckBig },
    { label: t("cards.scrapRate"), value: `${stats.scrapRatePercent}%`, icon: AlertTriangle },
    { label: t("cards.inProgressDrawingCount"), value: `${stats.inProgressDrawingCount}`, icon: Activity },
  ];
  const trendData = stats.productionTrend ?? [];
  const trendMax = trendData.reduce((max, item) => Math.max(max, item.goodQty, item.scrapQty), 0);
  const hasTrendData = trendData.some((item) => item.goodQty > 0 || item.scrapQty > 0);

  return (
    <main className="space-y-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <section className="space-y-6">
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
            <Card key={card.label} className="border-zinc-200">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm text-zinc-500">{card.label}</CardTitle>
                <card.icon className="h-4 w-4 text-zinc-400" />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold text-zinc-900">{card.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="border-zinc-200">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-sm text-zinc-500">{t("trend.title")}</CardTitle>
              <div className="flex items-center gap-4 text-xs text-zinc-600">
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block h-2.5 w-2.5 rounded bg-emerald-500" />
                  {t("trend.goodQty")}
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block h-2.5 w-2.5 rounded bg-amber-500" />
                  {t("trend.scrapQty")}
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {!hasTrendData ? (
              <p className="text-sm text-zinc-500">{t("trend.empty")}</p>
            ) : (
              <div className="grid grid-cols-7 gap-2">
                {trendData.map((item) => {
                  const safeMax = trendMax || 1;
                  const goodHeight = Math.max(6, Math.round((item.goodQty / safeMax) * 80));
                  const scrapHeight = Math.max(6, Math.round((item.scrapQty / safeMax) * 80));
                  return (
                    <div key={item.date} className="flex flex-col items-center gap-2">
                      <div className="flex h-24 w-full items-end justify-center gap-1 rounded bg-zinc-100 px-1">
                        <div className="w-4 rounded-t bg-emerald-500" style={{ height: goodHeight }} />
                        <div className="w-4 rounded-t bg-amber-500" style={{ height: scrapHeight }} />
                      </div>
                      <p className="text-[10px] text-zinc-500">{item.date.slice(5)}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
