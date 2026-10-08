import type { CatalogVisualSettings, StoreFont } from "@/lib/store-settings";

// Temas prontos da personalização (escopo do catálogo, §3): 6 cores + fonte do título + fonte do
// texto. Contraste de leitura conferido em 09/10 (texto e botão >= 4,5 contra o fundo).
export type StoreThemeColors = Pick<
  CatalogVisualSettings,
  | "header_background_color"
  | "background_color"
  | "primary_color"
  | "secondary_color"
  | "button_color"
  | "button_text_color"
>;

export interface StoreTheme {
  id: string;
  name: string;
  colors: StoreThemeColors;
  heading_font: StoreFont;
  body_font: StoreFont;
}

export const storeThemes: StoreTheme[] = [
  {
    id: "classico",
    name: "Clássico",
    colors: {
      header_background_color: "#ffffff",
      background_color: "#ffffff",
      primary_color: "#111111",
      secondary_color: "#525252",
      button_color: "#111111",
      button_text_color: "#ffffff",
    },
    heading_font: "inter",
    body_font: "inter",
  },
  {
    id: "rose",
    name: "Rosé",
    colors: {
      header_background_color: "#fbeef1",
      background_color: "#fffafb",
      primary_color: "#4a1d2b",
      secondary_color: "#6e4b55",
      button_color: "#a8455e",
      button_text_color: "#ffffff",
    },
    heading_font: "playfair",
    body_font: "lato",
  },
  {
    id: "esportivo",
    name: "Esportivo",
    colors: {
      header_background_color: "#111111",
      background_color: "#ffffff",
      primary_color: "#111111",
      secondary_color: "#4b5563",
      button_color: "#c2410c",
      button_text_color: "#ffffff",
    },
    heading_font: "oswald",
    body_font: "roboto",
  },
  {
    id: "natural",
    name: "Natural",
    colors: {
      header_background_color: "#efe9dc",
      background_color: "#faf8f3",
      primary_color: "#2f3b2c",
      secondary_color: "#56604f",
      button_color: "#4d6b45",
      button_text_color: "#ffffff",
    },
    heading_font: "cormorant",
    body_font: "nunito",
  },
  {
    id: "noite",
    name: "Noite",
    colors: {
      header_background_color: "#0f0f12",
      background_color: "#18181b",
      primary_color: "#fafafa",
      secondary_color: "#a1a1aa",
      button_color: "#e4c590",
      button_text_color: "#111111",
    },
    heading_font: "montserrat",
    body_font: "inter",
  },
  {
    id: "vibrante",
    name: "Vibrante",
    colors: {
      header_background_color: "#ffffff",
      background_color: "#ffffff",
      primary_color: "#1e1b4b",
      secondary_color: "#4b5563",
      button_color: "#6d28d9",
      button_text_color: "#ffffff",
    },
    heading_font: "poppins",
    body_font: "poppins",
  },
];

/** Tema cujas cores e fontes batem exatamente com as configurações (ou nenhum, se ajustadas). */
export function matchingTheme(visual: CatalogVisualSettings) {
  return storeThemes.find(
    (theme) =>
      theme.heading_font === visual.heading_font &&
      theme.body_font === visual.body_font &&
      (Object.keys(theme.colors) as (keyof StoreThemeColors)[]).every(
        (key) => theme.colors[key].toLowerCase() === visual[key].toLowerCase(),
      ),
  );
}
