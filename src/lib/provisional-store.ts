// Loja criada pelo Master só com os dados do responsável nasce com nome e link provisórios;
// o dono define os definitivos em Configurações. O banco exige name/slug (NOT NULL, slug único).
export const PROVISIONAL_STORE_NAME = "Nova loja";

const PROVISIONAL_SLUG = /^loja-[a-f0-9]{8}$/;

export const makeProvisionalSlug = () => `loja-${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;

export const isProvisionalSlug = (slug: string | null | undefined) =>
  !!slug && PROVISIONAL_SLUG.test(slug);

export const isProvisionalName = (name: string | null | undefined) =>
  !name || name.trim() === PROVISIONAL_STORE_NAME;
