import type { HTMLAttributes } from "react";

export function Card(props: HTMLAttributes<HTMLDivElement>) {
  const { className = "", ...rest } = props;
  return <div className={`rounded-2xl border border-zinc-200 bg-white shadow-sm ${className}`} {...rest} />;
}

export function CardHeader(props: HTMLAttributes<HTMLDivElement>) {
  const { className = "", ...rest } = props;
  return <div className={`p-5 ${className}`} {...rest} />;
}

export function CardTitle(props: HTMLAttributes<HTMLHeadingElement>) {
  const { className = "", ...rest } = props;
  return <h3 className={`text-base font-semibold text-zinc-900 ${className}`} {...rest} />;
}

export function CardContent(props: HTMLAttributes<HTMLDivElement>) {
  const { className = "", ...rest } = props;
  return <div className={`px-5 pb-5 ${className}`} {...rest} />;
}
