// Efeito "produto indo até o carrinho" (escopo do catálogo, §7): uma cópia da foto sai do ponto de
// origem, encolhe até o botão do carrinho no cabeçalho e o botão dá um pulo. A tela não muda.
// Sem animação para quem pede menos movimento no sistema; sem carrinho visível, só o pulo.

function visibleCartTarget() {
  const targets = Array.from(document.querySelectorAll<HTMLElement>("[data-cart-target]"));
  return targets.find((el) => {
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });
}

function bump(target: HTMLElement) {
  target.animate(
    [{ transform: "scale(1)" }, { transform: "scale(1.18)" }, { transform: "scale(1)" }],
    { duration: 320, easing: "ease-out" },
  );
}

export function flyToCart(source: HTMLElement | null, imageUrl: string | null) {
  if (typeof window === "undefined") return;
  const target = visibleCartTarget();
  if (!target) return;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced || !source || typeof source.animate !== "function") {
    bump(target);
    return;
  }

  const from = source.getBoundingClientRect();
  const to = target.getBoundingClientRect();
  const size = Math.min(from.width, from.height, 160);
  const startX = from.left + from.width / 2 - size / 2;
  const startY = from.top + from.height / 2 - size / 2;
  const dx = to.left + to.width / 2 - (startX + size / 2);
  const dy = to.top + to.height / 2 - (startY + size / 2);

  const ghost = document.createElement("div");
  ghost.setAttribute("aria-hidden", "true");
  Object.assign(ghost.style, {
    position: "fixed",
    left: `${startX}px`,
    top: `${startY}px`,
    width: `${size}px`,
    height: `${size}px`,
    zIndex: "60",
    pointerEvents: "none",
    borderRadius: "9999px",
    overflow: "hidden",
    background: "#e5e5e5",
    boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
  });
  if (imageUrl) {
    const img = document.createElement("img");
    img.src = imageUrl;
    img.alt = "";
    Object.assign(img.style, { width: "100%", height: "100%", objectFit: "cover" });
    ghost.appendChild(img);
  }
  document.body.appendChild(ghost);

  const flight = ghost.animate(
    [
      { transform: "translate(0, 0) scale(1)", opacity: 0.95 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.12)`, opacity: 0.6 },
    ],
    { duration: 650, easing: "cubic-bezier(0.5, 0, 0.75, 0.4)" },
  );
  flight.onfinish = () => {
    ghost.remove();
    bump(target);
  };
  flight.oncancel = () => ghost.remove();
  // Aba em segundo plano pausa a animação: a cópia sai de qualquer jeito.
  window.setTimeout(() => ghost.remove(), 1500);
}
