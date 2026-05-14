import type { ButtonHTMLAttributes, ReactNode } from "react";

const variantClasses = {
  primary:
    "bg-cyan-600 text-white shadow-lg shadow-cyan-600/20 hover:bg-cyan-700",
  secondary:
    "border border-slate-200 bg-white text-slate-700 hover:border-cyan-200 hover:bg-cyan-50",
  ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: keyof typeof variantClasses;
};

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold transition focus:outline-none focus:ring-4 focus:ring-cyan-100 disabled:cursor-not-allowed disabled:opacity-60 ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
