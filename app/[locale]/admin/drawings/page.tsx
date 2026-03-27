"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Filter, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";

type DrawingRow = {
  id: string;
  drawingNo: string;
  customerName?: string | null;
  demandQty: number;
  goodQty: number;
  progressPercent: number;
  status: "IN_PRODUCTION" | "COMPLETED" | string;
};

type ImportResult = {
  ok: boolean;
  drawingNo: string;
  reason?: string;
};

type DrawingsPagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
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
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [drawings, setDrawings] = useState<DrawingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showImport, setShowImport] = useState(false);
  const [importJson, setImportJson] = useState(SAMPLE_IMPORT_JSON);
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [importResults, setImportResults] = useState<ImportResult[]>([]);
  const [filterDrawingNo, setFilterDrawingNo] = useState("");
  const [filterCustomer, setFilterCustomer] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [pagination, setPagination] = useState<DrawingsPagination>({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 1,
  });

  const isEmpty = useMemo(() => !loading && drawings.length === 0, [loading, drawings.length]);

  useEffect(() => {
    setFilterDrawingNo(searchParams.get("drawingNo") ?? "");
    setFilterCustomer(searchParams.get("customer") ?? "");
    setFilterStatus(searchParams.get("status") ?? "");
  }, [searchParams]);

  function updateQuery(next: { drawingNo?: string; customer?: string; status?: string; page?: string }) {
    const query = new URLSearchParams(searchParams.toString());
    const assign = (key: string, value?: string) => {
      if (!value || !value.trim()) {
        query.delete(key);
        return;
      }
      query.set(key, value.trim());
    };
    assign("drawingNo", next.drawingNo);
    assign("customer", next.customer);
    assign("status", next.status);
    assign("page", next.page);
    query.set("pageSize", "10");
    router.replace(`${pathname}?${query.toString()}`);
  }

  const loadDrawings = useCallback(async () => {
    setLoading(true);
    const query = new URLSearchParams(searchParams.toString());
    if (!query.get("page")) query.set("page", "1");
    if (!query.get("pageSize")) query.set("pageSize", "10");
    const response = await fetch(`/api/admin/drawings?${query.toString()}`, { cache: "no-store" }).catch(
      () => null,
    );
    if (!response || !response.ok) {
      setFeedback(t("status.importFailed"));
      setLoading(false);
      return;
    }
    const data = (await response.json()) as { drawings?: DrawingRow[]; pagination?: DrawingsPagination };
    setDrawings(data.drawings ?? []);
    setPagination(
      data.pagination ?? {
        page: 1,
        pageSize: 10,
        total: 0,
        totalPages: 1,
      },
    );
    setLoading(false);
  }, [searchParams, t]);

  useEffect(() => {
    void loadDrawings();
  }, [loadDrawings]);

  function onApplyFilters() {
    updateQuery({
      drawingNo: filterDrawingNo,
      customer: filterCustomer,
      status: filterStatus,
      page: "1",
    });
  }

  function onResetFilters() {
    setFilterDrawingNo("");
    setFilterCustomer("");
    setFilterStatus("");
    updateQuery({
      drawingNo: "",
      customer: "",
      status: "",
      page: "1",
    });
  }

  function onPageChange(nextPage: number) {
    const safePage = Math.max(1, Math.min(nextPage, pagination.totalPages || 1));
    updateQuery({
      drawingNo: filterDrawingNo,
      customer: filterCustomer,
      status: filterStatus,
      page: String(safePage),
    });
  }

  function onExportImportResultsCsv() {
    if (importResults.length === 0) return;
    const escapeCell = (value: string) => `"${value.replaceAll('"', '""')}"`;
    const header = ["drawingNo", "result", "reason"].join(",");
    const rows = importResults.map((item) =>
      [item.drawingNo, item.ok ? "success" : "failed", item.reason ?? ""].map((cell) => escapeCell(cell)).join(","),
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "drawing-import-results.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function onImport() {
    setSubmitting(true);
    setFeedback("");
    setImportResults([]);
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
      const results = (data.results ?? []) as ImportResult[];
      setImportResults(results);
      setFeedback(
        results.some((item) => !item.ok)
          ? `${t("status.importSuccess")} (${results.filter((item) => item.ok).length}/${results.length})`
          : t("status.importSuccess"),
      );
      await loadDrawings();
    } catch {
      setFeedback(t("status.importFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="space-y-5 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <section className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900">{t("title")}</h1>
            <p className="mt-1 text-sm text-zinc-600">{t("subtitle")}</p>
          </div>
          <Button onClick={() => setShowImport(true)}>
            <Upload className="mr-2 h-4 w-4" />
            {t("importButton")}
          </Button>
        </div>

        <div className="sticky top-4 z-10 grid gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 shadow-sm sm:grid-cols-3">
          <Input
            placeholder={t("filters.drawingNo")}
            value={filterDrawingNo}
            onChange={(event) => setFilterDrawingNo(event.target.value)}
          />
          <Input
            placeholder={t("filters.customerName")}
            value={filterCustomer}
            onChange={(event) => setFilterCustomer(event.target.value)}
          />
          <Select value={filterStatus} onChange={(event) => setFilterStatus(event.target.value)}>
            <option value="">{t("filters.allStatus")}</option>
            <option value="IN_PRODUCTION">{t("filters.inProduction")}</option>
            <option value="COMPLETED">{t("filters.completed")}</option>
          </Select>
          <div className="sm:col-span-3 flex justify-end gap-2">
            <Button variant="outline" onClick={onResetFilters}>
              {t("filters.reset")}
            </Button>
            <Button onClick={onApplyFilters}>{t("filters.apply")}</Button>
          </div>
        </div>

        {feedback ? (
          <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
            <Filter className="h-4 w-4" />
            <span>{feedback}</span>
          </div>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>{t("title")}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <p className="text-sm text-zinc-500">{t("status.loading")}</p> : null}
            {isEmpty ? <p className="text-sm text-zinc-500">{t("status.empty")}</p> : null}
            {!loading && !isEmpty ? (
              <div className="space-y-3">
                <div className="overflow-x-auto">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeaderCell>{t("columns.drawingNo")}</TableHeaderCell>
                      <TableHeaderCell>{t("columns.customerName")}</TableHeaderCell>
                      <TableHeaderCell>{t("columns.demandQty")}</TableHeaderCell>
                      <TableHeaderCell>{t("columns.goodQty")}</TableHeaderCell>
                      <TableHeaderCell>{t("filters.allStatus")}</TableHeaderCell>
                      <TableHeaderCell>{t("columns.progress")}</TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {drawings.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium text-zinc-900">
                          <Link href={`/${locale}/admin/drawings/${row.id}`} className="underline-offset-2 hover:underline">
                            {row.drawingNo}
                          </Link>
                        </TableCell>
                        <TableCell>{row.customerName || "-"}</TableCell>
                        <TableCell>{row.demandQty}</TableCell>
                        <TableCell>{row.goodQty}</TableCell>
                        <TableCell>
                          <Badge tone={row.status === "COMPLETED" ? "success" : "warning"}>
                            {row.status === "COMPLETED" ? t("filters.completed") : t("filters.inProduction")}
                          </Badge>
                        </TableCell>
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
                <div className="flex items-center justify-between">
                  <p className="text-xs text-zinc-500">
                    {t("pagination.total", { count: pagination.total })} ·{" "}
                    {t("pagination.page", { page: pagination.page, totalPages: pagination.totalPages })}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => onPageChange(pagination.page - 1)}
                      disabled={pagination.page <= 1}
                    >
                      {t("pagination.prev")}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => onPageChange(pagination.page + 1)}
                      disabled={pagination.page >= pagination.totalPages}
                    >
                      {t("pagination.next")}
                    </Button>
                  </div>
                </div>
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
                  {importResults.length > 0 ? (
                    <Button variant="outline" onClick={onExportImportResultsCsv}>
                      {t("exportImportResultCsv")}
                    </Button>
                  ) : null}
                  <Button variant="outline" onClick={() => setShowImport(false)} disabled={submitting}>
                    {t("closeButton")}
                  </Button>
                  <Button onClick={onImport} disabled={submitting}>
                    {t("submitImport")}
                  </Button>
                </div>
                {importResults.length > 0 ? (
                  <div className="max-h-56 overflow-auto rounded-lg border border-zinc-200">
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableHeaderCell>{t("importResult.columns.drawingNo")}</TableHeaderCell>
                          <TableHeaderCell>{t("importResult.columns.result")}</TableHeaderCell>
                          <TableHeaderCell>{t("importResult.columns.reason")}</TableHeaderCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {importResults.map((item, index) => (
                          <TableRow key={`${item.drawingNo}-${index}`}>
                            <TableCell>{item.drawingNo}</TableCell>
                            <TableCell>{item.ok ? t("importResult.success") : t("importResult.failed")}</TableCell>
                            <TableCell>{item.reason ?? "-"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>
        ) : null}
      </section>
    </main>
  );
}
