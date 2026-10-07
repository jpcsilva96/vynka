import type { ReactNode } from "react";
import { AppHeader } from "@/components/app-header";

interface PageShellProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function PageShell({ title, description, actions, children }: PageShellProps) {
  return (
    <div className="flex min-h-svh min-w-0 flex-1 flex-col bg-background">
      <AppHeader title={title} description={description} />
      <main className="flex-1 px-6 py-8 md:px-10 md:py-12">
        <div className="mx-auto w-full max-w-6xl">
          {actions ? (
            <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
              <div />
              <div className="flex items-center gap-2">{actions}</div>
            </div>
          ) : null}
          {children}
        </div>
      </main>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center rounded-lg border border-dashed border-border bg-surface/40 px-6 py-16 text-center">
      <div className="mb-5 grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground">
        {icon}
      </div>
      <h3 className="text-[15px] font-medium text-foreground">{title}</h3>
      <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
  );
}
