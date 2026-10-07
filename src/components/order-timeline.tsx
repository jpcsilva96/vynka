import { Check } from "lucide-react";
import type { TimelineStep } from "@/lib/orders";

const dateTime = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

// Linha do tempo do pedido do site (etapas de websiteTimeline). Vertical, cabe no celular.
export function OrderTimeline({ steps }: { steps: TimelineStep[] }) {
  const lastDone = steps.map((step) => step.done).lastIndexOf(true);
  return (
    <ol className="relative">
      {steps.map((step, index) => {
        const last = index === steps.length - 1;
        const cancelled = step.key === "cancelled";
        return (
          <li key={step.key} className="relative flex gap-3 pb-4 last:pb-0">
            {!last && (
              <span
                aria-hidden
                className={`absolute left-[9px] top-5 h-[calc(100%-12px)] w-px ${
                  index < lastDone ? "bg-black" : "bg-black/15"
                }`}
              />
            )}
            <span
              className={`relative z-10 mt-0.5 grid h-[19px] w-[19px] shrink-0 place-items-center rounded-full border ${
                cancelled
                  ? "border-red-600 bg-red-600 text-white"
                  : step.done
                    ? "border-black bg-black text-white"
                    : "border-black/20 bg-white"
              }`}
            >
              {step.done && <Check className="h-3 w-3" strokeWidth={2.5} />}
            </span>
            <div className="min-w-0 text-[13px] leading-5">
              <div
                className={
                  cancelled
                    ? "font-medium text-red-700"
                    : step.done
                      ? index === lastDone
                        ? "font-semibold text-black"
                        : "text-black"
                      : "text-neutral-400"
                }
              >
                {step.label}
              </div>
              {step.at && step.done && (
                <div className="text-[12px] text-neutral-500">
                  {dateTime.format(new Date(step.at)).replace(",", " às")}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
