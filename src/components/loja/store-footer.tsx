import { Link } from "@tanstack/react-router";
import { useState, type CSSProperties, type ReactNode } from "react";
import { ChevronDown, Clock, Instagram, Mail, MapPin, Phone, ShieldCheck } from "lucide-react";
import { buildWhatsAppLink, openCart } from "@/lib/cart";
import { formatPhone } from "@/lib/br-documents";
import { useStoreCustomer } from "@/lib/customer-account";
import { openCustomerAuth } from "@/lib/customer-auth-dialog";
import { storeIdentity } from "@/lib/legal-policies";
import { contrastRatio } from "@/lib/store-settings";
import { useStorefront } from "@/lib/storefront-context";
import { cn } from "@/lib/utils";
import { WhatsAppIcon } from "./store-header";

// Pix e as bandeiras que o Checkout Pro do Mercado Pago aceita. Só selos verdadeiros (escopo §11).
const PAYMENT_SEALS = ["Pix", "Visa", "Mastercard", "Elo", "Amex", "Hipercard"];

// Rodapé da loja (escopo do catálogo, §11): marca, Institucional, Minha conta e Atendimento, tudo
// tirado do que o lojista já cadastrou; só aparece o que estiver preenchido. No celular as três
// colunas viram listas que abrem ao tocar; marca e selos ficam sempre à vista.
export function StoreFooter() {
  const store = useStorefront();
  const slug = store.slug;
  const visual = store.catalog_visual;
  const { data: customer } = useStoreCustomer(store.id);
  const background = visual.header_background_color;
  const text = visual.header_text_color;
  // Ícones na cor dos botões; se ela some no fundo do rodapé, ficam na cor da letra.
  const iconColor =
    contrastRatio(visual.button_color, background) >= 3 ? visual.button_color : text;

  const location = [store.city, store.state].filter(Boolean).join("/");
  const streetAddress = [store.address, store.address_number, store.complement]
    .filter(Boolean)
    .join(", ");
  const fullAddress = [streetAddress, location].filter(Boolean).join(" - ");
  const instagram = store.instagram
    ? store.instagram.startsWith("http")
      ? store.instagram
      : `https://instagram.com/${store.instagram.replace(/^@/, "")}`
    : null;
  const whatsapp = store.whatsapp ? buildWhatsAppLink(`Olá ${store.name}!`, store.whatsapp) : null;
  // Telefone só aparece à parte quando é outro número que não o WhatsApp.
  const phone =
    store.phone && digitsOnly(store.phone) !== digitsOnly(store.whatsapp ?? "")
      ? store.phone
      : null;
  const description = plainText(store.description);
  const identity = storeIdentity(store);

  const institutional: ReactNode[] = [];
  if (visual.about_enabled) {
    institutional.push(
      <Link key="about" to="/loja/$slug/quem-somos" params={{ slug }} className={linkClass}>
        {visual.about_menu_label || "Quem somos"}
      </Link>,
    );
  }
  if (visual.contact_enabled) {
    institutional.push(
      <Link key="contact" to="/loja/$slug/contato" params={{ slug }} className={linkClass}>
        Contato
      </Link>,
    );
  }
  // Páginas legais: toda loja tem (modelo padrão do Vynka, escopo paginas-legais.md).
  institutional.push(
    <Link key="trocas" to="/loja/$slug/trocas" params={{ slug }} className={linkClass}>
      Trocas e devoluções
    </Link>,
    <Link key="envios" to="/loja/$slug/envios" params={{ slug }} className={linkClass}>
      Envios e prazos
    </Link>,
    <Link key="privacidade" to="/loja/$slug/privacidade" params={{ slug }} className={linkClass}>
      Política de privacidade
    </Link>,
  );

  const firstName = customer?.name?.trim().split(/\s+/)[0] ?? "";
  // Sem conta, Minhas compras e Favoritos abrem a janela de entrar (mesma do cabeçalho).
  const accountLink = (
    to:
      | "/loja/$slug/minha-conta"
      | "/loja/$slug/minha-conta/compras"
      | "/loja/$slug/minha-conta/favoritos",
    label: string,
  ) =>
    customer ? (
      <Link to={to} params={{ slug }} className={linkClass}>
        {label}
      </Link>
    ) : (
      <button
        type="button"
        onClick={() => openCustomerAuth()}
        className={cn(linkClass, "text-left")}
      >
        {label}
      </button>
    );

  const service: ReactNode[] = [];
  if (whatsapp && store.whatsapp) {
    service.push(
      <ServiceItem key="whatsapp" icon={<WhatsAppIcon className="h-4 w-4" />} color={iconColor}>
        <a href={whatsapp} target="_blank" rel="noreferrer" className={linkClass}>
          {formatPhone(store.whatsapp)}
        </a>
      </ServiceItem>,
    );
  }
  if (phone) {
    service.push(
      <ServiceItem key="phone" icon={<Phone className="h-4 w-4" />} color={iconColor}>
        <a href={`tel:${digitsOnly(phone)}`} className={linkClass}>
          {formatPhone(phone)}
        </a>
      </ServiceItem>,
    );
  }
  if (store.email) {
    service.push(
      <ServiceItem key="email" icon={<Mail className="h-4 w-4" />} color={iconColor}>
        <a href={`mailto:${store.email}`} className={cn(linkClass, "break-all")}>
          {store.email}
        </a>
      </ServiceItem>,
    );
  }
  if (fullAddress) {
    service.push(
      <ServiceItem key="address" icon={<MapPin className="h-4 w-4" />} color={iconColor}>
        <span>{fullAddress}</span>
      </ServiceItem>,
    );
  }
  if (store.business_hours?.trim()) {
    service.push(
      <ServiceItem key="hours" icon={<Clock className="h-4 w-4" />} color={iconColor}>
        <span className="whitespace-pre-line">{store.business_hours.trim()}</span>
      </ServiceItem>,
    );
  }

  return (
    // Rodapé usa a cor "Cabeçalho e rodapé"; títulos e textos seguem a letra calculada para ela.
    <footer
      id="contato"
      className="border-t border-black/10 bg-white text-[13px]"
      style={
        {
          color: text,
          "--shop-background": background,
          "--shop-primary": text,
          "--shop-secondary": `color-mix(in srgb, ${text} 72%, transparent)`,
        } as CSSProperties
      }
    >
      <div className="mx-auto grid max-w-[1280px] px-4 py-10 md:grid-cols-[1.4fr_1fr_1fr_1.3fr] md:gap-10 md:px-8 md:py-14">
        <div className="pb-6 md:pb-0">
          {store.logo_url ? (
            <img
              src={store.logo_url}
              alt={store.name}
              className="h-12 w-auto max-w-[200px] object-contain object-left"
            />
          ) : (
            // Logo OU nome, nunca os dois (escopo do catálogo, §2).
            <div className="text-[16px] font-semibold uppercase tracking-[0.22em] text-black">
              {store.name}
            </div>
          )}
          {description && (
            <p className="mt-4 max-w-sm leading-relaxed text-neutral-600">{description}</p>
          )}
          {(instagram || whatsapp) && (
            <div className="mt-5 flex items-center gap-2">
              {instagram && (
                <SocialButton href={instagram} label="Instagram" color={iconColor}>
                  <Instagram className="h-4 w-4" />
                </SocialButton>
              )}
              {whatsapp && (
                <SocialButton href={whatsapp} label="WhatsApp" color={iconColor}>
                  <WhatsAppIcon className="h-4 w-4" />
                </SocialButton>
              )}
            </div>
          )}
        </div>

        <FooterColumn title="Institucional">{institutional}</FooterColumn>

        <FooterColumn title="Minha conta">
          {customer ? (
            accountLink("/loja/$slug/minha-conta", firstName ? `Olá, ${firstName}` : "Minha conta")
          ) : (
            <button
              type="button"
              onClick={() => openCustomerAuth()}
              className={cn(linkClass, "text-left")}
            >
              Entrar
            </button>
          )}
          {accountLink("/loja/$slug/minha-conta/compras", "Minhas compras")}
          {accountLink("/loja/$slug/minha-conta/favoritos", "Favoritos")}
          <button type="button" onClick={openCart} className={cn(linkClass, "text-left")}>
            Carrinho
          </button>
        </FooterColumn>

        {service.length > 0 && <FooterColumn title="Atendimento">{service}</FooterColumn>}
      </div>

      <div className="border-t border-black/10">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-4 px-4 py-6 md:flex-row md:items-center md:justify-between md:px-8">
          <div className="grid gap-1 text-[11px] text-neutral-500">
            <span>
              Todos os direitos reservados à {store.name}
              {location ? ` · ${location}` : ""}
            </span>
            {/* Identificação de quem vende (Decreto 7.962/2013). */}
            {identity.document && (
              <span>
                {identity.name} · {identity.document}
              </span>
            )}
            <span>Plataforma Vynka</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {PAYMENT_SEALS.map((seal) => (
              <span
                key={seal}
                className="rounded border border-current/20 px-2 py-1 text-[10px] font-semibold leading-none"
              >
                {seal}
              </span>
            ))}
            <span className="inline-flex items-center gap-1 px-1 text-[11px] text-neutral-600">
              <ShieldCheck className="h-4 w-4 shrink-0" style={{ color: iconColor }} />
              Pagamento seguro Mercado Pago
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}

const linkClass = "transition-opacity hover:opacity-70";

// Coluna do rodapé: no computador sempre aberta; no celular abre e fecha ao tocar no título.
function FooterColumn({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-black/10 md:border-t-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex min-h-12 w-full items-center justify-between text-left text-[11px] font-semibold uppercase tracking-[0.2em] md:pointer-events-none md:min-h-0"
      >
        {title}
        <ChevronDown
          className={cn("h-4 w-4 transition-transform md:hidden", open && "rotate-180")}
          strokeWidth={1.8}
        />
      </button>
      <div
        className={cn(
          "grid gap-3 pb-5 text-neutral-600 md:mt-4 md:grid md:pb-0",
          !open && "hidden",
        )}
      >
        {children}
      </div>
    </div>
  );
}

function ServiceItem({
  icon,
  color,
  children,
}: {
  icon: ReactNode;
  color: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-px shrink-0" style={{ color }}>
        {icon}
      </span>
      <span className="min-w-0">{children}</span>
    </div>
  );
}

function SocialButton({
  href,
  label,
  color,
  children,
}: {
  href: string;
  label: string;
  color: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      className="grid h-11 w-11 place-items-center rounded-full border border-current/15 transition-opacity hover:opacity-70"
      style={{ color }}
    >
      {children}
    </a>
  );
}

function plainText(value: string | null) {
  return (value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}
