"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type AuthMethod = "phone" | "email";

export default function LoginPage() {
  const router = useRouter();
  const [method, setMethod] = useState<AuthMethod>("phone");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const target = method === "phone" ? phone.trim() : email.trim();

  async function handleSendCode() {
    if (!target) {
      setError(method === "phone" ? "请先输入手机号" : "请先输入邮箱");
      setMessage("");
      return;
    }

    setSending(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          method === "phone"
            ? { method, phone: target }
            : { method, email: target.toLowerCase() },
        ),
      });

      const data = (await response.json()) as { error?: string; devOnlyCode?: string };

      if (!response.ok) {
        setError(data.error ?? "发送验证码失败，请稍后重试");
        return;
      }

      setMessage(
        data.devOnlyCode
          ? `验证码已发送（开发环境验证码：${data.devOnlyCode}）`
          : "验证码已发送",
      );
    } catch {
      setError("网络异常，请检查后重试");
    } finally {
      setSending(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!target) {
      setError(method === "phone" ? "请先输入手机号" : "请先输入邮箱");
      setMessage("");
      return;
    }

    if (!code.trim()) {
      setError("请输入验证码");
      setMessage("");
      return;
    }

    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/auth/verify-code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          method === "phone"
            ? { method, phone: target, code: code.trim() }
            : { method, email: target.toLowerCase(), code: code.trim() },
        ),
      });

      const data = (await response.json()) as { error?: string; message?: string };
      const authData = data as {
        error?: string;
        message?: string;
        user?: { role?: "OWNER" | "ADMIN" | "WORKER" | "OBSERVER" | "QC" | "OUTSOURCE" };
      };

      if (!response.ok) {
        setError(authData.error ?? "校验失败，请稍后重试");
        return;
      }

      const isAdmin = authData.user?.role === "OWNER" || authData.user?.role === "ADMIN";
      const roleText = isAdmin ? "管理员" : "工人";
      setMessage(`${authData.message ?? "验证码校验成功"}，当前身份：${roleText}`);
      router.push(isAdmin ? "/zh/admin" : "/zh/worker");
      router.refresh();
    } catch {
      setError("网络异常，请检查后重试");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-zinc-900">欢迎使用小单快报</h1>
          <p className="text-sm text-zinc-500">访客可任选手机号或邮箱验证码进行注册/登录</p>
        </div>

        <div className="mt-6 grid grid-cols-2 rounded-xl bg-zinc-100 p-1">
          <button
            type="button"
            onClick={() => {
              setMethod("phone");
              setError("");
              setMessage("");
            }}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              method === "phone"
                ? "bg-white text-zinc-900 shadow-sm"
                : "text-zinc-500 hover:text-zinc-700"
            }`}
          >
            手机号 + 验证码
          </button>
          <button
            type="button"
            onClick={() => {
              setMethod("email");
              setError("");
              setMessage("");
            }}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              method === "email"
                ? "bg-white text-zinc-900 shadow-sm"
                : "text-zinc-500 hover:text-zinc-700"
            }`}
          >
            邮箱 + 验证码
          </button>
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          {method === "phone" ? (
            <div className="space-y-2">
              <label htmlFor="phone" className="block text-sm font-medium text-zinc-700">
                手机号
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                placeholder="请输入手机号"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                className="w-full rounded-xl border border-zinc-300 px-4 py-2.5 text-sm outline-none ring-0 transition focus:border-zinc-400"
              />
            </div>
          ) : (
            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-medium text-zinc-700">
                邮箱
              </label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="请输入邮箱"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-xl border border-zinc-300 px-4 py-2.5 text-sm outline-none ring-0 transition focus:border-zinc-400"
              />
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="code" className="block text-sm font-medium text-zinc-700">
              验证码
            </label>
            <div className="flex gap-2">
              <input
                id="code"
                name="code"
                type="text"
                placeholder="请输入验证码"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                className="min-w-0 flex-1 rounded-xl border border-zinc-300 px-4 py-2.5 text-sm outline-none ring-0 transition focus:border-zinc-400"
              />
              <button
                type="button"
                onClick={handleSendCode}
                disabled={sending}
                className="shrink-0 rounded-xl border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100"
              >
                {sending ? "发送中..." : "发送验证码"}
              </button>
            </div>
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {message ? <p className="text-sm text-emerald-600">{message}</p> : null}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800"
          >
            {submitting ? "提交中..." : "立即进入"}
          </button>
        </form>
      </section>
    </main>
  );
}
