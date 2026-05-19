CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_key TEXT NOT NULL UNIQUE,
    feed_token TEXT NOT NULL UNIQUE,
    label TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    last_seen_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT clients_status_check CHECK (status IN ('active', 'disabled'))
);

CREATE TABLE IF NOT EXISTS targets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kind TEXT NOT NULL,
    value TEXT NOT NULL,
    normalized_value TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT targets_kind_check CHECK (kind IN ('user', 'keyword')),
    CONSTRAINT targets_unique_normalized UNIQUE (kind, normalized_value)
);

CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    target_id UUID NOT NULL REFERENCES targets(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (client_id, target_id)
);

CREATE TABLE IF NOT EXISTS crawl_state (
    target_id UUID PRIMARY KEY REFERENCES targets(id) ON DELETE CASCADE,
    last_guid TEXT,
    last_checked_at TIMESTAMPTZ,
    last_success_at TIMESTAMPTZ,
    last_error TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_id UUID NOT NULL REFERENCES targets(id) ON DELETE CASCADE,
    guid TEXT NOT NULL,
    author TEXT,
    fullname TEXT,
    title TEXT,
    content TEXT,
    raw_content TEXT,
    translated_content TEXT,
    link TEXT,
    x_url TEXT,
    images JSONB NOT NULL DEFAULT '[]'::jsonb,
    video_url TEXT,
    published_at TIMESTAMPTZ,
    stored_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_retweet BOOLEAN NOT NULL DEFAULT FALSE,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    UNIQUE (target_id, guid)
);

CREATE INDEX IF NOT EXISTS idx_targets_kind_value ON targets (kind, normalized_value);
CREATE INDEX IF NOT EXISTS idx_subscriptions_client_id ON subscriptions (client_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_target_id ON subscriptions (target_id);
CREATE INDEX IF NOT EXISTS idx_items_target_id_stored_at ON items (target_id, stored_at DESC);
CREATE INDEX IF NOT EXISTS idx_items_stored_at ON items (stored_at DESC);
CREATE INDEX IF NOT EXISTS idx_items_published_at ON items (published_at DESC);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_clients_updated_at ON clients;
CREATE TRIGGER set_clients_updated_at
BEFORE UPDATE ON clients
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS set_targets_updated_at ON targets;
CREATE TRIGGER set_targets_updated_at
BEFORE UPDATE ON targets
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
