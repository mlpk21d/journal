CREATE TABLE trade_journal_screenshots (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 journal_id UUID NOT NULL REFERENCES trade_journal_entries(id) ON DELETE CASCADE,
 storage_name TEXT NOT NULL UNIQUE,
 mime_type TEXT NOT NULL CHECK(mime_type IN ('image/png','image/jpeg','image/webp')),
 byte_size INTEGER NOT NULL CHECK(byte_size BETWEEN 1 AND 5242880),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX trade_journal_screenshots_journal ON trade_journal_screenshots(journal_id,created_at,id);
