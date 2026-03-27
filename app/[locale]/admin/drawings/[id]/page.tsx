"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { QRCodeSVG } from "qrcode.react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type OperationDetail = {
  id: string;
  name: string;
  sequence: number;
  code?: string | null;
  status: string;
  goodQty: number;
  scrapQty: number;
};

type DrawingDetail = {
  id: string;
  drawingNo: string;
  customerName?: string | null;
  demandQty: number;
  plannedQty: number;
  operations: OperationDetail[];
};

function mapOpStatus(status: string, t: ReturnType<typeof useTranslations>) {
  if (status === "READY") return t("detail.status.ready");
  if (status === "IN_PROGRESS") return t("detail.status.inProgress");
  if (status === "COMPLETED") return t("detail.status.completed");
  return status;
}

export default function DrawingDetailPage() {
  const t = useTranslations("drawings");
  const params = useParams<{ id: string }>();
  const drawingId = params.id;
  const [loading, setLoading] = useState(true);
  const [drawing, setDrawing] = useState<DrawingDetail | null>(null);

  useEffect(() => {
    if (!drawingId) return;
    void (async () => {
      setLoading(true);
      const response = await fetch(`/api/admin/drawings/${drawingId}`, { cache: "no-store" }).catch(() => null);
      if (!response || !response.ok) {
        setDrawing(null);
        setLoading(false);
        return;
      }
      const data = (await response.json()) as { drawing?: DrawingDetail };
      setDrawing(data.drawing ?? null);
      setLoading(false);
    })();
  }, [drawingId]);

  const operationCards = useMemo(() => drawing?.operations ?? [], [drawing?.operations]);

  return (
    <main className="min-h-screen bg-zinc-50 p-6">
      <section className="mx-auto w-full max-w-6xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{t("detail.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-zinc-500">{t("status.loading")}</p>
            ) : !drawing ? (
              <p className="text-sm text-zinc-500">{t("detail.notFound")}</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-zinc-500">{t("columns.drawingNo")}</p>
                  <p className="text-sm font-semibold text-zinc-900">{drawing.drawingNo}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">{t("columns.customerName")}</p>
                  <p className="text-sm font-semibold text-zinc-900">{drawing.customerName ?? "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">{t("columns.demandQty")}</p>
                  <p className="text-sm font-semibold text-zinc-900">{drawing.demandQty}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          {operationCards.map((op) => (
            <Card key={op.id}>
              <CardHeader>
                <CardTitle>
                  #{op.sequence} {op.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-zinc-500">{t("columns.goodQty")}</p>
                    <p className="text-sm font-semibold text-zinc-900">{op.goodQty}</p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">{t("detail.scrapQty")}</p>
                    <p className="text-sm font-semibold text-zinc-900">{op.scrapQty}</p>
                  </div>
                </div>
                <p className="text-xs text-zinc-600">
                  {t("detail.operationStatus")}: {mapOpStatus(op.status, t)}
                </p>
                <div className="flex justify-center rounded-lg border border-zinc-200 bg-white p-3">
                  <QRCodeSVG value={op.code || `${op.id}`} size={120} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </main>
  );
}
