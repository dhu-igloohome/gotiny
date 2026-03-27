"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type WorkerDrawing = {
  id: string;
  qrCode: string;
  drawingNo: string;
  status: string;
  canReportCurrentOperation: boolean;
  authorizedWorkerCount: number;
  operations: Array<{
    id: string;
    sequence: number;
    name: string;
    status: string;
    goodQty: number;
    scrapQty: number;
  }>;
  currentOperation: {
    id: string;
    name: string;
    sequence: number;
    status: string;
    inspectionMode: "SELF_CHECK" | "DEDICATED_QC";
    lockVersion: number;
    maxGoodCanReport: number;
    goodQty: number;
    scrapQty: number;
  } | null;
};

function makeIdempotencyKey(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

export default function WorkerHomePage() {
  const searchParams = useSearchParams();
  const drawingId = searchParams.get("drawingId")?.trim() ?? "";
  const qrCodeParam = searchParams.get("code")?.trim() ?? "";

  const [scanCode, setScanCode] = useState(qrCodeParam);
  const [manualDrawingId, setManualDrawingId] = useState(drawingId);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [drawing, setDrawing] = useState<WorkerDrawing | null>(null);
  const [reportQty, setReportQty] = useState("");
  const [scrapQty, setScrapQty] = useState("0");
  const [photoLinks, setPhotoLinks] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState<number | null>(null);

  const activeDrawingId = useMemo(() => drawingId || manualDrawingId.trim(), [drawingId, manualDrawingId]);

  const loadDrawing = useCallback(async () => {
    if (!activeDrawingId) return;
    setLoading(true);
    setError("");
    const response = await fetch(`/api/worker/drawing/${activeDrawingId}`, { cache: "no-store" }).catch(() => null);
    if (!response || !response.ok) {
      setLoading(false);
      setDrawing(null);
      setError("读取图纸失败，请确认图纸ID和登录状态。");
      return;
    }
    const data = (await response.json()) as { drawing?: WorkerDrawing };
    setDrawing(data.drawing ?? null);
    setLoading(false);
  }, [activeDrawingId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadDrawing();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadDrawing]);

  useEffect(() => {
    if (!countdown || countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((prev) => (prev ? prev - 1 : null)), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  useEffect(() => {
    if (countdown !== 0) return;
    window.close();
  }, [countdown]);

  useEffect(() => {
    const max = drawing?.currentOperation?.maxGoodCanReport;
    if (typeof max === "number" && Number.isFinite(max)) {
      setReportQty(String(max));
    }
  }, [drawing?.currentOperation?.id, drawing?.currentOperation?.maxGoodCanReport]);

  async function submitStart() {
    if (!drawing?.currentOperation || !drawing.canReportCurrentOperation) return;
    setSubmitting(true);
    setError("");
    setMessage("");
    const response = await fetch("/api/worker/operation/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operationId: drawing.currentOperation.id }),
    }).catch(() => null);
    if (!response || !response.ok) {
      setSubmitting(false);
      setError("开工失败，请稍后重试。");
      return;
    }
    setMessage("开工成功，3秒后将自动关闭。");
    setCountdown(3);
    await loadDrawing();
    setSubmitting(false);
  }

  async function submitReport() {
    if (!drawing?.currentOperation || !drawing.canReportCurrentOperation) return;
    const parsedReport = Number(reportQty);
    const parsedScrap = Number(scrapQty);
    const photos = photoLinks
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
    if (!Number.isInteger(parsedReport) || parsedReport <= 0) {
      setError("本次报工数量必须是正整数。");
      return;
    }
    if (!Number.isInteger(parsedScrap) || parsedScrap < 0) {
      setError("报废数量必须是非负整数。");
      return;
    }
    if (parsedReport > drawing.currentOperation.maxGoodCanReport) {
      setError(`本次报工数量不能超过可报上限 ${drawing.currentOperation.maxGoodCanReport}。`);
      return;
    }
    if (parsedScrap > parsedReport) {
      setError("报废数量不能大于本次报工数量。");
      return;
    }
    const goodQty = parsedReport - parsedScrap;

    setSubmitting(true);
    setError("");
    setMessage("");
    const response = await fetch("/api/worker/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        operationId: drawing.currentOperation.id,
        goodQty,
        scrapQty: parsedScrap,
        photoUrls: photos,
        expectedLockVersion: drawing.currentOperation.lockVersion,
        idempotencyKey: makeIdempotencyKey("worker"),
      }),
    }).catch(() => null);

    const data = response ? ((await response.json().catch(() => ({}))) as { error?: string }) : null;
    if (!response || !response.ok) {
      setSubmitting(false);
      setError(data?.error ?? "报工失败，请刷新后重试。");
      return;
    }

    setMessage("报工成功，3秒后将自动关闭。");
    setCountdown(3);
    await loadDrawing();
    setSubmitting(false);
  }

  async function submitOutsource(action: "SEND" | "RETURN") {
    if (!drawing || !drawing.canReportCurrentOperation) return;
    setSubmitting(true);
    setError("");
    setMessage("");
    const response = await fetch(`/api/worker/drawing/${drawing.id}/outsource`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    }).catch(() => null);
    const data = response ? ((await response.json().catch(() => ({}))) as { error?: string }) : null;
    if (!response || !response.ok) {
      setSubmitting(false);
      setError(data?.error ?? "委外操作失败。");
      return;
    }
    setMessage(action === "SEND" ? "已标记委外发出。" : "已标记委外回厂。");
    await loadDrawing();
    setSubmitting(false);
  }

  async function resolveWorkOrderByCode() {
    if (!scanCode.trim()) {
      setError("请输入工单二维码内容或工单号。");
      return;
    }
    setLoading(true);
    setError("");
    const response = await fetch("/api/worker/work-order/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: scanCode.trim() }),
    }).catch(() => null);
    const data = response ? ((await response.json().catch(() => ({}))) as { workOrder?: { id: string }; error?: string }) : null;
    setLoading(false);
    if (!response || !response.ok || !data?.workOrder?.id) {
      setError(data?.error ?? "未识别到有效工单，请检查二维码内容。");
      return;
    }
    window.location.href = `?drawingId=${encodeURIComponent(data.workOrder.id)}`;
  }

  return (
    <main className="min-h-screen bg-zinc-100 p-3">
      <section className="mx-auto w-full max-w-md space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h1 className="text-lg font-semibold text-zinc-900">工人扫码报工</h1>
        {!drawingId ? (
          <div className="space-y-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
            <p className="text-xs text-zinc-500">可粘贴扫码结果（URL/工单号/二维码原文）自动识别。</p>
            <textarea
              value={scanCode}
              onChange={(event) => setScanCode(event.target.value)}
              placeholder="请粘贴扫码结果或输入工单二维码内容"
              className="min-h-20 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
            <button
              type="button"
              className="w-full rounded-lg bg-zinc-900 py-2 text-sm font-medium text-white"
              onClick={() => {
                void resolveWorkOrderByCode();
              }}
            >
              识别工单
            </button>
            <p className="text-xs text-zinc-500">未检测到扫码参数，可手动输入图纸ID。</p>
            <input
              value={manualDrawingId}
              onChange={(event) => setManualDrawingId(event.target.value)}
              placeholder="请输入 drawingId"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
            <button
              type="button"
              className="w-full rounded-lg bg-zinc-900 py-2 text-sm font-medium text-white"
              onClick={() => {
                if (manualDrawingId.trim()) {
                  window.location.href = `?drawingId=${encodeURIComponent(manualDrawingId.trim())}`;
                }
              }}
            >
              载入图纸
            </button>
          </div>
        ) : null}

        {loading ? <p className="text-sm text-zinc-500">加载中...</p> : null}
        {drawing ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm">
              <p>图纸：{drawing.drawingNo}</p>
              <p>状态：{drawing.status}</p>
              <p>
                当前工序：{drawing.currentOperation ? `#${drawing.currentOperation.sequence} ${drawing.currentOperation.name}` : "-"}
              </p>
              <p>当前权限：{drawing.canReportCurrentOperation ? "可报工" : "无权限，请联系管理员授权"}</p>
              <p>当前工序授权人数：{drawing.authorizedWorkerCount}</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600">
              {drawing.operations.map((op) => (
                <p key={op.id}>
                  [{op.sequence}] {op.name} - {op.status} ({op.goodQty} 良品 / {op.scrapQty} 不良)
                </p>
              ))}
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={submitStart}
                disabled={submitting || !drawing.currentOperation || !drawing.canReportCurrentOperation}
                className="w-full rounded-xl bg-blue-600 px-4 py-3 text-base font-semibold text-white disabled:opacity-50"
              >
                开工
              </button>
              <div className="rounded-xl border border-zinc-200 p-3">
                <label className="mb-1 block text-sm text-zinc-600">
                  本次报工数量（上限 {drawing.currentOperation?.maxGoodCanReport ?? 0}）
                </label>
                <input
                  type="number"
                  min={1}
                  value={reportQty}
                  onChange={(event) => setReportQty(event.target.value)}
                  className="mb-3 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                />
                <label className="mb-1 block text-sm text-zinc-600">报废数量（其余自动计入合格）</label>
                <input
                  type="number"
                  min={0}
                  value={scrapQty}
                  onChange={(event) => setScrapQty(event.target.value)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                />
                <label className="mb-1 mt-3 block text-sm text-zinc-600">照片外链（每行一个，可空）</label>
                <textarea
                  value={photoLinks}
                  onChange={(event) => setPhotoLinks(event.target.value)}
                  placeholder={"https://oss.example.com/a.jpg\nhttps://oss.example.com/b.jpg"}
                  className="min-h-20 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                />
              </div>
              <button
                type="button"
                onClick={submitReport}
                disabled={submitting || !drawing.currentOperation || !drawing.canReportCurrentOperation}
                className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-base font-semibold text-white disabled:opacity-50"
              >
                完工转下工序
              </button>
              <button
                type="button"
                onClick={() => submitOutsource("SEND")}
                disabled={submitting || drawing.status === "OUTSOURCING" || !drawing.canReportCurrentOperation}
                className="w-full rounded-xl bg-amber-500 px-4 py-3 text-base font-semibold text-white disabled:opacity-50"
              >
                委外发出
              </button>
              <button
                type="button"
                onClick={() => submitOutsource("RETURN")}
                disabled={submitting || drawing.status !== "OUTSOURCING" || !drawing.canReportCurrentOperation}
                className="w-full rounded-xl bg-violet-600 px-4 py-3 text-base font-semibold text-white disabled:opacity-50"
              >
                委外回厂
              </button>
            </div>
          </div>
        ) : null}

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
        {countdown !== null ? <p className="text-xs text-zinc-500">{countdown} 秒后自动关闭页面...</p> : null}
      </section>
    </main>
  );
}
