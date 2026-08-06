import { createFileRoute } from "@tanstack/react-router";
import { CategoryProductsPage } from "@/components/loja/category-products-page";

export const Route = createFileRoute("/loja/$slug/categoria/$categorySlug")({
  component: CategoriaPage,
});

function CategoriaPage() {
  const { categorySlug } = Route.useParams();
  return <CategoryProductsPage categorySlug={categorySlug} />;
}
