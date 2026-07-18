import { createFileRoute, Outlet } from "@tanstack/react-router";
import { StoreHeader } from "@/components/loja/store-header";
import { StoreFooter } from "@/components/loja/store-footer";
import { CartDrawer } from "@/components/loja/cart-drawer";
import { useCartHydration } from "@/lib/cart";

export const Route = createFileRoute("/loja")({
  component: LojaLayout,
});

function LojaLayout() {
  useCartHydration();
  return (
    <div className="min-h-svh bg-white font-sans text-neutral-900 antialiased">
      <StoreHeader />
      <main className="pt-16 md:pt-20">
        <Outlet />
      </main>
      <StoreFooter />
      <CartDrawer />
    </div>
  );
}
