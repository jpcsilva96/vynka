// Limpa o HTML da descrição do produto: fica só a estrutura (parágrafos, títulos, negrito, itálico,
// listas, tabelas), sem nenhum atributo. Texto colado de outro site trazia fundo branco, fonte e cor
// fixos em cada parágrafo e a descrição ignorava o tema da loja. Sem atributos e sem tags fora da
// lista, também não passa código (script, onerror, links javascript:).
// Função pura, sem DOM: dá o mesmo resultado no servidor e no navegador.

const ALLOWED = new Set([
  "p",
  "br",
  "h1",
  "h2",
  "h3",
  "h4",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "ul",
  "ol",
  "li",
  "blockquote",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
]);
// Blocos que viram parágrafo (texto colado costuma vir em div).
const AS_PARAGRAPH = new Set(["div", "section", "article"]);
// O conteúdo some junto com a tag.
const DROP_WITH_CONTENT =
  /<(script|style|template|iframe|object|noscript|head|title)\b[\s\S]*?<\/\1\s*>/gi;

const TAG = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g;

export function sanitizeRichText(html: string | null | undefined): string {
  if (!html) return "";
  const input = html.replace(/<!--[\s\S]*?-->/g, "").replace(DROP_WITH_CONTENT, "");
  let out = "";
  let last = 0;
  for (const match of input.matchAll(TAG)) {
    out += escapeText(input.slice(last, match.index));
    last = match.index! + match[0].length;
    const closing = match[1] === "/";
    let name = match[2].toLowerCase();
    if (AS_PARAGRAPH.has(name)) name = "p";
    if (!ALLOWED.has(name)) continue;
    if (name === "br") out += "<br>";
    else out += closing ? `</${name}>` : `<${name}>`;
  }
  out += escapeText(input.slice(last));
  return out;
}

// Entre as tags só sobra texto: um "<" solto não pode abrir tag nova.
function escapeText(text: string) {
  return text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
