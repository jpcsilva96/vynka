import { cn } from "@/lib/utils";

interface VynkaLogoProps {
  className?: string;
  variant?: "light" | "dark";
}

/**
 * VYNKA wordmark. Wide-tracked geometric sans, with a reversed final "A"
 * rendered as an inverted chevron to echo the brand mark.
 */
export function VynkaLogo({ className, variant = "light" }: VynkaLogoProps) {
  return (
    <span
      aria-label="VYNKA"
      className={cn(
        "vynka-wordmark inline-flex select-none items-center text-[15px] leading-none",
        variant === "light" ? "text-foreground" : "text-white",
        className,
      )}
    >
      <span>VYN</span>
      <span aria-hidden="true" className="inline-block" style={{ transform: "scaleX(-1)" }}>
        K
      </span>
      <span aria-hidden="true" className="inline-block ml-[0.35em]" style={{ transform: "scaleX(-1)" }}>
        A
      </span>
    </span>
  );
}
