import type { ComponentType, InputHTMLAttributes, ReactNode } from "react";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import logo from "@/assets/logo-marketku.png.asset.json";
import { BottomNav } from "./shell";

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative mx-auto min-h-screen max-w-md overflow-hidden bg-background">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-accent to-transparent" />
        <div className="absolute -left-40 top-1/3 h-[34rem] w-[34rem] rounded-full border border-primary/15" />
        <div className="absolute -right-48 top-1/4 h-[38rem] w-[38rem] rounded-full border border-primary-glow/25" />
      </div>
      <main className="relative flex min-h-screen flex-col justify-center px-4 pb-28 pt-8">{children}</main>
      <BottomNav />
    </div>
  );
}

export function AuthCard({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border bg-card px-4 pb-6 pt-5 shadow-xl shadow-primary/5">
      <div className="flex justify-center border-b pb-3.5">
        <img src={logo.url} alt="Marketku" className="h-7 w-auto dark:rounded-md dark:bg-foreground dark:px-1.5 dark:py-0.5" />
      </div>
      <div className="pt-4">{children}</div>
    </div>
  );
}

export function AuthTitle({ title, desc }: { title: string; desc?: string }) {
  return (
    <div className="mb-4 text-center">
      <h1 className="text-[19px] font-bold leading-tight">{title}</h1>
      {desc && <p className="mt-1 text-[12.5px] text-muted-foreground">{desc}</p>}
    </div>
  );
}

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string | undefined;
  icon: ComponentType<{ className?: string }>;
  hint?: ReactNode | undefined;
  status?: "error" | "ok" | undefined;
  message?: string | undefined;
  password?: boolean;
};

export function Field({ label, icon: Icon, hint, status, message, password, id, ...rest }: FieldProps) {
  const [show, setShow] = useState(false);
  const inputId = id ?? rest.name;
  return (
    <div className="space-y-1.5">
      {label && <label htmlFor={inputId} className="block text-[12.5px] font-semibold">{label}</label>}
      <div className="flex items-center gap-2.5 rounded-lg border border-input bg-card px-3 py-2.5 transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
        <Icon className="h-4 w-4 shrink-0 text-primary" />
        <input
          id={inputId}
          {...rest}
          type={password ? (show ? "text" : "password") : rest.type}
          className="min-w-0 flex-1 bg-transparent text-[14px] leading-5 outline-none placeholder:text-muted-foreground"
        />
        {password && (
          <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Sembunyikan password" : "Lihat password"} className="text-muted-foreground">
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
      {message && <p className={`text-xs ${status === "error" ? "text-destructive" : "text-success"}`}>{message}</p>}
      {hint && <p className="text-xs leading-relaxed text-foreground/80">{hint}</p>}
    </div>
  );
}

export function GradientButton({ children, disabled, onClick, type = "button" }: { children: ReactNode; disabled?: boolean | undefined; onClick?: (() => void) | undefined; type?: "button" | "submit" }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary-glow py-2.5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition active:scale-[0.98] disabled:opacity-55 disabled:shadow-none"
    >
      {children}
    </button>
  );
}

export function OutlineButton({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center justify-center gap-2 rounded-xl border bg-card py-2.5 text-[13px] font-semibold [&_svg]:h-4 [&_svg]:w-4 transition active:scale-[0.98]">
      {children}
    </button>
  );
}

export function AuthFooter({ children }: { children: ReactNode }) {
  return <div className="mt-5 border-t pt-4 text-center text-[13px]">{children}</div>;
}

export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
