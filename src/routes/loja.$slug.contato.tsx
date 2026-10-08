import { createFileRoute, notFound } from "@tanstack/react-router";
import { ChevronRight, Instagram, Mail, MapPin } from "lucide-react";
import type { ReactNode } from "react";
import { WhatsAppIcon } from "@/components/loja/store-header";
import { formatPhone } from "@/lib/br-documents";
import { useStorefront } from "@/lib/storefront-context";

export const Route = createFileRoute("/loja/$slug/contato")({
  component: ContactStorePage,
});

interface ContactChannel {
  key: string;
  title: string;
  description: string;
  value: string;
  href: string;
  icon: ReactNode;
  external?: boolean;
}

function ContactStorePage() {
  const store = useStorefront();
  const visual = store.catalog_visual;

  if (!visual.contact_enabled) throw notFound();

  const whatsappDigits = normalizeBrazilianPhone(store.whatsapp);
  const instagramHandle = normalizeInstagramHandle(store.instagram);
  const fullAddress = formatAddress(store);
  const channels: ContactChannel[] = [];

  if (whatsappDigits && store.whatsapp) {
    channels.push({
      key: "whatsapp",
      title: "WhatsApp",
      description: "Fale conosco pelo WhatsApp",
      value: formatPhone(store.whatsapp),
      href: `https://wa.me/${whatsappDigits}`,
      icon: <WhatsAppIcon className="h-5 w-5" />,
      external: true,
    });
  }
  if (instagramHandle) {
    channels.push({
      key: "instagram",
      title: "Instagram",
      description: "Acompanhe novidades e promoções",
      value: `@${instagramHandle}`,
      href: `https://instagram.com/${instagramHandle}`,
      icon: <Instagram className="h-5 w-5" strokeWidth={1.8} />,
      external: true,
    });
  }
  if (store.email?.trim()) {
    channels.push({
      key: "email",
      title: "E-mail",
      description: "Envie uma mensagem por e-mail",
      value: store.email.trim(),
      href: `mailto:${store.email.trim()}`,
      icon: <Mail className="h-5 w-5" strokeWidth={1.8} />,
    });
  }
  if (store.address?.trim() && fullAddress) {
    channels.push({
      key: "address",
      title: "Endereço",
      description: "Venha nos visitar!",
      value: fullAddress,
      href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`,
      icon: <MapPin className="h-5 w-5" strokeWidth={1.8} />,
      external: true,
    });
  }

  return (
    <section className="border-b border-[color-mix(in_srgb,var(--shop-primary)_12%,transparent)] bg-[color-mix(in_srgb,var(--shop-background)_96%,var(--shop-primary)_4%)] px-4 py-14 md:px-8 md:py-20">
      <div className="mx-auto max-w-[1080px]">
        <div className="max-w-2xl">
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--shop-primary)]">
            Fale conosco
          </div>
          <h1 className="mt-4 text-4xl font-semibold leading-[1.08] text-[var(--shop-primary)] md:text-6xl">
            Estamos aqui para te ajudar!
          </h1>
          <div className="mt-6 h-0.5 w-12 bg-[var(--shop-primary)]" />
          <p className="mt-6 max-w-xl text-[15px] leading-7 text-[var(--shop-secondary)] md:text-[17px]">
            Tem dúvidas, sugestões ou precisa de ajuda com seu pedido? Entre em contato com a gente pelos canais abaixo. Será um prazer atender você!
          </p>
        </div>

        <div className="mt-12 rounded-lg border border-[color-mix(in_srgb,var(--shop-surface-text)_10%,transparent)] bg-[var(--shop-surface)] p-4 shadow-[0_12px_36px_color-mix(in_srgb,var(--shop-surface-text)_8%,transparent)] md:p-7">
          <h2 className="px-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--shop-surface-text)]">
            Nossos canais de atendimento
          </h2>
          <div className="mt-5 grid gap-3">
            {channels.map((channel) => (
              <a
                key={channel.key}
                href={channel.href}
                target={channel.external ? "_blank" : undefined}
                rel={channel.external ? "noreferrer" : undefined}
                className="group flex min-h-20 w-full items-center gap-4 rounded-md border border-[color-mix(in_srgb,var(--shop-surface-text)_10%,transparent)] bg-[var(--shop-surface)] px-4 py-4 shadow-[0_4px_16px_color-mix(in_srgb,var(--shop-surface-text)_5%,transparent)] transition duration-200 hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--shop-surface-text)_28%,transparent)] hover:shadow-[0_8px_24px_color-mix(in_srgb,var(--shop-surface-text)_10%,transparent)] md:px-5"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--shop-surface-text)] text-[var(--shop-surface)]">
                  {channel.icon}
                </span>
                <span className="min-w-0 flex-1 md:grid md:grid-cols-[minmax(0,1fr)_minmax(180px,0.8fr)] md:items-center md:gap-6">
                  <span className="block">
                    <strong className="block text-[14px] font-semibold text-[var(--shop-surface-text)]">{channel.title}</strong>
                    <span className="mt-1 block text-[12px] text-[color-mix(in_srgb,var(--shop-surface-text)_65%,transparent)]">{channel.description}</span>
                  </span>
                  <span className="mt-2 block break-words text-[13px] font-medium text-[var(--shop-surface-text)] md:mt-0 md:text-right">{channel.value}</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-[var(--shop-surface-text)] opacity-45 transition-transform group-hover:translate-x-1 group-hover:opacity-100" strokeWidth={1.8} />
              </a>
            ))}
          </div>
        </div>

        <div className="mt-8 flex flex-col items-start justify-between gap-5 rounded-lg border border-[color-mix(in_srgb,var(--shop-surface-text)_10%,transparent)] bg-[var(--shop-surface)] p-6 md:flex-row md:items-center md:p-8">
          <div>
            <h2 className="text-2xl font-semibold text-[var(--shop-surface-text)]">Ficou com alguma dúvida?</h2>
            <p className="mt-1 text-[13px] text-[color-mix(in_srgb,var(--shop-surface-text)_65%,transparent)]">Nossa equipe está pronta para te atender!</p>
          </div>
          {whatsappDigits && (
            <a
              href={`https://wa.me/${whatsappDigits}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-[var(--shop-button)] px-5 py-3 text-[13px] font-semibold text-[var(--shop-button-text)] transition-colors hover:bg-[var(--shop-button-hover)] md:w-auto"
            >
              <WhatsAppIcon className="h-4 w-4" />
              Chamar no WhatsApp
            </a>
          )}
        </div>
      </div>
    </section>
  );
}

function normalizeBrazilianPhone(value: string | null) {
  const digits = value?.replace(/\D/g, "") ?? "";
  if (!digits) return "";
  return digits.startsWith("55") ? digits : `55${digits}`;
}

function normalizeInstagramHandle(value: string | null) {
  return (value ?? "")
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/^@/, "")
    .replace(/\/$/, "");
}

function formatAddress(store: ReturnType<typeof useStorefront>) {
  const street = [store.address, store.address_number].filter(Boolean).join(", ");
  const cityState = [store.city, store.state].filter(Boolean).join(" - ");
  const zipCode = formatZipCode(store.zip_code);
  return [street, store.complement, cityState, zipCode && `CEP ${zipCode}`].filter(Boolean).join(" · ");
}

function formatZipCode(value: string | null) {
  const digits = value?.replace(/\D/g, "") ?? "";
  return digits.length === 8 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : value?.trim() ?? "";
}
