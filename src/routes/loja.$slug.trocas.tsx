import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { LegalPage } from "@/components/loja/legal-page";
import {
  defaultLegalPolicies,
  storeContactLabel,
  getLegalPolicies,
  type ExchangeShipping,
} from "@/lib/legal-policies";
import { useStorefront } from "@/lib/storefront-context";

// Trocas e devoluções (escopo paginas-legais.md, §3.1).
export const Route = createFileRoute("/loja/$slug/trocas")({
  component: ExchangePolicyPage,
});

const SHIPPING_TEXT: Record<ExchangeShipping, string> = {
  store: "O frete da troca é por nossa conta.",
  customer: "O frete de envio e de retorno da troca é por sua conta.",
  first_free: "A primeira troca tem frete por nossa conta; as seguintes, por sua.",
};

function ExchangePolicyPage() {
  const store = useStorefront();
  const { data: policies } = useQuery({
    queryKey: ["legal-policies", store.id],
    queryFn: () => getLegalPolicies(store.id),
  });
  const p = policies ?? defaultLegalPolicies;

  return (
    <LegalPage
      title="Trocas e devoluções"
      policies={policies}
      extra={p.extra_exchange}
      sections={[
        {
          title: "Desistência da compra (até 7 dias)",
          body: (
            <p>
              Você pode desistir da compra em até 7 dias corridos depois de receber o pedido, sem
              precisar explicar o motivo. Devolvemos o valor pago, incluindo o frete, pela mesma
              forma de pagamento. O frete da devolução é por nossa conta.
            </p>
          ),
        },
        {
          title: "Produto com defeito",
          body: (
            <p>
              Se o produto apresentar defeito, fale com a gente em até 90 dias do recebimento. Temos
              até 30 dias para resolver; se não for possível, você escolhe entre a troca por outro
              igual, a devolução do valor ou um desconto proporcional. O frete fica por nossa conta.
            </p>
          ),
        },
        {
          title: "Troca por tamanho ou cor",
          body: p.exchange_enabled ? (
            <p>
              Aceitamos troca por outro tamanho ou cor em até {p.exchange_days} dias do recebimento,
              sujeita a estoque. O produto deve estar sem uso, com etiqueta e na embalagem original.{" "}
              {SHIPPING_TEXT[p.exchange_shipping]}
            </p>
          ) : (
            <p>
              Não fazemos troca por tamanho ou cor; a desistência em até 7 dias continua valendo.
            </p>
          ),
        },
        {
          title: "Como pedir",
          body: (
            <>
              <p>
                Fale com a gente {storeContactLabel(store)}, com o número do pedido. Vamos combinar
                como enviar ou entregar o produto.
              </p>
              <p>
                Valores devolvidos no cartão aparecem conforme a data de fechamento da fatura; no
                Pix, voltam para a conta de onde saiu o pagamento.
              </p>
            </>
          ),
        },
      ]}
    />
  );
}
