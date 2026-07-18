
-- Enum para status do produto
CREATE TYPE public.product_status AS ENUM ('active', 'draft', 'archived');

-- CATEGORIAS
CREATE TABLE public.categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO anon, authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories_all_prototype" ON public.categories FOR ALL USING (true) WITH CHECK (true);

-- PRODUTOS
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  description TEXT,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  promo_price NUMERIC(12,2),
  featured BOOLEAN NOT NULL DEFAULT false,
  status public.product_status NOT NULL DEFAULT 'draft',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO anon, authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products_all_prototype" ON public.products FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_products_category ON public.products(category_id);
CREATE INDEX idx_products_status ON public.products(status);

-- IMAGENS DE PRODUTO
CREATE TABLE public.product_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  storage_path TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_images TO anon, authenticated;
GRANT ALL ON public.product_images TO service_role;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "product_images_all_prototype" ON public.product_images FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_product_images_product ON public.product_images(product_id);

-- OPÇÕES (ex: Cor, Tamanho)
CREATE TABLE public.product_options (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_options TO anon, authenticated;
GRANT ALL ON public.product_options TO service_role;
ALTER TABLE public.product_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "product_options_all_prototype" ON public.product_options FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_product_options_product ON public.product_options(product_id);

-- VALORES DE OPÇÃO (ex: Preto, Branco)
CREATE TABLE public.product_option_values (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  option_id UUID NOT NULL REFERENCES public.product_options(id) ON DELETE CASCADE,
  value TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_option_values TO anon, authenticated;
GRANT ALL ON public.product_option_values TO service_role;
ALTER TABLE public.product_option_values ENABLE ROW LEVEL SECURITY;
CREATE POLICY "product_option_values_all_prototype" ON public.product_option_values FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_product_option_values_option ON public.product_option_values(option_id);

-- VARIAÇÕES (combinações geradas)
CREATE TABLE public.product_variants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  options JSONB NOT NULL DEFAULT '{}'::jsonb, -- ex: {"Cor":"Preto","Tamanho":"P"}
  sku_key TEXT NOT NULL, -- assinatura estável da combinação
  price NUMERIC(12,2),
  image_url TEXT,
  available BOOLEAN NOT NULL DEFAULT true,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_id, sku_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_variants TO anon, authenticated;
GRANT ALL ON public.product_variants TO service_role;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "product_variants_all_prototype" ON public.product_variants FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_product_variants_product ON public.product_variants(product_id);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_products_updated BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_categories_updated BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Storage bucket policies (bucket já criado via tool)
CREATE POLICY "product_images_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'product-images');
CREATE POLICY "product_images_public_write" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'product-images');
CREATE POLICY "product_images_public_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'product-images');
CREATE POLICY "product_images_public_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'product-images');

-- Seed algumas categorias iniciais para facilitar
INSERT INTO public.categories (name, slug, position) VALUES
  ('Sem categoria', 'sem-categoria', 0),
  ('Roupas', 'roupas', 1),
  ('Acessórios', 'acessorios', 2),
  ('Calçados', 'calcados', 3);
