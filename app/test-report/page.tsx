"use client";

import { useEffect, useMemo, useState } from "react";

type DebugState = {
  lockVersion: number;
  reportedQty: number;
  acceptedGoodQty: number;
  scrapQty: number;
  effectiveGoodQty: number;
  updatedAt: string;
};

const DEFAULT_OPERATION_ID = "cmn8f7tsq0004kktp3nofycqj";

function makeKey(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function TestReportPage() {
  const [operationId, setOperationId] = useState(DEFAULT_OPERATION_ID);
  const [goodQty, setGoodQty] = useState("10");
  const [scrapQty, setScrapQty] = useState("0");
  const [idempotencyKey, setIdempotencyKey] = useState(makeKey("single"));
  const [expectedLockVersion, setExpectedLockVersion] = useState<number | "">("");
  const [state, setState] = useState<DebugState | null>(null);
  const [result, setResult] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const parsedGood = useMemo(() => Number(goodQty), [goodQty]);
  const parsedScrap = useMemo(() => Number(scrapQty), [scrapQty]);

  async function loadState() {
    const response = await fetch("/api/test-debug/report", { cache: "no-store" });
    const data = (await response.json()) as { state?: DebugState };
    setState(data.state ?? null);
    if (data.state) {
      setExpectedLockVersion(data.state.lockVersion);
    }
  }

  useEffect(() => {
    void loadState();
  }, []);

  async function submitOnce() {
    setLoading(true);
    setResult("");
    try {
      const response = await fetch("/api/test-debug/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operationId,
          goodQty: parsedGood,
          scrapQty: parsedScrap,
          idempotencyKey,
          expectedLockVersion: expectedLockVersion === "" ? undefined : expectedLockVersion,
        }),
      });
      const data = await response.json();
      setResult(JSON.stringify({ status: response.status, data }, null, 2));
      await loadState();
    } finally {
      setLoading(false);
    }
  }

  async function runConcurrentTest() {
    setLoading(true);
    setResult("");
    try {
      const response = await fetch("/api/test-debug/report", { cache: "no-store" });
      const snapshot = (await response.json()) as { state?: DebugState };
      const lockVersion = snapshot.state?.lockVersion ?? 0;

      const payloadA = {
        operationId,
        goodQty: parsedGood,
        scrapQty: parsedScrap,
        idempotencyKey: makeKey("race-a"),
        expectedLockVersion: lockVersion,
      };
      const payloadB = {
        operationId,
        goodQty: parsedGood,
        scrapQty: parsedScrap,
        idempotencyKey: makeKey("race-b"),
        expectedLockVersion: lockVersion,
      };

      const [a, b] = await Promise.all([
        fetch("/api/test-debug/report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payloadA),
        }),
        fetch("/api/test-debug/report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payloadB),
        }),
      ]);

      const [dataA, dataB] = await Promise.all([a.json(), b.json()]);
      setResult(
        JSON.stringify(
          {
            lockVersionUsed: lockVersion,
            requestA: { status: a.status, data: dataA },
            requestB: { status: b.status, data: dataB },
          },
          null,
          2,
        ),
      );
      await loadState();
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-50 p-6">
      <section className="mx-auto w-full max-w-3xl rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm space-y-5">
        <h1 className="text-2xl font-semibold text-zinc-900">报工事务调试页</h1>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm text-zinc-700">
            Operation ID
            <input
              value={operationId}
              onChange={(event) => setOperationId(event.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm text-zinc-700">
            Idempotency Key
            <input
              value={idempotencyKey}
              onChange={(event) => setIdempotencyKey(event.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm text-zinc-700">
            Good Qty
            <input
              value={goodQty}
              onChange={(event) => setGoodQty(event.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm text-zinc-700">
            Scrap Qty
            <input
              value={scrapQty}
              onChange={(event) => setScrapQty(event.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm text-zinc-700">
            Expected Lock Version
            <input
              value={expectedLockVersion}
              onChange={(event) =>
                setExpectedLockVersion(event.target.value === "" ? "" : Number(event.target.value))
              }
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={submitOnce}
            disabled={loading}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
          >
            单次报工
          </button>
          <button
            type="button"
            onClick={runConcurrentTest}
            disabled={loading}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800"
          >
            并发测试
          </button>
          <button
            type="button"
            onClick={loadState}
            disabled={loading}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800"
          >
            刷新状态
          </button>
          <button
            type="button"
            onClick={() => setIdempotencyKey(makeKey("single"))}
            disabled={loading}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800"
          >
            新幂等键
          </button>
        </div>

        <div className="rounded-lg bg-zinc-100 p-3 text-sm text-zinc-700">
          <p>当前快照: {state ? `lock=${state.lockVersion}, good=${state.acceptedGoodQty}, scrap=${state.scrapQty}, effective=${state.effectiveGoodQty}` : "未加载"}</p>
        </div>

        <pre className="overflow-auto rounded-lg bg-zinc-900 p-4 text-xs text-zinc-100">
          {result || "等待操作..."}
        </pre>
      </section>
    </main>
  );
}
