import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// Peças das páginas da Minha conta (catálogo lote 5): campo, título e botões no mesmo padrão.

export function AccountTitle({ title, description }: { title: string; description?: string }) {
  return (
    <div>
      <h2 className="text-2xl font-semibold text-black">{title}</h2>
      {description && <p className="mt-1 text-[13px] text-neutral-500">{description}</p>}
    </div>
  );
}

export function AccountField({
  label,
  value,
  onChange,
  type = "text",
  inputMode,
  autoComplete,
  hint,
  disabled = false,
  required = false,
  maxLength,
  className,
}: {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  type?: string;
  inputMode?: "numeric" | "tel" | "email";
  autoComplete?: string;
  hint?: ReactNode;
  disabled?: boolean;
  required?: boolean;
  maxLength?: number;
  className?: string;
}) {
  return (
    <label className={cn("grid min-w-0 gap-2", className)}>
      <span className="text-[12px] font-medium uppercase tracking-[0.14em] text-neutral-500">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        inputMode={inputMode}
        autoComplete={autoComplete}
        disabled={disabled}
        required={required}
        maxLength={maxLength}
        className="h-12 w-full min-w-0 border border-black/10 px-3 text-[16px] outline-none focus:border-black md:h-11 md:text-[14px]"
      />
      {hint && (
        <span className="text-[12px] text-neutral-500" aria-live="polite">
          {hint}
        </span>
      )}
    </label>
  );
}

export function PrimaryButton({
  children,
  busy,
  type = "submit",
  onClick,
}: {
  children: ReactNode;
  busy?: boolean;
  type?: "submit" | "button";
  onClick?: () => void;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={busy}
      className="h-12 w-full bg-black px-6 text-[12px] font-semibold uppercase tracking-[0.16em] text-white hover:bg-neutral-800 disabled:opacity-50 sm:w-max"
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  onClick,
  className,
}: {
  children: ReactNode;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-12 border border-black px-5 text-[12px] font-semibold uppercase tracking-[0.16em] text-black hover:bg-black hover:text-white sm:h-11",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function StatusMessage({ text, error = false }: { text: string; error?: boolean }) {
  if (!text) return null;
  return (
    <p
      role={error ? "alert" : "status"}
      className={cn("text-[13px]", error ? "text-red-700" : "text-neutral-600")}
    >
      {text}
    </p>
  );
}
