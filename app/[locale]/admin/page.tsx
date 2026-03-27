export default function AdminHomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 p-6">
      <section className="w-full max-w-3xl rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-zinc-900">管理员工作台</h1>
        <p className="mt-2 text-sm text-zinc-600">
          这里将承载看板、图纸管理、工艺路线、外协与报表等管理功能。
        </p>
      </section>
    </main>
  );
}
