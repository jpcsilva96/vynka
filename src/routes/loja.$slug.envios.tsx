import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { LegalPage, type LegalSection } from "@/components/loja/legal-page";
import { getCheckoutSettings, listDeliveryCities } from "@/lib/checkout-settings";
import { defaultLegalPolicies, getLegalPolicies, storeIdentity } from "@/lib/legal-policies";
import { useStorefront } from "@/lib/storefront-context";

// Envios e prazos (escopo paginas-legais.md, §3.2). Entrega, retirada e cidades vêm da aba Entrega.
// Rastreio só entra no texto depois do lote de etiquetas (§6).
export const Route = createFileRoute("/loja/$slug/envios")({
  component: ShippingPolicyPage,
});

function ShippingPolicyPage() {
  const store = useStorefront();
  const { data: policies } = useQuery({
    queryKey: ["legal-policies", store.id],
    queryFn: () => getLegalPolicies(store.id),
  });
  const { data: checkout } = useQuery({
    queryKey: ["public-checkout-settings", store.id],
    queryFn: () => getCheckoutSettings(store.id),
  });
  const { data: cities = [] } = useQuery({
    queryKey: ["public-delivery-cities", store.id],
    queryFn: () => listDeliveryCities(store.id),
    enabled: !!checkout?.local_delivery_enabled,
  });
  const p = policies ?? defaultLegalPolicies;
  const days = p.preparation_days;

  const sections: LegalSection[] = [
    {
      title: "Separação",
      body: (
        <p>
          Depois da confirmação do pagamento, separamos o pedido em até {days}{" "}
          {days === 1 ? "dia útil" : "dias úteis"}.
        </p>
      ),
    },
  ];
  if (checkout?.shipping_enabled) {
    sections.push({
      title: "Correios e transportadoras",
      body: (
        <p>O prazo e o valor aparecem no checkout para o seu CEP e contam a partir do envio.</p>
      ),
    });
  }
  if (checkout?.local_delivery_enabled) {
    const names = cities.map((city) => `${city.city_name}/${city.state}`);
    sections.push({
      title: "Entrega local",
      body: (
        <p>
          {names.length > 0 ? `Entregamos em ${names.join(", ")}. ` : ""}O valor aparece no
          checkout; combinamos o horário pelo WhatsApp.
        </p>
      ),
    });
  }
  if (checkout?.pickup_enabled) {
    // Mesmo endereço que o checkout mostra: o da retirada ou, sem ele, o da loja.
    const identity = storeIdentity(store);
    const storeAddress = [identity.street, identity.location].filter(Boolean).join(" - ");
    const place = sentence(checkout.pickup_address || storeAddress);
    const instructions = sentence(checkout.pickup_instructions);
    sections.push({
      title: "Retirada",
      body: (
        <p>
          {place ? `Retire em ${place}. ` : ""}
          {instructions ? `${instructions}. ` : ""}Avisamos quando o pedido estiver pronto.
        </p>
      ),
    });
  }
  sections.push(
    {
      title: "Endereço",
      body: (
        <p>
          Confira o endereço antes de pagar. Se o pedido voltar por endereço incorreto ou ausência,
          o novo envio é por sua conta.
        </p>
      ),
    },
    {
      title: "Atraso ou extravio",
      body: (
        <p>
          Se o pedido atrasar ou não chegar, fale com a gente que acompanhamos com a transportadora.
        </p>
      ),
    },
  );

  return (
    <LegalPage
      title="Envios e prazos"
      policies={policies}
      extra={p.extra_shipping}
      sections={sections}
    />
  );
}

// Texto do lojista sem ponto final repetido.
function sentence(value: string | null | undefined) {
  return (value ?? "").trim().replace(/[.s]+$/, "");
}
