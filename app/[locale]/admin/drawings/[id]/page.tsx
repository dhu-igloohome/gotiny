"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { CheckCircle2, Copy, LoaderCircle, QrCode, Timer } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

  function getStatusTone(status: string): "neutral" | "success" | "warning" {
    if (status === "COMPLETED") return "success";
    if (status === "IN_PROGRESS") return "warning";
    return "neutral";
  }

  async function copyQr(value: string) {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // ignore clipboard errors in unsupported browsers
    }
  }

  return (
    <main className="space-y-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <section className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{t("detail.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="flex items-center gap-2 text-sm text-zinc-500">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                {t("status.loading")}
              </p>
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

        <div className="space-y-4">
          {operationCards.map((op, index) => (
            <div key={op.id} className="relative">
              {index < operationCards.length - 1 ? (
                <div className="absolute left-4 top-16 h-[calc(100%-1rem)] w-px bg-zinc-300" />
              ) : null}
              <Card className="ml-8">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>
                    #{op.sequence} {op.name}
                  </CardTitle>
                  <Badge tone={getStatusTone(op.status)}>{mapOpStatus(op.status, t)}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-zinc-500">{t("columns.goodQty")}</p>
                    <p className="flex items-center gap-1 text-sm font-semibold text-zinc-900">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      {op.goodQty}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">{t("detail.scrapQty")}</p>
                    <p className="flex items-center gap-1 text-sm font-semibold text-zinc-900">
                      <Timer className="h-4 w-4 text-amber-600" />
                      {op.scrapQty}
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="flex items-center gap-1 text-xs font-medium text-zinc-600">
                      <QrCode className="h-3.5 w-3.5" />
                      QR
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-7 px-2 text-xs"
                      onClick={() => copyQr(op.code || `${op.id}`)}
                    >
                      <Copy className="mr-1 h-3.5 w-3.5" />
                      Copy
                    </Button>
                  </div>
                  <div className="flex justify-center rounded-lg border border-zinc-200 bg-white p-3">
                    <QRCodeSVG value={op.code || `${op.id}`} size={120} />
                  </div>
                </div>
              </CardContent>
            </Card>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
