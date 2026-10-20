import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { closeCustomerAuth, useCustomerAuthDialog } from "@/lib/customer-auth-dialog";
import { useStorefront } from "@/lib/storefront-context";
import { storefrontThemeStyle } from "@/lib/storefront-theme";
import { CustomerAuthForm } from "./customer-auth-form";

// Janela de entrar/criar conta (catálogo lote 5, §9). No celular sobe do rodapé ocupando a largura;
// no computador fica centralizada. Fecha no X, no Esc e ao tocar fora.
export function CustomerAuthDialog() {
  const store = useStorefront();
  const { open, mode } = useCustomerAuthDialog();
  const style = storefrontThemeStyle(store.catalog_visual);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => !next && closeCustomerAuth()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          style={style}
          aria-describedby={undefined}
          className="storefront-theme storefront-typography fixed inset-x-0 bottom-0 z-50 max-h-[92svh] overflow-y-auto bg-white p-6 pb-8 shadow-2xl outline-none data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom md:inset-x-auto md:bottom-auto md:left-1/2 md:top-1/2 md:w-[420px] md:-translate-x-1/2 md:-translate-y-1/2 md:p-8 md:data-[state=open]:slide-in-from-bottom-0 md:data-[state=open]:fade-in-0"
        >
          <DialogPrimitive.Title className="sr-only">Conta na {store.name}</DialogPrimitive.Title>
          <DialogPrimitive.Close
            aria-label="Fechar"
            className="absolute right-3 top-3 grid h-11 w-11 place-items-center text-neutral-500 hover:text-black"
          >
            <X className="h-5 w-5" strokeWidth={1.7} />
          </DialogPrimitive.Close>
          <div className="text-[11px] font-medium uppercase tracking-[0.24em] text-neutral-500">
            {store.name}
          </div>
          <div className="mt-2">
            <CustomerAuthForm initialMode={mode} onDone={closeCustomerAuth} />
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
