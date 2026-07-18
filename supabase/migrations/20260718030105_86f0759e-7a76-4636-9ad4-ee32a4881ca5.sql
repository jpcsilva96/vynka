
-- Onboarding & publication enums
DO $$ BEGIN
  CREATE TYPE public.onboarding_status AS ENUM ('not_started','in_progress','completed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.publication_status AS ENUM ('draft','published','unpublished','suspended');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Extend stores with onboarding + branding + fulfilment fields
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS segment text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS zip_code text,
  ADD COLUMN IF NOT EXISTS business_hours text,
  ADD COLUMN IF NOT EXISTS delivery_notes text,
  ADD COLUMN IF NOT EXISTS banner_title text,
  ADD COLUMN IF NOT EXISTS banner_subtitle text,
  ADD COLUMN IF NOT EXISTS banner_cta text,
  ADD COLUMN IF NOT EXISTS og_image_url text,
  ADD COLUMN IF NOT EXISTS accepts_whatsapp_orders boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS accepts_site_orders boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pickup_available boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS delivery_available boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS combine_delivery_whatsapp boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS onboarding_status public.onboarding_status NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS onboarding_current_step smallint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS publication_status public.publication_status NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS published_at timestamptz;

-- Only expose stores publicly when catalog is published (in addition to being active/trial)
CREATE OR REPLACE FUNCTION public.store_is_public(_store_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.stores
    WHERE id = _store_id
      AND status IN ('trial','active')
      AND publication_status = 'published'
  );
$$;

-- Widen public read of stores to still allow members/master to see draft/unpublished stores
DROP POLICY IF EXISTS stores_public_read ON public.stores;
CREATE POLICY stores_public_read ON public.stores
  FOR SELECT USING (
    (status IN ('trial','active') AND publication_status = 'published')
    OR is_store_member(id)
    OR is_platform_admin()
  );

-- Keep demo store publicly visible after policy change
UPDATE public.stores
   SET publication_status = 'published',
       published_at = COALESCE(published_at, now()),
       onboarding_status = 'completed',
       onboarding_completed_at = COALESCE(onboarding_completed_at, now())
 WHERE slug = 'demo';

-- Slug uniqueness (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS stores_slug_unique_idx ON public.stores(slug);
