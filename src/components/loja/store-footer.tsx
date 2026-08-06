import { Link } from "@tanstack/react-router";
import { Instagram, Mail, MapPin, Phone } from "lucide-react";
import { buildWhatsAppLink } from "@/lib/cart";
import { useStorefront } from "@/lib/storefront-context";
import { WhatsAppIcon } from "./store-header";

export function StoreFooter() {
  const store = useStorefront();
  const slug = store.slug;
  const location = [store.city, store.state].filter(Boolean).join(" / ");
  const streetAddress = [
    store.address,
    store.address_number,
    store.complement,
  ].filter(Boolean).join(", ");
  const fullAddress = [streetAddress, location].filter(Boolean).join(" - ");
  const instagramHandle = store.instagram ? `@${store.instagram.replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/\/$/, "")}` : "";
  const instagram = store.instagram
    ? store.instagram.startsWith("http")
      ? store.instagram
      : `https://instagram.com/${store.instagram.replace(/^@/, "")}`
    : null;

  return (
    <footer id="contato" className="border-t border-black/10 bg-white">
      <div className="mx-auto grid max-w-[1280px] gap-10 px-4 py-12 md:grid-cols-[1.5fr_1fr_1fr] md:px-8 md:py-16">
        <div>
          <div className="text-[16px] font-semibold uppercase tracking-[0.22em] text-black">{store.name}</div>
          <p className="mt-4 max-w-md text-[13px] leading-relaxed text-neutral-600">
            {plainText(store.description) || "Catalogo online simples para consultar produtos e finalizar pelo WhatsApp."}
          </p>
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">Navegue</div>
          <div className="mt-4 grid gap-2 text-[13px] text-neutral-700">
            <Link to="/loja/$slug" params={{ slug }} className="hover:text-black">Inicio</Link>
            <Link to="/loja/$slug" params={{ slug }} hash="produtos" className="hover:text-black">Produtos</Link>
            <Link to="/loja/$slug" params={{ slug }} hash="categorias" className="hover:text-black">Categorias</Link>
          </div>
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">Contato</div>
          <div className="mt-4 grid gap-3 text-[13px] text-neutral-700">
            {store.email && (
              <a href={`mailto:${store.email}`} className="inline-flex items-center gap-2 hover:text-black">
                <Mail className="h-4 w-4" /> {store.email}
              </a>
            )}
            {store.phone && (
              <a href={`tel:${digitsOnly(store.phone)}`} className="inline-flex items-center gap-2 hover:text-black">
                <Phone className="h-4 w-4" /> {store.phone}
              </a>
            )}
            {store.whatsapp && (
              <a href={buildWhatsAppLink(`Ola ${store.name}!`, store.whatsapp)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 hover:text-black">
                <WhatsAppIcon className="h-4 w-4" /> {store.whatsapp}
              </a>
            )}
            {instagram && (
              <a href={instagram} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 hover:text-black">
                <Instagram className="h-4 w-4" /> {instagramHandle}
              </a>
            )}
            {fullAddress && (
              <span className="inline-flex items-center gap-2">
                <MapPin className="h-4 w-4" /> {fullAddress}
              </span>
            )}
            <div className="flex items-center gap-2 pt-1">
              {instagram && (
                <a href={instagram} target="_blank" rel="noreferrer" className="grid h-9 w-9 place-items-center rounded-full border border-black/10 hover:border-black">
                  <Instagram className="h-4 w-4" />
                </a>
              )}
              {store.whatsapp && (
                <a href={buildWhatsAppLink(`Ola ${store.name}!`, store.whatsapp)} target="_blank" rel="noreferrer" className="grid h-9 w-9 place-items-center rounded-full border border-black/10 hover:border-black">
                  <WhatsAppIcon className="h-4 w-4" />
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="border-t border-black/10">
        <div className="mx-auto flex max-w-[1280px] flex-col justify-between gap-2 px-4 py-5 text-[11px] uppercase tracking-[0.16em] text-neutral-500 md:flex-row md:px-8">
          <span>{new Date().getFullYear()} {store.name}</span>
          <span>Powered by VYNKA</span>
        </div>
      </div>
    </footer>
  );
}

function plainText(value: string | null) {
  return (value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}
