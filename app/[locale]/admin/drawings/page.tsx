"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";

type DrawingRow = {
  id: string;
  drawingNo: string;
  customerName?: string | null;
  demandQty: number;
  goodQty: number;
  progressPercent: number;
};

const SAMPLE_IMPORT_JSON = JSON.stringify(
  [
    {
      drawingNo: "A2-2026-DEMO",
      demandQty: 200,
      customerName: "Demo Customer",
      operations: [
        { name: "下料", isCritical: false },
        { name: "数控精车", isCritical: true },
      ],
    },
  ],
  null,
  2,
);

export default function AdminDrawingsPage() {
  const t = useTranslations("drawings");
  const [drawings, setDrawings] = useState<DrawingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showImport, setShowImport] = useState(false);
  const [importJson, setImportJson] = useState(SAMPLE_IMPORT_JSON);
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isEmpty = useMemo(() => !loading && drawings.length === 0, [loading, drawings.length]);

  const loadDrawings = useCallback(async () => {
    setLoading(true);
    const response = await fetch("/api/admin/drawings", { cache: "no-store" }).catch(() => null);
    if (!response || !response.ok) {
      setFeedback(t("status.importFailed"));
      setLoading(false);
      return;
    }
    const data = (await response.json()) as { drawings?: DrawingRow[] };
    setDrawings(data.drawings ?? []);
    setLoading(false);
  }, [t]);

  useEffect(() => {
    void loadDrawings();
  }, [loadDrawings]);

  async function onImport() {
    setSubmitting(true);
    setFeedback("");
    try {
      const payload = JSON.parse(importJson) as unknown;
      const response = await fetch("/api/admin/drawings/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        setFeedback(data.error ?? t("status.importFailed"));
        return;
      }
      setFeedback(t("status.importSuccess"));
      setShowImport(false);
      await loadDrawings();
    } catch {
      setFeedback(t("status.importFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-50 p-6">
      <section className="mx-auto w-full max-w-6xl space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900">{t("title")}</h1>
            <p className="mt-1 text-sm text-zinc-600">{t("subtitle")}</p>
          </div>
          <Button onClick={() => setShowImport(true)}>{t("importButton")}</Button>
        </div>

        {feedback ? <p className="text-sm text-zinc-700">{feedback}</p> : null}

        <Card>
          <CardHeader>
            <CardTitle>{t("title")}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <p className="text-sm text-zinc-500">{t("status.loading")}</p> : null}
            {isEmpty ? <p className="text-sm text-zinc-500">{t("status.empty")}</p> : null}
            {!loading && !isEmpty ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeaderCell>{t("columns.drawingNo")}</TableHeaderCell>
                      <TableHeaderCell>{t("columns.customerName")}</TableHeaderCell>
                      <TableHeaderCell>{t("columns.demandQty")}</TableHeaderCell>
                      <TableHeaderCell>{t("columns.goodQty")}</TableHeaderCell>
                      <TableHeaderCell>{t("columns.progress")}</TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {drawings.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium text-zinc-900">{row.drawingNo}</TableCell>
                        <TableCell>{row.customerName || "-"}</TableCell>
                        <TableCell>{row.demandQty}</TableCell>
                        <TableCell>{row.goodQty}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <Progress value={row.progressPercent} />
                            <p className="text-xs text-zinc-500">{row.progressPercent}%</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {showImport ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
            <Card className="w-full max-w-2xl">
              <CardHeader>
                <CardTitle>{t("importButton")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <textarea
                  className="h-64 w-full rounded-lg border border-zinc-300 p-3 font-mono text-xs outline-none"
                  value={importJson}
                  onChange={(event) => setImportJson(event.target.value)}
                  placeholder={t("importPlaceholder")}
                />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowImport(false)} disabled={submitting}>
                    {t("closeButton")}
                  </Button>
                  <Button onClick={onImport} disabled={submitting}>
                    {t("submitImport")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </section>
    </main>
  );
}
