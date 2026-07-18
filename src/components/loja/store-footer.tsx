import { Link } from "@tanstack/react-router";
import { Instagram, Facebook, MapPin, Clock } from "lucide-react";
import { VynkaLogo } from "@/components/vynka-logo";
import { WhatsAppIcon } from "./store-header";
import { buildWhatsAppLink, STORE_NAME } from "@/lib/cart";

export function StoreFooter() {
  return (
    <footer id="contato" className="border-t border-black/[0.06] bg-white">
      <div className="mx-auto grid max-w-[1400px] gap-12 px-6 py-16 md:grid-cols-4 md:px-10 md:py-24">
        <div className="md:col-span-2">
          <VynkaLogo className="h-5" />
          <p className="mt-6 max-w-sm text-[13px] leading-relaxed text-neutral-600">
            Uma seleção cuidadosa de peças atemporais. Simples, essencial e feito
            para durar.
          </p>
          <div className="mt-6 flex items-center gap-2">
            <SocialLink href="https://instagram.com" label="Instagram">
              <Instagram className="h-4 w-4" strokeWidth={1.4} />
            </SocialLink>
            <SocialLink href="https://facebook.com" label="Facebook">
              <Facebook className="h-4 w-4" strokeWidth={1.4} />
            </SocialLink>
            <SocialLink href="https://tiktok.com" label="TikTok">
              <TikTokIcon className="h-4 w-4" />
            </SocialLink>
            <SocialLink
              href={buildWhatsAppLink(`Olá ${STORE_NAME}!`)}
              label="WhatsApp"
            >
              <WhatsAppIcon className="h-4 w-4" />
            </SocialLink>
          </div>
        </div>

        <div>
          <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-500">
            Navegue
          </div>
          <ul className="mt-5 space-y-3 text-[13px] text-neutral-700">
            <li>
              <Link to="/loja/$slug" className="transition-colors hover:text-black">
                Início
              </Link>
            </li>
            <li>
              <Link to="/loja/$slug" hash="novidades" className="transition-colors hover:text-black">
                Novidades
              </Link>
            </li>
            <li>
              <Link to="/loja/$slug" hash="categorias" className="transition-colors hover:text-black">
                Categorias
              </Link>
            </li>
            <li>
              <Link to="/loja/$slug" hash="promocoes" className="transition-colors hover:text-black">
                Promoções
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-500">
            Atendimento
          </div>
          <ul className="mt-5 space-y-3 text-[13px] text-neutral-700">
            <li className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-500" strokeWidth={1.4} />
              <span>Av. Paulista, 1000 — São Paulo, SP</span>
            </li>
            <li className="flex items-start gap-2">
              <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-500" strokeWidth={1.4} />
              <span>Seg — Sáb · 10h às 20h</span>
            </li>
            <li className="flex items-start gap-2">
              <WhatsAppIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-500" />
              <a
                href={buildWhatsAppLink(`Olá ${STORE_NAME}!`)}
                target="_blank"
                rel="noreferrer"
                className="transition-colors hover:text-black"
              >
                Falar no WhatsApp
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-black/[0.06]">
        <div className="mx-auto flex max-w-[1400px] flex-col items-start justify-between gap-2 px-6 py-6 text-[11px] uppercase tracking-[0.16em] text-neutral-500 md:flex-row md:items-center md:px-10">
          <span>© {new Date().getFullYear()} {STORE_NAME}. Todos os direitos reservados.</span>
          <span>Powered by VYNKA</span>
        </div>
      </div>
    </footer>
  );
}

function SocialLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      className="grid h-9 w-9 place-items-center rounded-full border border-black/10 text-neutral-700 transition-colors hover:border-black hover:text-black"
    >
      {children}
    </a>
  );
}

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M16.5 3c.4 2.3 1.7 3.7 4 4v2.4c-1.4 0-2.7-.5-4-1.3v5.6c0 3.9-3 6.3-6.2 6.3-3.2 0-6.2-2.6-6.2-6.2 0-3.6 3.2-6.2 6.5-5.9v2.6c-.5-.1-1-.2-1.6-.1-1.7.3-2.9 1.7-2.7 3.5.2 1.6 1.5 2.8 3.1 2.8 1.8 0 3.2-1.3 3.2-3V3h3.9z" />
    </svg>
  );
}
