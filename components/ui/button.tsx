import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "default" | "outline";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

export function Button({ className = "", variant = "default", ...props }: ButtonProps) {
  const base =
    "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60";
  const style =
    variant === "outline"
      ? "border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-100"
      : "bg-zinc-900 text-white hover:bg-zinc-800";

  return <button className={`${base} ${style} ${className}`} {...props} />;
}
