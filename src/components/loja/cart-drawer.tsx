import { X, Minus, Plus, ShoppingBag } from "lucide-react";
import { useEffect } from "react";
import {
  buildWhatsAppLink,
  cartWhatsAppText,
  closeCart,
  removeItem,
  updateQty,
  useCart,
  useCartDrawer,
  useCartTotals,
} from "@/lib/cart";
import { formatBRL } from "@/lib/products";
import { WhatsAppIcon } from "./store-header";
import { cn } from "@/lib/utils";

export function CartDrawer() {
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
      {/* Backdrop */}
      <div
        onClick={closeCart}
        className={cn(
          "fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px] transition-opacity duration-300",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      {/* Panel */}
      <aside
        className={cn(
          "fixed right-0 top-0 z-50 flex h-svh w-full max-w-[440px] flex-col bg-white shadow-2xl transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "translate-x-full",
        )}
        aria-hidden={!open}
      >
        <header className="flex items-center justify-between border-b border-black/[0.06] px-6 py-5">
          <div className="text-[11px] font-medium uppercase tracking-[0.24em] text-neutral-900">
            Sacola {count > 0 && <span className="text-neutral-500">({count})</span>}
          </div>
          <button
            onClick={closeCart}
            aria-label="Fechar"
            className="grid h-9 w-9 place-items-center rounded-full text-neutral-700 hover:bg-neutral-100"
          >
            <X className="h-4 w-4" strokeWidth={1.4} />
          </button>
        </header>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-neutral-100">
              <ShoppingBag className="h-5 w-5 text-neutral-500" strokeWidth={1.4} />
            </div>
            <div>
              <div className="font-serif text-[22px] font-light text-neutral-900">
                Sua sacola está vazia
              </div>
              <p className="mt-1 text-[13px] text-neutral-500">
                Explore a coleção e adicione seus favoritos.
              </p>
            </div>
            <button
              onClick={closeCart}
              className="mt-2 border border-black bg-black px-6 py-3 text-[11px] font-medium uppercase tracking-[0.2em] text-white transition-colors hover:bg-white hover:text-black"
            >
              Continuar comprando
            </button>
          </div>
        ) : (
          <>
            <div className="flex-1 divide-y divide-black/[0.06] overflow-y-auto">
              {items.map((it) => (
                <div key={it.key} className="flex gap-4 px-6 py-5">
                  <div className="h-24 w-20 shrink-0 overflow-hidden bg-neutral-100">
                    {it.image && (
                      <img
                        src={it.image}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-medium text-neutral-900">
                          {it.name}
                        </div>
                        {it.variantLabel && (
                          <div className="mt-0.5 text-[12px] text-neutral-500">
                            {it.variantLabel}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => removeItem(it.key)}
                        className="text-[11px] uppercase tracking-[0.18em] text-neutral-500 hover:text-black"
                      >
                        Remover
                      </button>
                    </div>
                    <div className="mt-auto flex items-center justify-between pt-3">
                      <div className="inline-flex items-center border border-black/10">
                        <button
                          onClick={() => updateQty(it.key, it.quantity - 1)}
                          className="grid h-8 w-8 place-items-center text-neutral-700 hover:text-black"
                          aria-label="Diminuir"
                        >
                          <Minus className="h-3 w-3" strokeWidth={1.5} />
                        </button>
                        <span className="w-6 text-center text-[12px]">{it.quantity}</span>
                        <button
                          onClick={() => updateQty(it.key, it.quantity + 1)}
                          className="grid h-8 w-8 place-items-center text-neutral-700 hover:text-black"
                          aria-label="Aumentar"
                        >
                          <Plus className="h-3 w-3" strokeWidth={1.5} />
                        </button>
                      </div>
                      <div className="text-[13px] text-neutral-900">
                        {formatBRL(it.price * it.quantity)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <footer className="border-t border-black/[0.06] px-6 py-5">
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] uppercase tracking-[0.24em] text-neutral-500">
                  Subtotal
                </span>
                <span className="font-serif text-[22px] font-light text-neutral-900">
                  {formatBRL(subtotal)}
                </span>
              </div>
              <p className="mt-1 text-[12px] text-neutral-500">
                Frete e impostos calculados no checkout.
              </p>
              <div className="mt-4 grid gap-2">
                <button className="border border-black bg-black py-3.5 text-[11px] font-medium uppercase tracking-[0.24em] text-white transition-colors hover:bg-white hover:text-black">
                  Finalizar compra
                </button>
                <a
                  href={buildWhatsAppLink(cartWhatsAppText(items, subtotal))}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 border border-black/15 py-3.5 text-[11px] font-medium uppercase tracking-[0.24em] text-neutral-900 transition-colors hover:border-black"
                >
                  <WhatsAppIcon className="h-3.5 w-3.5" />
                  Comprar pelo WhatsApp
                </a>
              </div>
            </footer>
          </>
        )}
      </aside>
    </>
  );
}
