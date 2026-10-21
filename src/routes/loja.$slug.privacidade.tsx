import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { LegalPage } from "@/components/loja/legal-page";
import {
  defaultLegalPolicies,
  storeContactLabel,
  getLegalPolicies,
  storeIdentity,
} from "@/lib/legal-policies";
import { useStorefront } from "@/lib/storefront-context";

// Política de privacidade (escopo paginas-legais.md, §3.3). "No seu navegador" descreve o que a loja
// guarda de fato (medido 20/10): carrinho, último CEP, sessão e a marca da contagem de visitas.
export const Route = createFileRoute("/loja/$slug/privacidade")({
  component: PrivacyPolicyPage,
});

function PrivacyPolicyPage() {
  const store = useStorefront();
  const { data: policies } = useQuery({
    queryKey: ["legal-policies", store.id],
    queryFn: () => getLegalPolicies(store.id),
  });
  const p = policies ?? defaultLegalPolicies;
  const identity = storeIdentity(store);

  return (
    <LegalPage
      title="Política de privacidade"
      policies={policies}
      extra={p.extra_privacy}
      sections={[
        {
          title: "Quem cuida dos seus dados",
          body: (
            <p>
              {identity.name}
              {identity.document ? `, ${identity.document},` : ""} é a responsável pelos dados que
              você informa nesta loja. A loja usa a plataforma Vynka, que guarda e processa os dados
              em nome dela.
            </p>
          ),
        },
        {
          title: "Quais dados",
          body: (
            <p>
              Nome, e-mail, telefone, endereços de entrega, pedidos e favoritos. Os dados do cartão
              são digitados na página do Mercado Pago e não passam pela loja.
            </p>
          ),
        },
        {
          title: "Para quê",
          body: (
            <p>
              Criar sua conta, processar e entregar pedidos, falar com você sobre o pedido e cumprir
              obrigações legais (por exemplo, fiscais).
            </p>
          ),
        },
        {
          title: "Com quem compartilhamos",
          body: (
            <p>
              Mercado Pago (pagamento); Melhor Envio e a transportadora escolhida (entrega: nome,
              endereço e telefone); Vynka (plataforma). Não vendemos seus dados.
            </p>
          ),
        },
        {
          title: "No seu navegador",
          body: (
            <p>
              Guardamos o carrinho, o último CEP consultado e sua sessão de login. Não usamos
              cookies de publicidade nem ferramentas de rastreamento de terceiros. A contagem de
              visitas não identifica você.
            </p>
          ),
        },
        {
          title: "Por quanto tempo",
          body: (
            <p>Enquanto sua conta existir; pedidos ficam guardados pelo prazo exigido em lei.</p>
          ),
        },
        {
          title: "Seus direitos",
          body: (
            <p>
              Você pode pedir acesso, correção, cópia ou exclusão dos seus dados, e saber com quem
              foram compartilhados (LGPD, art. 18), {storeContactLabel(store)}.
            </p>
          ),
        },
      ]}
    />
  );
}
