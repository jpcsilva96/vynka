import { Banknote, CreditCard, Link2, QrCode } from "lucide-react";
import type { PaymentMethod } from "@/lib/sales";
import { cn } from "@/lib/utils";

export function PaymentMethodIcon({
  method,
  className,
}: {
  method: PaymentMethod | string | null | undefined;
  className?: string;
}) {
  const iconClass = cn("h-4 w-4 shrink-0 text-muted-foreground", className);

  if (method === "cash") return <Banknote className={iconClass} strokeWidth={1.5} />;
  if (method === "pix") return <QrCode className={iconClass} strokeWidth={1.5} />;
  if (method === "payment_link") return <Link2 className={iconClass} strokeWidth={1.5} />;
  return <CreditCard className={iconClass} strokeWidth={1.5} />;
}
