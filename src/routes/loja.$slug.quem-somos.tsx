import { createFileRoute, notFound } from "@tanstack/react-router";
import { useStorefront } from "@/lib/storefront-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/loja/$slug/quem-somos")({
  component: AboutStorePage,
});

function AboutStorePage() {
  const store = useStorefront();
  const visual = store.catalog_visual;

  if (!visual.about_enabled) throw notFound();

  return (
    <section
      className="min-h-[calc(100svh-8rem)] border-b border-black/10 px-5 py-14 md:px-8 md:py-20"
      style={{ backgroundColor: visual.background_color }}
    >
      <div className="mx-auto max-w-[1180px]">
        <h1 className="text-center text-4xl font-semibold leading-tight text-[var(--shop-primary)] md:text-5xl">
          {visual.about_title || "Quem somos"}
        </h1>

        <div
          className={cn(
            "mt-10 items-center gap-10 md:mt-12 lg:gap-16",
            visual.about_image_url ? "grid md:grid-cols-2" : "mx-auto max-w-3xl",
          )}
        >
          {visual.about_image_url && (
            <div className="aspect-[4/3] overflow-hidden rounded-md bg-black/5 shadow-sm">
              <img
                src={visual.about_image_url}
                alt={visual.about_title || `Sobre ${store.name}`}
                className="h-full w-full object-cover"
              />
            </div>
          )}

          <div
            className={cn(
              "whitespace-pre-line text-[16px] leading-8 text-[var(--shop-secondary)] md:text-[18px]",
              visual.about_image_url ? "mt-8 md:mt-0" : "text-center",
            )}
          >
            {visual.about_description || `Conheça a história e o propósito da ${store.name}.`}
          </div>
        </div>
      </div>
    </section>
  );
}
