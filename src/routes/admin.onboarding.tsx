import { createFileRoute, redirect } from "@tanstack/react-router";

// O assistente antigo de configuração inicial saiu (D13): os primeiros passos e o Publicar moram em
// "Loja e Catálogo". O endereço fica só para quem tiver o link salvo.
export const Route = createFileRoute("/admin/onboarding")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/configuracoes", replace: true });
  },
});
