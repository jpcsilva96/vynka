// Sobe o app local apontando para o banco de HOMOLOGACAO, nunca para a producao.
//   node scripts/dev-homolog.mjs [porta]   (padrao 8081)
// Le HOMOLOG_SUPABASE_URL / _PUBLISHABLE_KEY / _SERVICE_ROLE_KEY do .env sem imprimir nada.
// O cliente do navegador (src/integrations/supabase/client.ts, gerado pelo Lovable) tem o endereco
// da producao fixo no codigo: aqui ele e trocado so em memoria, sem editar o arquivo. Se a troca nao
// acontecer, o servidor nao sobe (melhor parar do que abrir a producao achando que e homologacao).
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);

const env = Object.fromEntries(
  readFileSync(resolve(root, ".env"), "utf8")
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].replace(/^["']|["']$/g, "")]),
);
const url = env.HOMOLOG_SUPABASE_URL;
const publishable = env.HOMOLOG_SUPABASE_PUBLISHABLE_KEY;
const secret = env.HOMOLOG_SUPABASE_SERVICE_ROLE_KEY;
if (!url || !publishable || !secret) {
  console.error("Faltam HOMOLOG_SUPABASE_URL / _PUBLISHABLE_KEY / _SERVICE_ROLE_KEY no .env.");
  process.exit(1);
}
const prodUrl = env.SUPABASE_URL;
if (prodUrl && url.replace(/\/$/, "") === prodUrl.replace(/\/$/, "")) {
  console.error("HOMOLOG_SUPABASE_URL e igual ao da producao. Abortado.");
  process.exit(1);
}

// Variaveis do servidor (funcoes de servidor) e do navegador. As que ja existem no processo ganham
// das do .env. Master e banco direto ficam vazios para nada daqui encostar na producao.
Object.assign(process.env, {
  SUPABASE_URL: url,
  SUPABASE_PUBLISHABLE_KEY: publishable,
  SUPABASE_SERVICE_ROLE_KEY: secret,
  VITE_SUPABASE_URL: url,
  VITE_SUPABASE_PUBLISHABLE_KEY: publishable,
  SUPABASE_DB_URL: "",
  MASTER_EMAIL: "",
  MASTER_PASSWORD: "",
});

const clientFile = /src\/integrations\/supabase\/client\.ts$/;
const homologClient = {
  name: "vynka-homolog-client",
  enforce: "pre",
  transform(code, id) {
    if (!clientFile.test(id.split("?")[0].replace(/\\/g, "/"))) return null;
    const urlLine = /const SUPABASE_URL = "[^"]*";/;
    const keyLine = /const SUPABASE_PUBLISHABLE_KEY = "[^"]*";/;
    if (!urlLine.test(code) || !keyLine.test(code)) {
      throw new Error(
        "dev-homolog: formato do client.ts mudou; troca para homologacao nao aplicada.",
      );
    }
    return code
      .replace(urlLine, `const SUPABASE_URL = ${JSON.stringify(url)};`)
      .replace(keyLine, `const SUPABASE_PUBLISHABLE_KEY = ${JSON.stringify(publishable)};`);
  },
};

const { createServer } = await import("vite");
const port = Number(process.argv[2] ?? 8081);
const server = await createServer({
  root,
  plugins: [homologClient],
  server: { port, strictPort: true },
});
await server.listen();
console.log(`\nVynka HOMOLOGACAO em http://localhost:${port}\n`);
