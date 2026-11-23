ALTER TABLE brokerage_accounts ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE brokerage_accounts ADD COLUMN IF NOT EXISTS user_label TEXT;
ALTER TABLE brokerage_accounts ADD COLUMN IF NOT EXISTS masked_account TEXT;
ALTER TABLE brokerage_accounts ADD COLUMN IF NOT EXISTS metadata_updated_at TIMESTAMPTZ;
CREATE TABLE IF NOT EXISTS brokerage_cache_control (
 broker TEXT PRIMARY KEY,
 next_refresh_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 last_success_at TIMESTAMPTZ,
 last_error TEXT
);
INSERT INTO brokerage_cache_control(broker) VALUES ('webull') ON CONFLICT DO NOTHING;
CREATE INDEX IF NOT EXISTS brokerage_accounts_by_broker ON brokerage_accounts(broker,id);
