import { createFileRoute } from "@tanstack/react-router";
import { HighlightProductsPage } from "@/components/loja/highlight-products-page";
import { listingSearchSchema } from "@/lib/product-listing";

export const Route = createFileRoute("/loja/$slug/novidades")({
  validateSearch: (s) => listingSearchSchema.parse(s),
  component: NovidadesPage,
});

function NovidadesPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <HighlightProductsPage
      kind="novidades"
      search={search}
      onSearchChange={(patch) =>
        navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true })
      }
    />
  );
}
