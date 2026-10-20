import type { CSSProperties } from "react";
import { storeFontFamily, type CatalogVisualSettings } from "@/lib/store-settings";

// Cores e fontes da loja como variáveis CSS. Usado no bloco da loja e nas janelas que abrem fora
// dele (portal), que não herdam as variáveis.
export function storefrontThemeStyle(visual: CatalogVisualSettings): CSSProperties {
  return {
    "--shop-primary": visual.primary_color,
    "--shop-secondary": visual.secondary_color,
    "--shop-background": visual.background_color,
    "--shop-button": visual.button_color,
    "--shop-button-hover": visual.button_hover_color,
    "--shop-button-text": visual.button_text_color,
    "--shop-surface": visual.header_background_color,
    "--shop-surface-text": visual.header_text_color,
    "--store-heading-font": storeFontFamily(visual.heading_font),
    "--store-body-font": storeFontFamily(visual.body_font),
    "--store-heading-scale": visual.heading_scale / 100,
    "--store-body-size": `${14 * (visual.body_scale / 100)}px`,
  } as CSSProperties;
}
