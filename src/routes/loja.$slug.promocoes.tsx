import { createFileRoute } from "@tanstack/react-router";
import { HighlightProductsPage } from "@/components/loja/highlight-products-page";
import { listingSearchSchema } from "@/lib/product-listing";

export const Route = createFileRoute("/loja/$slug/promocoes")({
  validateSearch: (s) => listingSearchSchema.parse(s),
  component: PromocoesPage,
});

function PromocoesPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <HighlightProductsPage
      kind="promocoes"
      search={search}
      onSearchChange={(patch) =>
        navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true })
      }
    />
  );
}
