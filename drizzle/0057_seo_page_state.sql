-- Estado de indexação das páginas públicas de SEO (lei, artigo, hubs). O lastmod
-- do sitemap vem de content_changed_at, que só muda quando content_hash muda.
CREATE TABLE seo_page_state (
  path text PRIMARY KEY,
  type text NOT NULL,
  indexable boolean NOT NULL,
  reason text,
  content_hash text NOT NULL,
  content_changed_at timestamptz NOT NULL,
  inbound_links integer NOT NULL DEFAULT 0,
  checked_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT seo_page_state_type_check CHECK (type IN ('law', 'article', 'hub')),
  CONSTRAINT seo_page_state_path_check CHECK (path ~ '^/[a-z0-9/-]*$'),
  CONSTRAINT seo_page_state_hash_check CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT seo_page_state_inbound_check CHECK (inbound_links >= 0)
);
--> statement-breakpoint
CREATE INDEX seo_page_state_type_indexable_idx ON seo_page_state (type, indexable);
