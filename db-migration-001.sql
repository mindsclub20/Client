-- MAXWEB non-AI platform schema. Apply to a development branch before deployment.
-- Supabase Auth owns account identity; user_id values are Supabase UUIDs stored as text.
-- Apply db-migration-004-supabase-auth.sql after this and the other schema migrations.
CREATE TABLE IF NOT EXISTS public.maxweb_profiles (
 user_id text PRIMARY KEY,
 email text,
 role text NOT NULL DEFAULT 'client' CHECK(role IN ('super_admin','admin','client')),
 full_name text, phone text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.maxweb_projects (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), client_user_id text NOT NULL,
 title text NOT NULL, description text NOT NULL DEFAULT '', service_type text NOT NULL DEFAULT 'Website development',
 status text NOT NULL DEFAULT 'requested' CHECK(status IN ('requested','quoted','approved','in_progress','review','completed','on_hold','cancelled')),
 start_date date, due_date date, budget numeric(12,2), currency char(3) NOT NULL DEFAULT 'INR',
 created_by text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.maxweb_project_updates (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL REFERENCES public.maxweb_projects(id) ON DELETE CASCADE,
 author_user_id text, visibility text NOT NULL DEFAULT 'client' CHECK(visibility IN ('client','internal')),
 body text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.maxweb_project_milestones (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL REFERENCES public.maxweb_projects(id) ON DELETE CASCADE,
 title text NOT NULL, description text NOT NULL DEFAULT '', status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','in_progress','completed','blocked')),
 due_date date, sort_order integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.maxweb_service_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id text NOT NULL,
 service_type text NOT NULL, title text NOT NULL, details text NOT NULL, preferred_timeline text,
 status text NOT NULL DEFAULT 'submitted' CHECK(status IN ('submitted','reviewing','quoted','accepted','declined','converted')),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.maxweb_quotations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id text NOT NULL,
 project_id uuid REFERENCES public.maxweb_projects(id) ON DELETE SET NULL, request_id uuid REFERENCES public.maxweb_service_requests(id) ON DELETE SET NULL,
 title text NOT NULL, line_items jsonb NOT NULL DEFAULT '[]'::jsonb, amount numeric(12,2) NOT NULL CHECK(amount>=0),
 currency char(3) NOT NULL DEFAULT 'INR', status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','sent','approved','rejected','expired')),
 notes text NOT NULL DEFAULT '', valid_until date, created_by text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.maxweb_invoices (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id text NOT NULL,
 project_id uuid REFERENCES public.maxweb_projects(id) ON DELETE SET NULL, quotation_id uuid REFERENCES public.maxweb_quotations(id) ON DELETE SET NULL,
 invoice_number text NOT NULL UNIQUE, description text NOT NULL DEFAULT '', amount numeric(12,2) NOT NULL CHECK(amount>=0),
 currency char(3) NOT NULL DEFAULT 'INR', status text NOT NULL DEFAULT 'issued' CHECK(status IN ('draft','issued','partially_paid','paid','overdue','void')),
 due_date date, created_by text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.maxweb_payments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), invoice_id uuid NOT NULL REFERENCES public.maxweb_invoices(id) ON DELETE CASCADE,
 amount numeric(12,2) NOT NULL CHECK(amount>0), method text, reference text,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','failed','refunded')),
 recorded_by text, paid_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.maxweb_support_tickets (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id text NOT NULL,
 project_id uuid REFERENCES public.maxweb_projects(id) ON DELETE SET NULL, subject text NOT NULL, message text NOT NULL,
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','in_progress','waiting_for_client','resolved','closed')),
 priority text NOT NULL DEFAULT 'normal' CHECK(priority IN ('low','normal','high')),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.maxweb_project_files (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL REFERENCES public.maxweb_projects(id) ON DELETE CASCADE,
 uploaded_by text, file_name text NOT NULL, storage_key text NOT NULL, content_type text,
 file_size bigint, visibility text NOT NULL DEFAULT 'client' CHECK(visibility IN ('client','internal')), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.maxweb_audit_logs (
 id bigserial PRIMARY KEY, actor_user_id text, action text NOT NULL,
 entity_type text NOT NULL, entity_id text, details jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.maxweb_public_leads (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, email text, phone text, service_type text,
 message text NOT NULL, source text NOT NULL DEFAULT 'website', status text NOT NULL DEFAULT 'new', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS maxweb_projects_client_idx ON public.maxweb_projects(client_user_id,updated_at DESC);
CREATE INDEX IF NOT EXISTS maxweb_updates_project_idx ON public.maxweb_project_updates(project_id,created_at DESC);
CREATE INDEX IF NOT EXISTS maxweb_requests_user_idx ON public.maxweb_service_requests(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS maxweb_quotes_user_idx ON public.maxweb_quotations(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS maxweb_invoices_user_idx ON public.maxweb_invoices(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS maxweb_tickets_user_idx ON public.maxweb_support_tickets(user_id,updated_at DESC);
CREATE INDEX IF NOT EXISTS maxweb_audit_created_idx ON public.maxweb_audit_logs(created_at DESC);
