-- MAXWEB sales copilot, pricing controls, and demo management.
-- Account IDs are Supabase Auth UUIDs stored as text; no cross-database account foreign keys.
-- Apply only to the isolated maxweb-development Neon branch.
CREATE TABLE IF NOT EXISTS public.maxweb_ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'website' CHECK (source IN ('website','client_portal','instagram','whatsapp','phone')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','needs_admin_review','reviewing','quoted','converted','closed')),
  customer_name text,
  email text,
  phone text,
  service_type text,
  transcript jsonb NOT NULL DEFAULT '[]'::jsonb,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  proposed_price numeric(12,2) CHECK (proposed_price IS NULL OR proposed_price >= 0),
  price_status text NOT NULL DEFAULT 'not_proposed' CHECK (price_status IN ('not_proposed','review_required','approved','rejected','revised')),
  admin_notes text NOT NULL DEFAULT '',
  quotation_id uuid REFERENCES public.maxweb_quotations(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS maxweb_ai_conversations_status_idx
  ON public.maxweb_ai_conversations(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS maxweb_ai_conversations_user_idx
  ON public.maxweb_ai_conversations(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.maxweb_pricing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_type text NOT NULL UNIQUE,
  base_price numeric(12,2) NOT NULL CHECK (base_price >= 0),
  minimum_price numeric(12,2) NOT NULL CHECK (minimum_price >= 0 AND minimum_price <= base_price),
  max_discount_percent numeric(5,2) NOT NULL DEFAULT 0 CHECK (max_discount_percent >= 0 AND max_discount_percent <= 100),
  active boolean NOT NULL DEFAULT true,
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.maxweb_pricing_rules(service_type,base_price,minimum_price,max_discount_percent,active)
VALUES ('Website development',6000,6000,0,true)
ON CONFLICT (service_type) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.maxweb_demos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  url text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.maxweb_ai_rate_limits (
  key_hash text PRIMARY KEY,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  request_count integer NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
