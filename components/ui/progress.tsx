type ProgressProps = {
  value: number;
};

export function Progress({ value }: ProgressProps) {
  const safeValue = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));

  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200">
      <div className="h-full rounded-full bg-zinc-900 transition-all" style={{ width: `${safeValue}%` }} />
    </div>
  );
}
