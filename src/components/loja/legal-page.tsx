import type { ReactNode } from "react";
import { formatPhone } from "@/lib/br-documents";
import { storeIdentity, type LegalPolicies } from "@/lib/legal-policies";
import { useStorefront } from "@/lib/storefront-context";

export interface LegalSection {
  title: string;
  body: ReactNode;
}

// Moldura das páginas legais (escopo paginas-legais.md, §3): título, seções do modelo, observações da
// loja (texto livre) e a identificação de quem vende (Decreto 7.962/2013).
export function LegalPage({
  title,
  sections,
  extra,
  policies,
}: {
  title: string;
  sections: LegalSection[];
  extra: string;
  policies: LegalPolicies | undefined;
}) {
  const store = useStorefront();
  const identity = storeIdentity(store);
  const updated = policies?.updated_at
    ? new Date(policies.updated_at).toLocaleDateString("pt-BR")
    : null;

  return (
    <section className="border-b border-black/10 px-4 py-10 md:px-8 md:py-16">
      <div className="mx-auto max-w-3xl">
        <div className="text-[11px] font-medium uppercase tracking-[0.24em] text-neutral-500">
          {store.name}
        </div>
        <h1 className="mt-2 font-semibold leading-tight text-black">{title}</h1>

        <div className="mt-8 grid gap-8">
          {sections.map((section) => (
            <div key={section.title}>
              <h2 className="font-semibold text-black">{section.title}</h2>
              <div className="mt-2 grid gap-2 text-[15px] leading-relaxed text-neutral-600">
                {section.body}
              </div>
            </div>
          ))}
          {extra.trim() && (
            <div>
              <h2 className="font-semibold text-black">Observações da loja</h2>
              <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-neutral-600">
                {extra.trim()}
              </p>
            </div>
          )}
        </div>

        <div className="mt-10 border border-black/10 bg-neutral-50 px-5 py-4 text-[13px] leading-relaxed text-neutral-600">
          <div className="font-semibold text-black">Quem vende</div>
          <div>{identity.name}</div>
          {identity.document && <div>{identity.document}</div>}
          {identity.address && <div>{identity.address}</div>}
          {store.whatsapp && <div>WhatsApp {formatPhone(store.whatsapp)}</div>}
          {store.email && <div className="break-all">{store.email}</div>}
          {updated && <div className="mt-2 text-[12px]">Atualizada em {updated}</div>}
        </div>
      </div>
    </section>
  );
}
