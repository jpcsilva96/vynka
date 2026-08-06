import { Link } from "@tanstack/react-router";
import { Minus, Plus, ShoppingBag, X } from "lucide-react";
import { useEffect } from "react";
import { closeCart, removeItem, updateQty, useCart, useCartDrawer, useCartTotals } from "@/lib/cart";
import { formatBRL } from "@/lib/products";
import { useStorefront } from "@/lib/storefront-context";
import { cn } from "@/lib/utils";

export function CartDrawer() {
  const store = useStorefront();
  const open = useCartDrawer();
  const items = useCart();
  const { subtotal, count } = useCartTotals();

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <div
        onClick={closeCart}
        className={cn("fixed inset-0 z-50 bg-black/30 transition-opacity", open ? "opacity-100" : "pointer-events-none opacity-0")}
      />
      <aside
        className={cn(
          "fixed right-0 top-0 z-50 flex h-svh w-full max-w-[440px] flex-col bg-white shadow-2xl transition-transform duration-300",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <header className="flex items-center justify-between border-b border-black/10 px-5 py-5">
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-[0.2em] text-black">Carrinho</div>
            <div className="mt-1 text-[12px] text-neutral-500">{count} item{count === 1 ? "" : "s"}</div>
          </div>
          <button onClick={closeCart} className="grid h-10 w-10 place-items-center rounded-full hover:bg-neutral-100" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </header>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-neutral-100">
              <ShoppingBag className="h-5 w-5 text-neutral-500" />
            </div>
            <div className="mt-5 text-[18px] font-semibold text-black">Seu carrinho esta vazio</div>
            <p className="mt-2 text-[13px] text-neutral-500">Adicione produtos para finalizar a compra.</p>
            <button onClick={closeCart} className="mt-6 border border-black bg-black px-6 py-3 text-[12px] font-semibold uppercase tracking-[0.16em] text-white hover:bg-white hover:text-black">
              Continuar comprando
            </button>
          </div>
        ) : (
          <>
            <div className="flex-1 divide-y divide-black/10 overflow-y-auto">
              {items.map((item) => (
                <div key={item.key} className="grid grid-cols-[76px_1fr] gap-4 px-5 py-5">
                  <div className="aspect-[4/5] overflow-hidden bg-neutral-100">
                    {item.image && <img src={item.image} alt="" className="h-full w-full object-cover" />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="line-clamp-2 text-[13px] font-medium text-black">{item.name}</div>
                        {item.variantLabel && <div className="mt-1 text-[12px] text-neutral-500">{item.variantLabel}</div>}
                      </div>
                      <button onClick={() => removeItem(item.key)} className="text-[11px] uppercase tracking-[0.12em] text-neutral-500 hover:text-black">
                        Remover
                      </button>
                    </div>
                    <div className="mt-4 flex items-center justify-between">
                      <div className="inline-flex items-center border border-black/10">
                        <button onClick={() => updateQty(item.key, item.quantity - 1)} className="grid h-8 w-8 place-items-center hover:bg-neutral-100" aria-label="Diminuir">
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-7 text-center text-[12px]">{item.quantity}</span>
                        <button onClick={() => updateQty(item.key, item.quantity + 1)} className="grid h-8 w-8 place-items-center hover:bg-neutral-100" aria-label="Aumentar">
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="text-[13px] font-semibold text-black">{formatBRL(item.price * item.quantity)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <footer className="border-t border-black/10 px-5 py-5">
              <div className="flex items-center justify-between">
                <span className="text-[12px] uppercase tracking-[0.18em] text-neutral-500">Subtotal</span>
                <span className="text-[18px] font-semibold text-black">{formatBRL(subtotal)}</span>
              </div>
              <Link
                to="/loja/$slug/checkout"
                params={{ slug: store.slug }}
                onClick={closeCart}
                className="mt-5 flex w-full items-center justify-center border border-black bg-black px-5 py-3.5 text-[12px] font-semibold uppercase tracking-[0.18em] text-white hover:bg-white hover:text-black"
              >
                Finalizar compra
              </Link>
            </footer>
          </>
        )}
      </aside>
    </>
  );
}
