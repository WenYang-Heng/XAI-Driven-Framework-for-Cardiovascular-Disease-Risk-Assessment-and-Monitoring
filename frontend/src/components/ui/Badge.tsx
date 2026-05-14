import type { HTMLAttributes, ReactNode } from "react";

const toneClasses = {
  cyan: "bg-cyan-50 text-cyan-700 ring-cyan-100",
  purple: "bg-purple-50 text-purple-700 ring-purple-100",
  red: "bg-red-50 text-red-700 ring-red-100",
  amber: "bg-amber-50 text-amber-700 ring-amber-100",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
};

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  children: ReactNode;
  tone?: keyof typeof toneClasses;
};

export function Badge({
  children,
  tone = "slate",
  className = "",
  ...props
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ${toneClasses[tone]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}
