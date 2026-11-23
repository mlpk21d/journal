-- Journal metadata is independent of immutable broker records.
CREATE TABLE trade_journal_entries (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 cycle_key TEXT NOT NULL UNIQUE,
 fingerprint CHAR(64) NOT NULL CHECK (fingerprint ~ '^[0-9a-f]{64}$'),
 account_id BIGINT NOT NULL REFERENCES brokerage_accounts(id),
 symbol TEXT NOT NULL,
 direction TEXT NOT NULL CHECK (direction IN ('LONG','SHORT')),
 strategy TEXT NOT NULL DEFAULT '',
 setup TEXT NOT NULL DEFAULT '',
 entry_reason TEXT NOT NULL DEFAULT '',
 exit_reason TEXT NOT NULL DEFAULT '',
 mistakes TEXT NOT NULL DEFAULT '',
 lessons TEXT NOT NULL DEFAULT '',
 screenshot_url TEXT NOT NULL DEFAULT '',
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX trade_journal_entries_account_symbol ON trade_journal_entries(account_id,symbol,updated_at DESC);
