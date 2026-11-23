CREATE TABLE IF NOT EXISTS brokerage_order_fees (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 brokerage_order_id BIGINT NOT NULL REFERENCES brokerage_orders(id) ON DELETE CASCADE,
 fee_type TEXT NOT NULL,
 amount NUMERIC(20,8) NOT NULL,
 currency CHAR(3) NOT NULL DEFAULT 'USD',
 UNIQUE (brokerage_order_id,fee_type)
);
CREATE INDEX IF NOT EXISTS order_fees_by_order ON brokerage_order_fees(brokerage_order_id);
CREATE TABLE IF NOT EXISTS import_runs (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 brokerage_account_id BIGINT NOT NULL REFERENCES brokerage_accounts(id),
 started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 finished_at TIMESTAMPTZ,
 start_time TIMESTAMPTZ NOT NULL,
 end_time TIMESTAMPTZ NOT NULL,
 status TEXT NOT NULL DEFAULT 'running' CHECK(status IN ('running','completed','failed')),
 scanned_orders INTEGER NOT NULL DEFAULT 0,
 saved_orders INTEGER NOT NULL DEFAULT 0,
 saved_executions INTEGER NOT NULL DEFAULT 0,
 message TEXT
);
CREATE INDEX IF NOT EXISTS import_runs_recent ON import_runs(brokerage_account_id,started_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS executions_order_snapshot_unique ON executions(brokerage_order_id) WHERE source = 'webull_order_snapshot';
