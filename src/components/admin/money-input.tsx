import { maskMoneyInput } from "@/lib/money-input";
import { cn } from "@/lib/utils";

// Campo "R$" com máscara: digita números, a vírgula aparece sozinha.
export function MoneyInput({
  value,
  onChange,
  compact = false,
  allowNegative = false,
  placeholder = "0,00",
  className,
  "aria-label": ariaLabel,
}: {
  /** Classes extras da moldura (fundo/borda da tela onde o campo está). */
  className?: string;
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
  /** Aceita valor negativo: digitar "-" liga/desliga o sinal. */
  allowNegative?: boolean;
  placeholder?: string;
  "aria-label"?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-center rounded-md border border-border bg-surface focus-within:border-foreground/40",
        compact ? "pl-2" : "pl-3",
        className,
      )}
    >
      {/* Compacto (tabela de variações): no celular o "R$" não cabe; a coluna já diz "Preço". */}
      <span
        className={cn(
          "text-muted-foreground",
          compact ? "hidden text-[12px] sm:inline" : "text-[13px]",
        )}
      >
        R$
      </span>
      <input
        // Teclado numérico do celular não tem "-": com sinal, usa o teclado comum.
        inputMode={allowNegative ? "text" : "numeric"}
        autoComplete="off"
        value={value}
        onChange={(event) => onChange(maskMoneyInput(event.target.value, allowNegative))}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={cn(
          "w-full min-w-0 bg-transparent outline-none placeholder:text-muted-foreground",
          compact ? "px-1.5 py-1.5 text-[13px]" : "px-2 py-2.5 text-[14px]",
        )}
      />
    </div>
  );
}
