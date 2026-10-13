import { createFileRoute } from "@tanstack/react-router";
import { CategoryProductsPage } from "@/components/loja/category-products-page";
import { listingSearchSchema } from "@/lib/product-listing";

export const Route = createFileRoute("/loja/$slug/categoria/$categorySlug/$childSlug")({
  validateSearch: (s) => listingSearchSchema.parse(s),
  component: SubcategoriaPage,
});

function SubcategoriaPage() {
  const { categorySlug, childSlug } = Route.useParams();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <CategoryProductsPage
      categorySlug={categorySlug}
      childSlug={childSlug}
      search={search}
      onSearchChange={(patch) =>
        navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true })
      }
    />
  );
}
